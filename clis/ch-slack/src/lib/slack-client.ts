import { formatFor } from '@charlie-labs/format-for';

import { type TTLCacheOptions } from './cache.js';
import {
  createSlackHttpClient,
  type SlackHttpClient,
  type SlackHttpClientOptions,
} from './http.js';
import {
  createChannelResolver,
  createUserResolver,
  type SlackChannelResolver,
  type SlackUserResolver,
} from './resolvers.js';
import {
  SlackAuthTestResponseSchema,
  type SlackChannel,
  SlackChatDeleteResponseSchema,
  SlackChatPostMessageResponseSchema,
  SlackChatUpdateResponseSchema,
  SlackConversationsHistoryResponseSchema,
  SlackConversationsJoinResponseSchema,
  SlackConversationsListResponseSchema,
  SlackConversationsOpenResponseSchema,
  SlackConversationsRepliesResponseSchema,
  type SlackFile,
  SlackFilesCompleteUploadExternalResponseSchema,
  SlackFilesGetUploadURLExternalResponseSchema,
  type SlackMessage,
  SlackMessageSchema,
  SlackReactionMutationResponseSchema,
  type SlackUser,
  SlackUsersListResponseSchema,
} from './schemas.js';

export interface SlackClientOptions extends SlackHttpClientOptions {
  readonly channelCache?: Partial<TTLCacheOptions> | undefined;
  readonly userCache?: Partial<TTLCacheOptions> | undefined;
  readonly defaultPostChunkSize?: number | undefined;
  readonly http?: SlackHttpClient | undefined;
}

export interface SlackIdentity {
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly domain?: string | undefined;
    readonly url: string;
  };
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly teamId?: string | undefined;
  };
  readonly botId?: string | undefined;
}

export interface SlackMessagesPage {
  readonly channel: SlackChannel;
  readonly messages: readonly SlackMessage[];
  readonly hasMore: boolean;
  readonly nextCursor?: string | undefined;
}

export interface SlackThreadPage extends SlackMessagesPage {
  readonly threadTs: string;
}

export interface SlackPostMessageChunk {
  readonly text: string;
  readonly ts: string;
  readonly message: SlackMessage;
}

export interface SlackPostMessageResult {
  readonly channel: SlackChannel;
  readonly ts: string;
  readonly threadTs: string;
  readonly chunks: readonly SlackPostMessageChunk[];
}

export interface PostMessageChunkingOptions {
  readonly maxCharacters?: number | undefined;
  readonly delimiter?: string | undefined;
}

export interface PostMessageOptions {
  readonly channel: string;
  readonly text: string;
  readonly threadTs?: string | undefined;
  readonly joinIfNeeded?: boolean | undefined;
  readonly chunk?: PostMessageChunkingOptions | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly blocks?: readonly unknown[] | undefined;
  readonly attachments?: readonly unknown[] | undefined;
  readonly linkNames?: boolean | undefined;
}

export interface UpdateMessageOptions {
  readonly channel: string;
  readonly ts: string;
  readonly text: string;
  readonly blocks?: readonly unknown[] | undefined;
  readonly attachments?: readonly unknown[] | undefined;
}

export interface DeleteMessageOptions {
  readonly channel: string;
  readonly ts: string;
}

export interface SlackDeleteMessageResult {
  readonly channel: string;
  readonly ts: string;
}

export interface ReactionOptions {
  readonly name: string;
  readonly channel: string;
  readonly timestamp: string;
}

export interface SendDmOptions {
  readonly user: string;
  readonly text: string;
  readonly threadTs?: string | undefined;
  readonly chunk?: PostMessageChunkingOptions | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly blocks?: readonly unknown[] | undefined;
  readonly attachments?: readonly unknown[] | undefined;
}

export type SlackFileUploadSource = Blob | Uint8Array | ArrayBuffer;

// Legacy UploadFileOptions removed with deprecated multipart flow.

