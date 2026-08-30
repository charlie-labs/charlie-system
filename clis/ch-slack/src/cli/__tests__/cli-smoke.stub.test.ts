import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

function runCli(args: string[]) {
  const bin = path.resolve(packageRoot, 'bin', 'run.js');

  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(bin, args, {
        cwd: packageRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env, // eslint-disable-line no-process-env
          CH_SLACK_TEST_MODE: '1',
          SLACK_BOT_TOKEN: 'xoxb-test-token',
          NO_COLORS: '1',
        },
      });

      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (d) => (stdout += String(d)));
      child.stderr.on('data', (d) => (stderr += String(d)));
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    }
  );
}

describe('ch-slack CLI smoke tests', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-process-env
    process.env['NO_COLORS'] = '1';
  });

  it('auth whoami without --json does not print JSON to stdout', async () => {
    const res = await runCli(['auth', 'whoami']);

    expect(res.code).toBe(0);
    expect(res.stdout.trim()).toBe('');
  });

  it('auth whoami --json prints structured payload and suppresses stderr', async () => {
    const res = await runCli(['auth', 'whoami', '--json']);

    expect(res.code).toBe(0);

    const parsed = JSON.parse(res.stdout);
    expect(parsed).toHaveProperty('status', 'ok');
    expect(parsed).toHaveProperty('command', 'auth.whoami');
    expect(parsed).toHaveProperty('identity');

    expect(res.stderr.trim()).toBe('');
  });

  it('message post requires flags and succeeds', async () => {
    const res = await runCli([
      'message',
      'post',
      '--channel',
      'C01234567',
      '--text',
      'hello',
      '--json',
    ]);

    expect(res.code).toBe(0);
    const payload = JSON.parse(res.stdout);
    expect(payload).toHaveProperty('status', 'ok');
    expect(payload).toHaveProperty('command', 'message.post');
    expect(payload).toHaveProperty('result');
    expect(res.stderr.trim()).toBe('');
  });

  it('channel list --json returns a bounded list and respects --limit', async () => {
    const res = await runCli(['channel', 'list', '--limit', '1', '--json']);

    expect(res.code).toBe(0);
    const payload = JSON.parse(res.stdout);
    expect(payload).toMatchObject({ status: 'ok', command: 'channel.list' });
    expect(Array.isArray(payload.channels)).toBe(true);
    expect(payload.channels.length).toBeLessThanOrEqual(1);
    if (payload.channels.length === 1) {
      const ch = payload.channels[0];
      expect(ch).toHaveProperty('id');
      expect(ch).toHaveProperty('name');
    }
    expect(res.stderr.trim()).toBe('');
  });

  it('message lifecycle: post → react add/remove → thread view → update → delete', async () => {
    // Post a message and capture ts/threadTs
    const postRes = await runCli([
      'message',
      'post',
      '--channel',
      'C01234567',
      '--text',
      'hello world',
      '--json',
    ]);
    expect(postRes.code).toBe(0);
    const post = JSON.parse(postRes.stdout);
    expect(post).toMatchObject({ status: 'ok', command: 'message.post' });
    const ts: string = post.result.ts;
    const threadTs: string = post.result.threadTs;
    expect(typeof ts).toBe('string');
    expect(typeof threadTs).toBe('string');

    // Add a reaction
    const reactAddRes = await runCli([
      'react',
      'add',
      '--channel',
      'C01234567',
      '--ts',
      ts,
      '--emoji',
      'eyes',
      '--json',
    ]);
    expect(reactAddRes.code).toBe(0);
    const reactAdd = JSON.parse(reactAddRes.stdout);
    expect(reactAdd).toMatchObject({
      status: 'ok',
      command: 'react.add',
      channel: 'C01234567',
      ts,
      emoji: 'eyes',
    });

    // Remove the reaction
    const reactRemoveRes = await runCli([
      'react',
      'remove',
      '--channel',
      'C01234567',
      '--ts',
      ts,
      '--emoji',
      'eyes',
      '--json',
    ]);
    expect(reactRemoveRes.code).toBe(0);
    const reactRemove = JSON.parse(reactRemoveRes.stdout);
    expect(reactRemove).toMatchObject({
      status: 'ok',
      command: 'react.remove',
      channel: 'C01234567',
      ts,
      emoji: 'eyes',
    });

    // View the thread at the post's root ts
    const threadViewRes = await runCli([
      'thread',
      'view',
      '--channel',
      'C01234567',
      '--ts',
      threadTs,
      '--json',
    ]);
    expect(threadViewRes.code).toBe(0);
    const threadView = JSON.parse(threadViewRes.stdout);
    expect(threadView).toHaveProperty('status', 'ok');
    expect(threadView).toHaveProperty('command', 'thread.view');
    expect(threadView).toHaveProperty('result');
    expect(threadView.result).toHaveProperty('threadTs', threadTs);
    expect(Array.isArray(threadView.result.messages)).toBe(true);
    expect(threadView.result.messages.length).toBeGreaterThanOrEqual(1);

    // Update the message text
    const updateRes = await runCli([
      'message',
      'update',
      '--channel',
      'C01234567',
      '--ts',
      ts,
      '--text',
      'edited',
      '--json',
    ]);
    expect(updateRes.code).toBe(0);
    const update = JSON.parse(updateRes.stdout);
    expect(update).toMatchObject({ status: 'ok', command: 'message.update' });
    expect(update.result).toMatchObject({
      ts,
      text: 'edited\n\n',
      type: 'message',
    });

    // Finally, delete the message
    const deleteRes = await runCli([
      'message',
      'delete',
      '--channel',
      'C01234567',
      '--ts',
      ts,
      '--json',
    ]);
    expect(deleteRes.code).toBe(0);
    const del = JSON.parse(deleteRes.stdout);
    expect(del).toMatchObject({ status: 'ok', command: 'message.delete' });
    expect(del).toHaveProperty('channel', 'C01234567');
    expect(del).toHaveProperty('ts', ts);
    expect(del.result).toMatchObject({ channel: 'C01234567', ts });
  });

  it('files upload --json uploads a tiny temp file', async () => {
    // Create a tiny temp file in a temp dir; ensure cleanup even if the test fails
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-slack-'));
    try {
      const filePath = path.join(tmpDir, 'tiny.txt');
      await fs.writeFile(filePath, 'hi');

      const res = await runCli([
        'files',
        'upload',
        '--channel',
        'C01234567',
        '--file',
        filePath,
        '--title',
        'tiny',
        '--initialComment',
        'here',
        '--json',
      ]);

      expect(res.code).toBe(0);
      const payload = JSON.parse(res.stdout);
      expect(payload).toMatchObject({ status: 'ok', command: 'files.upload' });
      // Stub returns a deterministic file id
      expect(payload.result?.file?.id).toBe('FTEST');
      expect(typeof payload.result?.file?.url_private).toBe('string');
      expect(res.stderr.trim()).toBe('');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
