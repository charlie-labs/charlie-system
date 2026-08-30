import { formatFor } from '@charlie-labs/format-for';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type SlackHttpClient,
  type SlackHttpRequestOptions,
  type SlackHttpResponse,
} from '../http.js';
import { SlackClient } from '../slack-client.js';

const TOKEN = 'xoxb-test-token';

function response(
  data: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
): SlackHttpResponse {
  return {
    data: { ok: true, ...data },
    status,
    headers: new Headers(headers),
  };
}

describe('SlackClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates whoAmI payload', async () => {
    const http: SlackHttpClient = {
      async request(options) {
        if (options.path === 'auth.test') {
          return response({
            ok: true,
            team: 'My Team',
            team_id: 'T123',
            team_domain: 'my-team',
            url: 'https://my-team.slack.com',
            user: 'bot-user',
            user_id: 'U123',
            user_team: 'T123',
            bot_id: 'B456',
          });
        }

        throw new Error(`unexpected path ${options.path}`);
      },
    };

    const client = new SlackClient({ token: TOKEN, http });
    const identity = await client.whoAmI();

    expect(identity.team).toEqual({
      id: 'T123',
      name: 'My Team',
      domain: 'my-team',
      url: 'https://my-team.slack.com',
    });
    expect(identity.user).toEqual({
      id: 'U123',
      name: 'bot-user',
      teamId: 'T123',
    });
    expect(identity.botId).toBe('B456');
  });

  it('joins channel first and chunks messages when requested', async () => {
    const calls: SlackHttpRequestOptions[] = [];
    let postCounter = 0;

    const channel = { id: 'C111', name: 'general', is_channel: true } as const;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        switch (options.path) {
          case 'conversations.list':
            return response({ channels: [channel] });
          case 'conversations.join':
            return response({ channel });
          case 'chat.postMessage': {
            postCounter += 1;
            const text =
              typeof options.json === 'object' && options.json
                ? (options.json as Record<string, unknown>)['text']
                : undefined;
            return response({
              channel: channel.id,
              ts: `1723.${postCounter}`,
              message: {
                type: 'message',
                ts: `1723.${postCounter}`,
                text,
              },
            });
          }
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });
    const result = await client.postMessage({
      channel: '#general',
      text: 'hello wonderful slack world',
      joinIfNeeded: true,
      chunk: { maxCharacters: 10 },
    });

    expect(result.chunks).toHaveLength(3);
    expect(result.threadTs).toBe('1723.1');
    expect(result.chunks.map((chunk) => chunk.text)).toEqual([
      'hello wond',
      'erful slac',
      'k world\n\n',
    ]);

    const paths = calls.map((call) => call.path);
    expect(paths).toEqual([
      'conversations.list',
      'conversations.join',
      'chat.postMessage',
      'chat.postMessage',
      'chat.postMessage',
    ]);
  });

  it('defaults resolver discovery to include private, mpim, and im types', async () => {
    const calls: SlackHttpRequestOptions[] = [];
    const publicChannel = { id: 'C111', name: 'general', is_channel: true };
    const privateChannel = {
      id: 'G222',
      name: 'secret-plans',
      is_group: true,
      is_private: true,
    };

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        if (options.path === 'conversations.list') {
          const params =
            (options.searchParams as Record<string, unknown> | undefined) ?? {};
          const types = params['types'];

          if (types === 'public_channel,private_channel,mpim,im') {
            return response({ channels: [publicChannel, privateChannel] });
          }

          return response({ channels: [publicChannel] });
        }

        throw new Error(`unexpected path ${options.path}`);
      },
    };

    const client = new SlackClient({ token: TOKEN, http });
    const resolved = await client.resolveChannel('G222');

    expect(resolved.id).toBe('G222');
    const listCall = calls.find((call) => call.path === 'conversations.list');
    const params =
      (listCall?.searchParams as Record<string, unknown> | undefined) ?? {};
    expect(params['types']).toBe('public_channel,private_channel,mpim,im');
  });

  it('preserves explicit channel types when listing channels', async () => {
    const calls: SlackHttpRequestOptions[] = [];

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        if (options.path === 'conversations.list') {
          return response({ channels: [] });
        }

        throw new Error(`unexpected path ${options.path}`);
      },
    };

    const client = new SlackClient({ token: TOKEN, http });
    await client.listChannels({ types: ['private_channel'] });

    const listCall = calls.find((call) => call.path === 'conversations.list');
    const params =
      (listCall?.searchParams as Record<string, unknown> | undefined) ?? {};
    expect(params['types']).toBe('private_channel');
  });

  it('formats message text + mrkdwn blocks/attachments before posting', async () => {
    const calls: SlackHttpRequestOptions[] = [];
    let postCounter = 0;

    const channel = { id: 'C111', name: 'general', is_channel: true } as const;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        switch (options.path) {
          case 'conversations.list':
            return response({ channels: [channel] });
          case 'chat.postMessage': {
            postCounter += 1;
            const json =
              typeof options.json === 'object' && options.json
                ? (options.json as Record<string, unknown>)
                : {};
            return response({
              channel: channel.id,
              ts: `2000.${postCounter}`,
              message: {
                type: 'message',
                ts: `2000.${postCounter}`,
                text: json['text'],
              },
            });
          }
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });

    await client.postMessage({
      channel: '#general',
      text: '**bold**\n',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '[Link](https://example.com)\n',
          },
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: '**plain**',
          },
        },
      ],
      attachments: [
        {
          text: '**att**',
          pretext: '**pre**',
          fields: [{ title: 'Field', value: '**value**' }],
        },
      ],
    });

    const postCall = calls.find((c) => c.path === 'chat.postMessage');
    const payload = postCall?.json as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    const blocks = payload?.['blocks'] as unknown;
    const attachments = payload?.['attachments'] as unknown;

    const blockArray = Array.isArray(blocks) ? (blocks as any[]) : [];
    const attachmentArray = Array.isArray(attachments)
      ? (attachments as any[])
      : [];

    expect(payload?.['text']).toBe('*bold*\n\n');
    expect(blockArray[0]?.text?.text).toBe('<https://example.com|Link>\n\n');
    expect(blockArray[1]?.text?.text).toBe('**plain**');

    expect(attachmentArray[0]?.text).toBe('*att*\n\n');
    expect(attachmentArray[0]?.pretext).toBe('*pre*\n\n');
    expect(attachmentArray[0]?.fields?.[0]?.value).toBe('*value*\n\n');
  });

  it('falls back to unformatted text when the formatter throws', async () => {
    vi.spyOn(formatFor, 'slack').mockRejectedValue(new Error('boom'));

    const calls: SlackHttpRequestOptions[] = [];
    const channel = { id: 'C111', name: 'general', is_channel: true } as const;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        switch (options.path) {
          case 'conversations.list':
            return response({ channels: [channel] });
          case 'chat.postMessage':
            return response({
              channel: channel.id,
              ts: '3000.1',
              message: { type: 'message', ts: '3000.1', text: 'noop' },
            });
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });

    await client.postMessage({
      channel: '#general',
      text: '**bold**',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '**block**',
          },
        },
      ],
    });

    const postCall = calls.find((c) => c.path === 'chat.postMessage');
    const payload = postCall?.json as Record<string, unknown> | undefined;
    expect(payload?.['text']).toBe('**bold**');

    const blocks = payload?.['blocks'] as unknown;
    const blockArray = Array.isArray(blocks) ? (blocks as any[]) : [];
    expect(blockArray[0]?.text?.text).toBe('**block**');
  });

  it('does not format nested objects that merely look like mrkdwn text objects', async () => {
    const calls: SlackHttpRequestOptions[] = [];
    const channel = { id: 'C111', name: 'general', is_channel: true } as const;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        switch (options.path) {
          case 'conversations.list':
            return response({ channels: [channel] });
          case 'chat.postMessage':
            return response({
              channel: channel.id,
              ts: '4000.1',
              message: { type: 'message', ts: '4000.1', text: 'noop' },
            });
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });

    await client.postMessage({
      channel: '#general',
      text: 'hello',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '**yes**' },
          notARealSlackTextObject: { type: 'mrkdwn', text: '**nope**' },
        },
      ],
    });

    const postCall = calls.find((c) => c.path === 'chat.postMessage');
    const payload = postCall?.json as Record<string, unknown> | undefined;
    const blocks = payload?.['blocks'] as unknown;
    const blockArray = Array.isArray(blocks) ? (blocks as any[]) : [];
    expect(blockArray[0]?.text?.text).toBe('*yes*\n\n');
    expect(blockArray[0]?.notARealSlackTextObject?.text).toBe('**nope**');
  });

  it('formats message text + mrkdwn blocks when updating', async () => {
    const calls: SlackHttpRequestOptions[] = [];

    const channel = { id: 'C111', name: 'general', is_channel: true } as const;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options);
        switch (options.path) {
          case 'conversations.list':
            return response({ channels: [channel] });
          case 'chat.update': {
            const json =
              typeof options.json === 'object' && options.json
                ? (options.json as Record<string, unknown>)
                : {};
            return response({
              channel: channel.id,
              ts: '2001.1',
              text: json['text'],
            });
          }
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });

    await client.updateMessage({
      channel: '#general',
      ts: '2001.0',
      text: '**updated**\n',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '**block**\n' },
        },
      ],
    });

    const updateCall = calls.find((c) => c.path === 'chat.update');
    const payload = updateCall?.json as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    const blocks = payload?.['blocks'] as unknown;
    const blockArray = Array.isArray(blocks) ? (blocks as any[]) : [];

    expect(payload?.['text']).toBe('*updated*\n\n');
    expect(blockArray[0]?.text?.text).toBe('*block*\n\n');
  });

  it('sends DM by opening conversation and posting message', async () => {
    const user = {
      id: 'U222',
      name: 'alice',
      profile: { email: 'alice@example.com' },
    } as const;

    const dmChannel = { id: 'D333', name: 'direct-message' } as const;

    const calls: string[] = [];
    let postCount = 0;

    const http: SlackHttpClient = {
      async request(options) {
        calls.push(options.path);
        switch (options.path) {
          case 'users.list':
            return response({ members: [user] });
          case 'conversations.open':
            return response({ channel: dmChannel });
          case 'chat.postMessage': {
            postCount += 1;
            return response({
              channel: dmChannel.id,
              ts: `1890.${postCount}`,
              message: {
                type: 'message',
                ts: `1890.${postCount}`,
                text: 'ping',
              },
            });
          }
          case 'conversations.list':
            return response({ channels: [dmChannel] });
          default:
            throw new Error(`unexpected path ${options.path}`);
        }
      },
    };

    const client = new SlackClient({ token: TOKEN, http });
    const result = await client.sendDm({ user: '@alice', text: 'ping' });

    expect(result.channel.id).toBe(dmChannel.id);
    expect(result.threadTs).toBe('1890.1');
    expect(calls).toEqual([
      'users.list',
      'conversations.open',
      'chat.postMessage',
    ]);
  });

  it('uploads files via v2/external flow (get URL → upload bytes → complete)', async () => {
    const channel = { id: 'C999', name: 'files', is_channel: true } as const;
    const calls: {
      path: string;
      json?: unknown;
      headers?: Record<string, string> | undefined;
      body?: unknown;
    }[] = [];

    const http: SlackHttpClient = {
      async request(options) {
        if (options.path === 'conversations.list') {
          return response({ channels: [channel] });
        }

        if (options.path === 'files.getUploadURLExternal') {
          calls.push({
            path: options.path,
            json: options.json,
            headers: options.headers,
            body: options.body,
          });
          return response({
            upload_url: 'https://upload.slack.mock/url',
            file_id: 'F111',
          });
        }

        if (options.path === 'files.completeUploadExternal') {
          calls.push({ path: options.path, json: options.json });
          return response({ files: [{ id: 'F111', name: 'notes.txt' }] });
        }

        throw new Error(`unexpected path ${options.path}`);
      },
    };

    // Stub the external byte upload
    const fetchStub = vi.fn(
      async () => new Response('', { status: 200 })
    ) as unknown as typeof fetch;

    const client = new SlackClient({ token: TOKEN, http, fetch: fetchStub });
    const file = new Blob(['hello world'], { type: 'text/plain' });

    const result = await client.uploadFileExternal({
      channel: '#files',
      filename: 'notes.txt',
      file,
      initialComment: '**see** attachment',
    });

    expect(result.file.id).toBe('F111');
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.path)).toEqual([
      'files.getUploadURLExternal',
      'files.completeUploadExternal',
    ]);

    // Assert getUploadURLExternal is form-encoded with filename/length and no JSON body
    const getCall = calls.find((c) => c.path === 'files.getUploadURLExternal');
    expect(getCall?.json).toBeUndefined();
    const rawBody = getCall?.body as unknown;
    // If a Content-Type header is present, verify it's urlencoded without being overly strict
    const maybeCt = getCall?.headers?.['Content-Type'];
    if (typeof maybeCt === 'string') {
      expect(maybeCt).toMatch(/^application\/x-www-form-urlencoded\b/);
    }
    const bodyStr =
      rawBody instanceof URLSearchParams
        ? rawBody.toString()
        : String(rawBody ?? '');
    expect(bodyStr).toContain('filename=notes.txt');
    expect(bodyStr).toContain(`length=${file.size}`);

    // Assert we do not send alt_txt on complete (Slack rejects it)
    const completeCall = calls.find(
      (c) => c.path === 'files.completeUploadExternal'
    );
    const completeJson = (completeCall?.json ?? {}) as Record<string, unknown>;
    expect(completeJson['initial_comment']).toBe('*see* attachment\n\n');

    const filesArr = Array.isArray((completeJson as any).files)
      ? ((completeJson as any).files as any[])
      : [];
    expect(filesArr.length).toBeGreaterThanOrEqual(1);
    if (filesArr[0]) {
      expect(filesArr[0].id).toBe('F111');
      expect(filesArr[0].title).toBe('notes.txt');
      expect('alt_txt' in filesArr[0]).toBe(false);
    }
  });
});