export interface SlackFileUploadResult {
  readonly file: SlackFile;
}

interface UploadFileExternalOptions {
  readonly file: SlackFileUploadSource;
  readonly filename: string;
  readonly contentType?: string | undefined;
  readonly title?: string | undefined;
  readonly initialComment?: string | undefined;
  readonly threadTs?: string | undefined;
  readonly channel?: string | undefined;
  readonly channels?: readonly string[] | undefined;
}

const DEFAULT_POST_CHUNK_SIZE = 3_500;
const DEFAULT_PAGE_LIMIT = 200;
// Resolver-backed discovery should search across all conversation types to
// avoid false local `channel_not_found` for private channels/DMs.
const DEFAULT_RESOLVER_CHANNEL_TYPES = [
  'public_channel',
  'private_channel',
  'mpim',
  'im',
] as const;
// Slack conversations.list per-page maximum (documented cap is typically 1000)
const MAX_CHANNELS_PAGE = 1_000;

// Slack message/history per-page maximum (typical documented cap)
const MAX_MESSAGES_PAGE = 1_000;
export class SlackClient {
  private readonly http: SlackHttpClient;
  private readonly channelResolver: SlackChannelResolver;
  private readonly userResolver: SlackUserResolver;
  private readonly defaultChunkSize: number;
  private readonly externalFetch: typeof fetch;

  constructor(options: SlackClientOptions) {
    const {
      http: providedHttp,
      channelCache,
      userCache,
      defaultPostChunkSize = DEFAULT_POST_CHUNK_SIZE,
      ...httpOptions
    } = options;

    this.http = providedHttp ?? createSlackHttpClient(httpOptions);
    // Use the same fetch provided to the HTTP layer when present; fall back to global fetch
    const gf = httpOptions.fetch ?? globalThis.fetch;
    if (!gf) {
      throw new Error(
        'SlackClient requires a fetch implementation. Provide one via SlackClientOptions.fetch or run in a runtime with global fetch (Bun or Node >= 18).'
      );
    }
    this.externalFetch = gf;
    this.channelResolver = createChannelResolver(
      (args) =>
        this.fetchChannelPage({
          ...args,
          types: DEFAULT_RESOLVER_CHANNEL_TYPES,
        }),
      {
        cache: channelCache,
      }
    );
    this.userResolver = createUserResolver((args) => this.fetchUserPage(args), {
      cache: userCache,
    });
    this.defaultChunkSize = defaultPostChunkSize;
  }

  async whoAmI(): Promise<SlackIdentity> {
    const response = await this.http.request({
      path: 'auth.test',
      method: 'POST',
    });
    const parsed = SlackAuthTestResponseSchema.parse(response.data);
    return {
      team: {
        id: parsed.team_id,
        name: parsed.team,
        domain: parsed.team_domain,
        url: parsed.url,
      },
      user: {
        id: parsed.user_id,
        name: parsed.user,
        teamId: parsed.user_team,
      },
      botId: parsed.bot_id,
    };
  }

  async listChannels(options?: {
    readonly types?: readonly string[] | undefined;
    readonly excludeArchived?: boolean | undefined;
    /**
     * Total maximum number of channels to return. Defaults to Infinity (fetch all).
     */
    readonly limit?: number | undefined;
    /**
     * Per-page size when calling Slack's conversations.list. Defaults to DEFAULT_PAGE_LIMIT.
     * If omitted, falls back to `options.limit` when provided, otherwise DEFAULT_PAGE_LIMIT.
     */
    readonly pageSize?: number | undefined;
  }): Promise<readonly SlackChannel[]> {
    const all: SlackChannel[] = [];
    let cursor: string | undefined;
    const rawMax = Number(options?.limit);
    const normalizedLimit = Number.isFinite(rawMax)
      ? Math.floor(rawMax)
      : undefined;
    if (normalizedLimit !== undefined && normalizedLimit <= 0) {
      return [];
    }
    const max = normalizedLimit ?? Infinity;

    const rawPageSize =
      options?.pageSize ?? options?.limit ?? DEFAULT_PAGE_LIMIT;
    const pageSize = clampInt(
      rawPageSize,
      1,
      MAX_CHANNELS_PAGE,
      DEFAULT_PAGE_LIMIT
    );
    do {
      const remaining =
        max === Infinity
          ? pageSize
          : Math.max(1, Math.min(pageSize, max - all.length));
      const page = await this.fetchChannelPage({
        cursor,
        types: options?.types,
        excludeArchived: options?.excludeArchived ?? true,
        pageLimit: remaining,
      });
      all.push(...page.channels);
      if (all.length >= max) {
        const sliced = all.slice(0, max);
        this.channelResolver.prime(sliced);
        return sliced;
      }
      cursor = page.nextCursor;
    } while (cursor);

    this.channelResolver.prime(all);
    return all;
  }

