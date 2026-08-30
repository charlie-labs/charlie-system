import { z } from 'zod3';

const SlackResponseMetadataSchema = z
  .object({
    next_cursor: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    messages: z.array(z.string()).optional(),
  })
  .passthrough();

export const SlackChannelSchema = z
  .object({
    id: z.string(),
    // Slack IM/DM conversations may omit `name`; keep optional to avoid parse failures.
    name: z.string().optional(),
    is_channel: z.boolean().optional(),
    is_group: z.boolean().optional(),
    is_im: z.boolean().optional(),
    is_mpim: z.boolean().optional(),
    is_private: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    is_member: z.boolean().optional(),
    topic: z
      .object({
        value: z.string().optional(),
      })
      .optional(),
    purpose: z
      .object({
        value: z.string().optional(),
      })
      .optional(),
    num_members: z.number().optional(),
  })
  .passthrough();

export type SlackChannel = z.infer<typeof SlackChannelSchema>;

export const SlackFileSchema = z
  .object({
    id: z.string(),
    created: z.number().optional(),
    name: z.string().optional(),
    mimetype: z.string().optional(),
    filetype: z.string().optional(),
    pretty_type: z.string().optional(),
    size: z.number().optional(),
    url_private: z.string().optional(),
    url_private_download: z.string().optional(),
    permalink: z.string().optional(),
    permalink_public: z.string().optional(),
  })
  .passthrough();

export type SlackFile = z.infer<typeof SlackFileSchema>;
export const SlackMessageSchema = z
  .object({
    type: z.string().default('message'),
    ts: z.string(),
    text: z.string().default(''),
    user: z.string().optional(),
    username: z.string().optional(),
    bot_id: z.string().optional(),
    team: z.string().optional(),
    thread_ts: z.string().optional(),
    parent_user_id: z.string().optional(),
    subtype: z.string().optional(),
    reply_count: z.number().optional(),
    reply_users_count: z.number().optional(),
    latest_reply: z.string().optional(),
    metadata: z
      .object({
        event_type: z.string(),
        event_payload: z.unknown(),
      })
      .optional(),
    files: z.array(SlackFileSchema).optional(),
    reactions: z
      .array(
        z.object({
          name: z.string(),
          count: z.number(),
          users: z.array(z.string()).optional(),
        })
      )
      .optional(),
    blocks: z.array(z.unknown()).optional(),
    attachments: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type SlackMessage = z.infer<typeof SlackMessageSchema>;

const SlackMessagePageSchema = z
  .object({
    ok: z.literal(true),
    messages: z.array(SlackMessageSchema),
    has_more: z.boolean().optional(),
    pin_count: z.number().optional(),
    response_metadata: SlackResponseMetadataSchema.optional(),
  })
  .passthrough();

const SlackThreadResponseSchema = SlackMessagePageSchema.extend({
  channel: z.string().optional(),
  thread_ts: z.string().optional(),
}).passthrough();

export const SlackAuthTestResponseSchema = z
  .object({
    ok: z.literal(true),
    url: z.string(),
    team: z.string(),
    team_id: z.string(),
    user: z.string(),
    user_id: z.string(),
    team_domain: z.string().optional(),
    user_team: z.string().optional(),
    bot_id: z.string().optional(),
  })
  .passthrough();

export const SlackConversationsListResponseSchema = z
  .object({
    ok: z.literal(true),
    channels: z.array(SlackChannelSchema),
    response_metadata: SlackResponseMetadataSchema.optional(),
  })
  .passthrough();

export type SlackConversationsListResponse = z.infer<
  typeof SlackConversationsListResponseSchema
>;

export const SlackConversationsHistoryResponseSchema = SlackMessagePageSchema;

export const SlackConversationsRepliesResponseSchema =
  SlackThreadResponseSchema;

export const SlackConversationsJoinResponseSchema = z
  .object({
    ok: z.literal(true),
    channel: SlackChannelSchema,
  })
  .passthrough();

export const SlackChatPostMessageResponseSchema = z
  .object({
    ok: z.literal(true),
    channel: z.string(),
    ts: z.string(),
    message: SlackMessageSchema,
    warning: z.string().optional(),
    response_metadata: SlackResponseMetadataSchema.optional(),
  })
  .passthrough();

export const SlackChatUpdateResponseSchema = z
  .object({
    ok: z.literal(true),
    channel: z.string(),
    ts: z.string(),
    text: z.string().optional(),
    // Slack sometimes returns a partial `message` object here (e.g., missing `ts`).
    // Accept a partial shape and let callers normalize/fallback as needed.
    message: SlackMessageSchema.partial().optional(),
  })
  .passthrough();

export const SlackChatDeleteResponseSchema = z
  .object({
    ok: z.literal(true),
    channel: z.string(),
    ts: z.string(),
  })
  .passthrough();

export const SlackReactionMutationResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .passthrough();

const SlackUsersProfileSchema = z
  .object({
    email: z.string().optional(),
    display_name: z.string().optional(),
    display_name_normalized: z.string().optional(),
    real_name: z.string().optional(),
    real_name_normalized: z.string().optional(),
    image_192: z.string().optional(),
    image_512: z.string().optional(),
  })
  .passthrough();

export const SlackUserSchema = z
  .object({
    id: z.string(),
    team_id: z.string().optional(),
    name: z.string(),
    real_name: z.string().optional(),
    deleted: z.boolean().optional(),
    is_bot: z.boolean().optional(),
    is_app_user: z.boolean().optional(),
    profile: SlackUsersProfileSchema.optional(),
  })
  .passthrough();

export type SlackUser = z.infer<typeof SlackUserSchema>;

export const SlackUsersListResponseSchema = z
  .object({
    ok: z.literal(true),
    members: z.array(SlackUserSchema),
    cache_ts: z.number().optional(),
    response_metadata: SlackResponseMetadataSchema.optional(),
  })
  .passthrough();

export type SlackUsersListResponse = z.infer<
  typeof SlackUsersListResponseSchema
>;

export const SlackConversationsOpenResponseSchema = z
  .object({
    ok: z.literal(true),
    channel: SlackChannelSchema,
    no_op: z.boolean().optional(),
    already_open: z.boolean().optional(),
  })
  .passthrough();

// Slack v2/external upload flow schemas
// Step 1: files.getUploadURLExternal
export const SlackFilesGetUploadURLExternalResponseSchema = z
  .object({
    ok: z.literal(true),
    upload_url: z.string(),
    file_id: z.string(),
    // Slack may return an ISO string or numeric epoch for expiry; accept either as string for flexibility
    upload_url_expires_at: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

// Step 2: files.completeUploadExternal
export const SlackFilesCompleteUploadExternalResponseSchema = z
  .object({
    ok: z.literal(true),
    files: z.array(SlackFileSchema),
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();
