/* eslint-disable no-process-env */
import { expect, test } from 'bun:test';

import { requireLinearAuthHeaderValueFromEnv } from '../env.js';

type EnvSnapshot = {
  LINEAR_ACCESS_TOKEN: string | undefined;
  LINEAR_API_KEY: string | undefined;
};

function snapshotEnv(): EnvSnapshot {
  return {
    LINEAR_ACCESS_TOKEN: process.env['LINEAR_ACCESS_TOKEN'],
    LINEAR_API_KEY: process.env['LINEAR_API_KEY'],
  };
}

function restoreEnv(snapshot: EnvSnapshot): void {
  if (snapshot.LINEAR_ACCESS_TOKEN === undefined) {
    delete process.env['LINEAR_ACCESS_TOKEN'];
  } else {
    process.env['LINEAR_ACCESS_TOKEN'] = snapshot.LINEAR_ACCESS_TOKEN;
  }

  if (snapshot.LINEAR_API_KEY === undefined) {
    delete process.env['LINEAR_API_KEY'];
  } else {
    process.env['LINEAR_API_KEY'] = snapshot.LINEAR_API_KEY;
  }
}

test('requireLinearAuthHeaderValueFromEnv prefers LINEAR_ACCESS_TOKEN (Bearer)', () => {
  const snapshot = snapshotEnv();
  try {
    process.env['LINEAR_ACCESS_TOKEN'] = 'token_123';
    process.env['LINEAR_API_KEY'] = 'lin_api_abc';

    expect(requireLinearAuthHeaderValueFromEnv()).toBe('Bearer token_123');
  } finally {
    restoreEnv(snapshot);
  }
});

test('requireLinearAuthHeaderValueFromEnv falls back to LINEAR_API_KEY (no Bearer)', () => {
  const snapshot = snapshotEnv();
  try {
    delete process.env['LINEAR_ACCESS_TOKEN'];
    process.env['LINEAR_API_KEY'] = 'lin_api_abc';

    expect(requireLinearAuthHeaderValueFromEnv()).toBe('lin_api_abc');
  } finally {
    restoreEnv(snapshot);
  }
});

test('requireLinearAuthHeaderValueFromEnv treats empty LINEAR_ACCESS_TOKEN as unset', () => {
  const snapshot = snapshotEnv();
  try {
    process.env['LINEAR_ACCESS_TOKEN'] = '   ';
    process.env['LINEAR_API_KEY'] = 'lin_api_abc';

    expect(requireLinearAuthHeaderValueFromEnv()).toBe('lin_api_abc');
  } finally {
    restoreEnv(snapshot);
  }
});

test('requireLinearAuthHeaderValueFromEnv throws when no credentials are present', () => {
  const snapshot = snapshotEnv();
  try {
    delete process.env['LINEAR_ACCESS_TOKEN'];
    delete process.env['LINEAR_API_KEY'];

    try {
      requireLinearAuthHeaderValueFromEnv();
      throw new Error('expected requireLinearAuthHeaderValueFromEnv to throw');
    } catch (err) {
      if (!(err instanceof Error)) {
        throw new Error('Expected an Error instance');
      }
      expect(err.message).toBe(
        'Required environment variable LINEAR_ACCESS_TOKEN or LINEAR_API_KEY is not set'
      );
    }
  } finally {
    restoreEnv(snapshot);
  }
});