  async getChannelHistory(options: {
    readonly channel: string;
    readonly cursor?: string | undefined;
    readonly limit?: number | undefined;
    readonly oldest?: string | undefined;
    readonly latest?: string | undefined;
    readonly inclusive?: boolean | undefined;
  }): Promise<SlackMessagesPage> {
    const channel = await this.channelResolver.resolve(options.channel);
    const response = await this.http.request({
      path: 'conversations.history',
      method: 'GET',
      searchParams: cleanseParams({
        channel: channel.id,
        cursor: options.cursor,
        limit: clampInt(
          options.limit ?? DEFAULT_PAGE_LIMIT,
          1,
          MAX_MESSAGES_PAGE,
          DEFAULT_PAGE_LIMIT
        ),
        oldest: options.oldest,
        latest: options.latest,
        inclusive: options.inclusive,
      }),
    });

    const parsed = SlackConversationsHistoryResponseSchema.parse(response.data);
    const nextCursor = normalizeCursor(parsed.response_metadata?.next_cursor);
    return {
      channel,
      messages: parsed.messages,
      hasMore: Boolean(parsed.has_more) || Boolean(nextCursor),
      nextCursor,
    };
  }

  async viewThread(options: {
    readonly channel: string;
    readonly threadTs: string;
    readonly cursor?: string | undefined;
    readonly limit?: number | undefined;
    readonly inclusive?: boolean | undefined;
  }): Promise<SlackThreadPage> {
    const channel = await this.channelResolver.resolve(options.channel);
    const response = await this.http.request({
      path: 'conversations.replies',
      method: 'GET',
      searchParams: cleanseParams({
        channel: channel.id,
        ts: options.threadTs,
        cursor: options.cursor,
        limit: clampInt(
          options.limit ?? DEFAULT_PAGE_LIMIT,
          1,
          MAX_MESSAGES_PAGE,
          DEFAULT_PAGE_LIMIT
        ),
        inclusive: options.inclusive,
      }),
    });

    const parsed = SlackConversationsRepliesResponseSchema.parse(response.data);
    const nextCursor = normalizeCursor(parsed.response_metadata?.next_cursor);
    return {
      channel,
      messages: parsed.messages,
      hasMore: Boolean(parsed.has_more) || Boolean(nextCursor),
      nextCursor,
      threadTs: options.threadTs,
    };
  }

