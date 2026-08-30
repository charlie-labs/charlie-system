import { TTLCache, type TTLCacheOptions } from './cache.js';
import { SlackApiError } from './errors.js';
import {
  type SlackChannel,
  type SlackConversationsListResponse,
  type SlackUser,
  type SlackUsersListResponse,
} from './schemas.js';

export type ChannelPageFetcher = (
  args: { cursor?: string | undefined }
) => Promise<{
  channels: SlackConversationsListResponse['channels'];
  nextCursor?: string | undefined;
}>;

export type UserPageFetcher = (
  args: { cursor?: string | undefined }
) => Promise<{
  users: SlackUsersListResponse['members'];
  nextCursor?: string | undefined;
}>;

export interface ChannelResolverOptions {
  readonly cache?: Partial<TTLCacheOptions> | undefined;
}

export interface UserResolverOptions {
  readonly cache?: Partial<TTLCacheOptions> | undefined;
}

export interface SlackChannelResolver {
  resolve(input: string): Promise<SlackChannel>;
  prime(channels: readonly SlackChannel[]): void;
  clear(): void;
}

export interface SlackUserResolver {
  resolve(input: string): Promise<SlackUser>;
  prime(users: readonly SlackUser[]): void;
  clear(): void;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

export function createChannelResolver(
  fetchPage: ChannelPageFetcher,
  options?: ChannelResolverOptions
): SlackChannelResolver {
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const maxSize = options?.cache?.maxSize;
  const now = options?.cache?.now;

  const channelById = new TTLCache<string, SlackChannel>({
    ttlMs,
    maxSize,
    now,
  });
  const channelByName = new TTLCache<string, SlackChannel>({
    ttlMs,
    maxSize,
    now,
  });

  function cacheChannel(channel: SlackChannel): void {
    channelById.set(normalizeId(channel.id), channel);
    if (typeof channel.name === 'string' && channel.name.length > 0) {
      channelByName.set(normalizeChannelName(channel.name), channel);
    }
  }

  async function resolve(input: string): Promise<SlackChannel> {
    const trimmed = input.trim();
    const idCandidate = normalizePotentialId(trimmed);
    if (idCandidate) {
      const cached = channelById.get(idCandidate);
      if (cached) {
        return cached;
      }
    }

    const nameCandidate = normalizeChannelName(trimmed);
    const cachedByName = channelByName.get(nameCandidate);
    if (cachedByName) {
      return cachedByName;
    }

    let cursor: string | undefined;
    do {
      const { channels, nextCursor } = await fetchPage({ cursor });
      for (const channel of channels) {
        cacheChannel(channel);
      }

      if (idCandidate) {
        const matchById = channelById.get(idCandidate);
        if (matchById) {
          return matchById;
        }
      }

      const matchByName = channelByName.get(nameCandidate);
      if (matchByName) {
        return matchByName;
      }

      cursor = nextCursor && nextCursor.length > 0 ? nextCursor : undefined;
    } while (cursor);

    throw new SlackApiError(`Channel not found: ${input}`, {
      status: 404,
      code: 'channel_not_found',
    });
  }

  function prime(channels: readonly SlackChannel[]): void {
    for (const channel of channels) {
      cacheChannel(channel);
    }
  }

  function clear(): void {
    channelById.clear();
    channelByName.clear();
  }

  return { resolve, prime, clear };
}

export function createUserResolver(
  fetchPage: UserPageFetcher,
  options?: UserResolverOptions
): SlackUserResolver {
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const maxSize = options?.cache?.maxSize;
  const now = options?.cache?.now;

  const userById = new TTLCache<string, SlackUser>({ ttlMs, maxSize, now });
  const userByName = new TTLCache<string, SlackUser>({ ttlMs, maxSize, now });
  const userByEmail = new TTLCache<string, SlackUser>({ ttlMs, maxSize, now });

  function cacheUser(user: SlackUser): void {
    userById.set(normalizeId(user.id), user);

    if (typeof user.name === 'string' && user.name.length > 0) {
      userByName.set(normalizeUserName(user.name), user);
    }

    if (typeof user.real_name === 'string' && user.real_name.length > 0) {
      userByName.set(normalizeUserName(user.real_name), user);
    }

    const profile = user.profile;
    if (profile) {
      if (
        typeof profile.display_name === 'string' &&
        profile.display_name.length > 0
      ) {
        userByName.set(normalizeUserName(profile.display_name), user);
      }

      if (
        typeof profile.display_name_normalized === 'string' &&
        profile.display_name_normalized.length > 0
      ) {
        userByName.set(
          normalizeUserName(profile.display_name_normalized),
          user
        );
      }

      if (
        typeof profile.real_name === 'string' &&
        profile.real_name.length > 0
      ) {
        userByName.set(normalizeUserName(profile.real_name), user);
      }

      if (
        typeof profile.real_name_normalized === 'string' &&
        profile.real_name_normalized.length > 0
      ) {
        userByName.set(normalizeUserName(profile.real_name_normalized), user);
      }

      if (typeof profile.email === 'string' && profile.email.length > 0) {
        userByEmail.set(normalizeEmail(profile.email), user);
      }
    }
  }

  async function resolve(input: string): Promise<SlackUser> {
    const trimmed = input.trim();
    const idCandidate = normalizePotentialId(trimmed, ['U', 'W']);

    if (idCandidate) {
      const cached = userById.get(idCandidate);
      if (cached) {
        return cached;
      }
    }

    const emailCandidate = isLikelyEmail(trimmed)
      ? normalizeEmail(trimmed)
      : undefined;
    if (emailCandidate) {
      const cachedEmail = userByEmail.get(emailCandidate);
      if (cachedEmail) {
        return cachedEmail;
      }
    }

    const nameCandidate = normalizeUserName(trimmed);
    const cachedByName = userByName.get(nameCandidate);
    if (cachedByName) {
      return cachedByName;
    }

    let cursor: string | undefined;
    do {
      const { users, nextCursor } = await fetchPage({ cursor });
      for (const user of users) {
        if (user.deleted) {
          continue;
        }
        cacheUser(user);
      }

      if (idCandidate) {
        const match = userById.get(idCandidate);
        if (match) {
          return match;
        }
      }

      if (emailCandidate) {
        const matchByEmail = userByEmail.get(emailCandidate);
        if (matchByEmail) {
          return matchByEmail;
        }
      }

      const matchByName = userByName.get(nameCandidate);
      if (matchByName) {
        return matchByName;
      }

      cursor = nextCursor && nextCursor.length > 0 ? nextCursor : undefined;
    } while (cursor);

    throw new SlackApiError(`User not found: ${input}`, {
      status: 404,
      code: 'user_not_found',
    });
  }

  function prime(users: readonly SlackUser[]): void {
    for (const user of users) {
      if (user.deleted) {
        continue;
      }
      cacheUser(user);
    }
  }

  function clear(): void {
    userById.clear();
    userByName.clear();
    userByEmail.clear();
  }

  return { resolve, prime, clear };
}

function normalizeId(input: string): string {
  return input.trim().toUpperCase();
}

function normalizePotentialId(
  input: string,
  prefixes: string[] = ['C', 'G', 'D']
): string | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const upper = trimmed.toUpperCase();
  return prefixes.some((prefix) => upper.startsWith(prefix))
    ? upper
    : undefined;
}

function normalizeChannelName(input: string): string {
  const trimmed = input.trim();
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  return withoutHash.toLowerCase();
}

function normalizeUserName(input: string): string {
  const trimmed = input.trim();
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return withoutAt.toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLikelyEmail(value: string): boolean {
  return value.includes('@');
}
