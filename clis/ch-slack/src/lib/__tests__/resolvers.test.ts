import { describe, expect, it } from 'vitest';

import { createChannelResolver, createUserResolver } from '../resolvers.js';
import { type SlackChannel, type SlackUser } from '../schemas.js';

describe('channel resolver', () => {
  it('caches channel lookups by id and name', async () => {
    let calls = 0;
    const channel: SlackChannel = {
      id: 'C123',
      name: 'general',
      is_channel: true,
    };

    const resolver = createChannelResolver(
      async ({ cursor }) => {
        calls += 1;
        expect(cursor).toBeUndefined();
        return { channels: [channel], nextCursor: undefined };
      },
      {
        cache: { ttlMs: 5_000 },
      }
    );

    const first = await resolver.resolve('#general');
    expect(first).toEqual(channel);
    expect(calls).toBe(1);

    const second = await resolver.resolve('C123');
    expect(second).toEqual(channel);
    expect(calls).toBe(1);
  });

  it('refetches after TTL expires', async () => {
    let calls = 0;
    let now = 0;

    const resolver = createChannelResolver(
      async () => {
        calls += 1;
        return {
          channels: [{ id: 'C999', name: 'ops', is_channel: true }],
          nextCursor: undefined,
        };
      },
      {
        cache: {
          ttlMs: 1_000,
          now: () => now,
        },
      }
    );

    await resolver.resolve('ops');
    expect(calls).toBe(1);

    await resolver.resolve('ops');
    expect(calls).toBe(1);

    now = 2_000;
    await resolver.resolve('ops');
    expect(calls).toBe(2);
  });
});

describe('user resolver', () => {
  it('caches user by id, handle, display name, and email', async () => {
    let calls = 0;
    const user: SlackUser = {
      id: 'U123',
      name: 'alice',
      profile: {
        email: 'alice@example.com',
        display_name: 'Alice',
      },
    };

    const resolver = createUserResolver(
      async () => {
        calls += 1;
        return { users: [user], nextCursor: undefined };
      },
      {
        cache: { ttlMs: 10_000 },
      }
    );

    const byHandle = await resolver.resolve('@alice');
    expect(byHandle).toEqual(user);
    expect(calls).toBe(1);

    const byId = await resolver.resolve('U123');
    expect(byId).toEqual(user);
    expect(calls).toBe(1);

    const byEmail = await resolver.resolve('alice@example.com');
    expect(byEmail).toEqual(user);
    expect(calls).toBe(1);
  });
});