  async postMessage(
    options: PostMessageOptions
  ): Promise<SlackPostMessageResult> {
    const channel = await this.channelResolver.resolve(options.channel);

    if (options.joinIfNeeded) {
      await this.joinChannel(channel.id);
    }

    const [maybeFormattedText, formattedBlocks, formattedAttachments] =
      await Promise.all([
        formatSlackText(options.text),
        formatSlackBlocks(options.blocks),
        formatSlackAttachments(options.attachments),
      ]);

    const formattedText = maybeFormattedText ?? options.text;

    const segments = chunkText(formattedText, {
      maxCharacters: options.chunk?.maxCharacters ?? this.defaultChunkSize,
      delimiter: options.chunk?.delimiter,
    });

    const chunks: SlackPostMessageChunk[] = [];
    let rootTs = options.threadTs;

    for (const [index, textChunk] of segments.entries()) {
      const payload = buildJsonPayload({
        channel: channel.id,
        text: textChunk,
        thread_ts: index === 0 ? options.threadTs : rootTs,
        metadata: options.metadata,
        blocks: formattedBlocks,
        attachments: formattedAttachments,
        link_names: options.linkNames,
      });

      const response = await this.http.request({
        path: 'chat.postMessage',
        method: 'POST',
        json: payload,
      });

      const parsed = SlackChatPostMessageResponseSchema.parse(response.data);
      const message = SlackMessageSchema.parse(parsed.message);
      if (!rootTs) {
        rootTs = parsed.ts;
      }

      chunks.push({
        text: textChunk,
        ts: parsed.ts,
        message,
      });
    }

    const primary = chunks[0];
    if (!primary) {
      throw new Error(
        'Failed to send Slack message – no chunks were generated.'
      );
    }

    return {
      channel,
      ts: primary.ts,
      threadTs: rootTs ?? primary.ts,
      chunks,
    };
  }

  async updateMessage(options: UpdateMessageOptions): Promise<SlackMessage> {
    const channel = await this.channelResolver.resolve(options.channel);

    const [maybeFormattedText, formattedBlocks, formattedAttachments] =
      await Promise.all([
        formatSlackText(options.text),
        formatSlackBlocks(options.blocks),
        formatSlackAttachments(options.attachments),
      ]);

    const formattedText = maybeFormattedText ?? options.text;

    const response = await this.http.request({
      path: 'chat.update',
      method: 'POST',
      json: buildJsonPayload({
        channel: channel.id,
        ts: options.ts,
        text: formattedText,
        blocks: formattedBlocks,
        attachments: formattedAttachments,
      }),
    });

    const parsed = SlackChatUpdateResponseSchema.parse(response.data);
    if (parsed.message) {
      const maybe = SlackMessageSchema.safeParse(parsed.message);
      if (maybe.success) {
        return maybe.data;
      }
    }

    // Minimal fallback: only fields that are part of SlackMessageSchema
    return SlackMessageSchema.parse({
      type: 'message',
      ts: parsed.ts,
      text: parsed.text ?? formattedText,
    });
  }

  async deleteMessage(
    options: DeleteMessageOptions
  ): Promise<SlackDeleteMessageResult> {
    const channel = await this.channelResolver.resolve(options.channel);
    const response = await this.http.request({
      path: 'chat.delete',
      method: 'POST',
      json: { channel: channel.id, ts: options.ts },
    });

    const parsed = SlackChatDeleteResponseSchema.parse(response.data);
    return { channel: parsed.channel, ts: parsed.ts };
  }

  async addReaction(options: ReactionOptions): Promise<void> {
    await this.mutateReaction('reactions.add', options);
  }

  async removeReaction(options: ReactionOptions): Promise<void> {
    await this.mutateReaction('reactions.remove', options);
  }

  async sendDm(options: SendDmOptions): Promise<SlackPostMessageResult> {
    const user = await this.userResolver.resolve(options.user);
    const dmChannel = await this.openConversation([user.id]);

    return this.postMessage({
      channel: dmChannel.id,
      text: options.text,
      threadTs: options.threadTs,
      chunk: options.chunk,
      metadata: options.metadata,
      blocks: options.blocks,
      attachments: options.attachments,
    });
  }

  // Legacy `files.upload` multipart flow has been removed (deprecated for our bot token).

  async uploadFileExternal(
    options: UploadFileExternalOptions
  ): Promise<SlackFileUploadResult> {
    // Resolve channel ids (optional multi-target)
    const channelIds: string[] = [];
    if (options.channel) {
      const single = await this.channelResolver.resolve(options.channel);
      channelIds.push(single.id);
    }
    if (options.channels?.length) {
      const resolved = await Promise.all(
        options.channels.map((ref) => this.channelResolver.resolve(ref))
      );
      channelIds.push(...resolved.map((c) => c.id));
    }

    // Compute length and payload
    const blob = toBlob(options.file);
    const length = blob.size;
    let contentType = 'application/octet-stream';
    if (options.contentType && options.contentType.trim() !== '') {
      contentType = options.contentType;
    } else if (blob.type && blob.type.trim() !== '') {
      contentType = blob.type;
    }

    // Step 1: obtain an upload URL and file id
    // Slack expects application/x-www-form-urlencoded for getUploadURLExternal.
    // Pass URLSearchParams so the transport sets Content-Type and we keep
    // the Authorization header from the HTTP client instance.
    const form = new URLSearchParams();
    form.set('filename', options.filename);
    form.set('length', String(length));

    const getUrlRes = await this.http.request({
      path: 'files.getUploadURLExternal',
      method: 'POST',
      body: form,
    });

    const { upload_url: uploadUrl, file_id: fileId } =
      SlackFilesGetUploadURLExternalResponseSchema.parse(getUrlRes.data);

    // Step 2: upload raw bytes to the returned URL (no Authorization header)
    // In stub mode (when a custom fetch is provided), this.externalFetch may be a test stub.
    const uploadResp = await this.externalFetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!uploadResp.ok) {
      const bodyText = await safeReadText(uploadResp);
      throw new Error(
        `Failed to upload bytes to Slack upload bucket (status ${uploadResp.status}). ${bodyText}`
      );
    }

    // Step 3: complete the upload and (optionally) share to channels / threads
    const uniqueChannelIds = [...new Set(channelIds)];
    const singleChannelId =
      uniqueChannelIds.length === 1 ? uniqueChannelIds[0] : undefined;
    const multipleChannelsCsv =
      uniqueChannelIds.length > 1 ? uniqueChannelIds.join(',') : undefined;
    const allowThread = Boolean(singleChannelId);

    const formattedInitialComment = options.initialComment
      ? await formatSlackText(options.initialComment)
      : undefined;

    const completeRes = await this.http.request({
      path: 'files.completeUploadExternal',
      method: 'POST',
      json: buildJsonPayload({
        files: [
          {
            id: fileId,
            title: options.title ?? options.filename,
          },
        ],
        channel_id: singleChannelId,
        channels: multipleChannelsCsv,
        initial_comment: formattedInitialComment,
        thread_ts: allowThread ? options.threadTs : undefined,
      }),
    });

    const completed = SlackFilesCompleteUploadExternalResponseSchema.parse(
      completeRes.data
    );
    const primary = completed.files[0];
    if (!primary) {
      throw new Error(
        'Slack did not return any files after completing upload.'
      );
    }
    return { file: primary };
  }

  async resolveChannel(input: string): Promise<SlackChannel> {
    return this.channelResolver.resolve(input);
  }

  async resolveUser(input: string): Promise<SlackUser> {
    return this.userResolver.resolve(input);
  }

  async joinChannel(input: string): Promise<SlackChannel> {
    const channel = await this.channelResolver.resolve(input);
    const response = await this.http.request({
      path: 'conversations.join',
      method: 'POST',
      json: { channel: channel.id },
    });

    const parsed = SlackConversationsJoinResponseSchema.parse(response.data);
    this.channelResolver.prime([parsed.channel]);
    return parsed.channel;
  }

  private async mutateReaction(
    path: 'reactions.add' | 'reactions.remove',
    options: ReactionOptions
  ): Promise<void> {
    const channel = await this.channelResolver.resolve(options.channel);
    const response = await this.http.request({
      path,
      method: 'POST',
      json: {
        name: options.name,
        channel: channel.id,
        timestamp: options.timestamp,
      },
    });

    SlackReactionMutationResponseSchema.parse(response.data);
  }

  private async openConversation(
    userIds: readonly string[]
  ): Promise<SlackChannel> {
    const response = await this.http.request({
      path: 'conversations.open',
      method: 'POST',
      json: { users: userIds.join(',') },
    });

    const parsed = SlackConversationsOpenResponseSchema.parse(response.data);
    this.channelResolver.prime([parsed.channel]);
    return parsed.channel;
  }

  private async fetchChannelPage(args: {
    readonly cursor?: string | undefined;
    readonly types?: readonly string[] | undefined;
    readonly excludeArchived?: boolean | undefined;
    readonly pageLimit?: number | undefined;
  }): Promise<{ channels: SlackChannel[]; nextCursor?: string | undefined }> {
    const response = await this.http.request({
      path: 'conversations.list',
      method: 'GET',
      searchParams: cleanseParams({
        cursor: args.cursor,
        types: args.types?.join(','),
        exclude_archived: args.excludeArchived ?? true,
        limit: args.pageLimit ?? DEFAULT_PAGE_LIMIT,
      }),
    });

    const parsed = SlackConversationsListResponseSchema.parse(response.data);
    const channels = parsed.channels; // already validated by schema
    const nextCursor = normalizeCursor(parsed.response_metadata?.next_cursor);
    return { channels, nextCursor };
  }

  private async fetchUserPage(args: {
    readonly cursor?: string | undefined;
  }): Promise<{ users: SlackUser[]; nextCursor?: string | undefined }> {
    const response = await this.http.request({
      path: 'users.list',
      method: 'GET',
      searchParams: cleanseParams({
        cursor: args.cursor,
        limit: DEFAULT_PAGE_LIMIT,
      }),
    });

    const parsed = SlackUsersListResponseSchema.parse(response.data);
    const users = parsed.members; // already validated by schema
    const nextCursor = normalizeCursor(parsed.response_metadata?.next_cursor);
    return { users, nextCursor };
  }
}

function omitUndefinedEntries<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function cleanseParams(
  params: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> {
  return omitUndefinedEntries(params) as Record<
    string,
    string | number | boolean
  >;
}

function normalizeCursor(cursor?: string | null): string | undefined {
  if (!cursor) {
    return undefined;
  }
  const trimmed = cursor.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback = min
): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const buildJsonPayload = omitUndefinedEntries;

async function formatSlackText(
  input: string | undefined
): Promise<string | undefined> {
  if (typeof input !== 'string') {
    return undefined;
  }

  // Formatting should be best-effort; never fail Slack operations because the
  // formatter threw.
  try {
    return await formatFor.slack(input, {
      warnings: {
        mode: 'silent',
      },
    });
  } catch {
    return input;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function formatSlackBlocks(
  blocks: readonly unknown[] | undefined
): Promise<readonly unknown[] | undefined> {
  if (!blocks) {
    return undefined;
  }

  return Promise.all(blocks.map((block) => formatSlackBlock(block)));
}

async function formatSlackAttachments(
  attachments: readonly unknown[] | undefined
): Promise<readonly unknown[] | undefined> {
  if (!attachments) {
    return undefined;
  }

  return Promise.all(
    attachments.map(async (attachment) => {
      const formattedLegacy = await formatLegacyAttachmentStrings(attachment);
      if (!isRecord(formattedLegacy)) {
        return formattedLegacy;
      }

      const next: Record<string, unknown> = { ...formattedLegacy };
      const blocks = next['blocks'];
      if (Array.isArray(blocks)) {
        next['blocks'] = await formatSlackBlocks(blocks);
      }

      return next;
    })
  );
}

async function formatSlackBlock(block: unknown): Promise<unknown> {
  if (!isRecord(block)) {
    return block;
  }

  const type = block['type'];
  if (typeof type !== 'string') {
    return block;
  }

  switch (type) {
    case 'section': {
      const next: Record<string, unknown> = { ...block };
      if ('text' in block) {
        next['text'] = await formatSlackTextObject(block['text']);
      }
      const fields = block['fields'];
      if (Array.isArray(fields)) {
        next['fields'] = await Promise.all(
          fields.map((field) => formatSlackTextObject(field))
        );
      }
      return next;
    }

    case 'context': {
      const elements = block['elements'];
      if (!Array.isArray(elements)) {
        return block;
      }

      return {
        ...block,
        elements: await Promise.all(
          elements.map((el) => formatSlackTextObject(el))
        ),
      };
    }

    default:
      return block;
  }
}

async function formatSlackTextObject(value: unknown): Promise<unknown> {
  if (!isRecord(value)) {
    return value;
  }

  const maybeType = value['type'];
  const maybeText = value['text'];
  if (maybeType === 'mrkdwn' && typeof maybeText === 'string') {
    return {
      ...value,
      text: await formatSlackText(maybeText),
    };
  }

  // Do not modify Block Kit plain_text objects.
  if (maybeType === 'plain_text' && typeof maybeText === 'string') {
    return value;
  }

  return value;
}

async function formatLegacyAttachmentStrings(
  attachment: unknown
): Promise<unknown> {
  if (!isRecord(attachment)) {
    return attachment;
  }

  const next: Record<string, unknown> = { ...attachment };

  const text = next['text'];
  if (typeof text === 'string') {
    next['text'] = await formatSlackText(text);
  }

  const pretext = next['pretext'];
  if (typeof pretext === 'string') {
    next['pretext'] = await formatSlackText(pretext);
  }

  const fields = next['fields'];
  if (Array.isArray(fields)) {
    next['fields'] = await Promise.all(
      fields.map(async (field) => {
        if (!isRecord(field)) {
          return field;
        }

        const value = field['value'];
        if (typeof value !== 'string') {
          return field;
        }

        return {
          ...field,
          value: await formatSlackText(value),
        };
      })
    );
  }

  return next;
}

function chunkText(
  text: string,
  options: {
    readonly maxCharacters: number;
    readonly delimiter?: string | undefined;
  }
): string[] {
  const limit = options.maxCharacters;
  if (!Number.isFinite(limit) || limit <= 0 || text.length <= limit) {
    return [text];
  }

  // Treat empty-string delimiter as "no delimiter" to avoid degenerate soft-split
  const rawDelimiter = options.delimiter ?? '\n\n';
  const useDelimiter = rawDelimiter.length > 0;
  const delimiter = rawDelimiter;
  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    const splitAt = useDelimiter ? remaining.lastIndexOf(delimiter, limit) : -1;
    if (splitAt > 0 && splitAt >= limit / 2) {
      // soft cut: consume the delimiter from the remainder
      const end = splitAt + delimiter.length;
      segments.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(end).trimStart();
    } else {
      // hard cut at limit, but avoid splitting through a delimiter prefix
      let cut = limit;
      if (useDelimiter && delimiter.length > 1) {
        const window = remaining.slice(0, limit);
        const maxOverlap = Math.min(delimiter.length - 1, window.length);
        for (let k = maxOverlap; k > 0; k--) {
          if (window.endsWith(delimiter.slice(0, k))) {
            cut = Math.max(1, limit - k); // ensure progress; avoid splitting the delimiter
            break;
          }
        }
      }
      segments.push(remaining.slice(0, cut).trimEnd());
      remaining = remaining.slice(cut).trimStart();
    }
  }

  if (remaining.length > 0) segments.push(remaining);
  return segments;
}

function toBlob(source: SlackFileUploadSource): Blob {
  if (source instanceof Blob) {
    return source;
  }

  if (source instanceof Uint8Array) {
    const copy = new ArrayBuffer(source.byteLength);
    new Uint8Array(copy).set(source);
    return new Blob([copy]);
  }

  if (source instanceof ArrayBuffer) {
    return new Blob([new Uint8Array(source)]);
  }

  throw new TypeError('Unsupported file source for Slack upload.');
}

async function safeReadText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text ?? '';
  } catch {
    return '';
  }
}
