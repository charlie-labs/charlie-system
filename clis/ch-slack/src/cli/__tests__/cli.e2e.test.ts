import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Json = Record<string, unknown>;

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

function parseJson(stdout: string, stderr: string, context: string): Json {
  try {
    return JSON.parse(stdout) as Json;
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from ${context}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\nParse error: ${String(
        err
      )}`
    );
  }
}

function shouldRunE2E() {
  // eslint-disable-next-line no-process-env
  const enabled = process.env['CH_SLACK_E2E'] === '1';
  // eslint-disable-next-line no-process-env
  const token = process.env['SLACK_BOT_TOKEN'];
  // eslint-disable-next-line no-process-env
  const channel = process.env['SLACK_TEST_CHANNEL_ID'];
  return Boolean(enabled && token && token.trim() && channel && channel.trim());
}

function runCli(args: string[]) {
  const bin = path.resolve(packageRoot, 'bin', 'run.js');

  // Inherit env but do NOT set CH_SLACK_TEST_MODE — these are live calls.
  const env = {
    ...process.env, // eslint-disable-line no-process-env
    NO_COLORS: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };

  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(bin, args, {
        cwd: packageRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });

      // eslint-disable-next-line no-process-env
      const timeoutMs = Number(process.env['E2E_CMD_TIMEOUT'] ?? 120_000);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const finalize = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          child.kill('SIGKILL');
        } catch {}
        resolve({ code, stdout, stderr });
      };

      const timer = setTimeout(() => {
        stderr += '\nCommand timed out';
        finalize(124);
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (d) => (stdout += String(d)));
      child.stderr.on('data', (d) => (stderr += String(d)));
      child.on('close', (code) => finalize(code));
      child.on('error', (err) => {
        stderr += `\n${String(err)}`;
        // Use 1 as a generic spawn error code
        finalize(1);
      });
    }
  );
}

// Keep the whole suite sequential to avoid rate/ordering issues.
const suite = shouldRunE2E() ? describe.sequential : describe.skip;

suite('ch-slack CLI E2E (live Slack API)', () => {
  const runId = `run-${Date.now()}`;
  // eslint-disable-next-line no-process-env
  const channel = process.env['SLACK_TEST_CHANNEL_ID']!;

  it('auth whoami returns identity', async () => {
    const res = await runCli(['auth', 'whoami', '--json']);
    expect(res.code).toBe(0);
    const payload = parseJson(res.stdout, res.stderr, 'auth whoami');
    expect(payload).toMatchObject({ status: 'ok', command: 'auth.whoami' });
    expect(payload).toHaveProperty('identity');
    expect(res.stderr.trim()).toBe('');
  });

  it('CRUD flow: post → react → update → thread view → upload → delete', async () => {
    // 1) Post message (join first to handle private channels)
    const post = await runCli([
      'message',
      'post',
      '--channel',
      channel,
      '-j',
      '--text',
      `E2E ${runId}`,
      '--json',
    ]);
    if (post.code !== 0) {
      process.stderr.write(`message post stderr:\n${post.stderr}\n`);
      process.stderr.write(`message post stdout:\n${post.stdout}\n`);
    }
    expect(post.code).toBe(0);
    const posted = parseJson(post.stdout, post.stderr, 'message post');
    expect(posted).toMatchObject({ status: 'ok', command: 'message.post' });
    const ts = String((posted['result'] as Json)['ts']);
    const threadTs = String((posted['result'] as Json)['threadTs'] ?? ts);
    expect(ts).toMatch(/\d+\.\d{6}/);

    // 2) React (eyes)
    const react = await runCli([
      'react',
      'add',
      '--channel',
      channel,
      '--ts',
      ts,
      '-e',
      'eyes',
      '--json',
    ]);
    expect(react.code).toBe(0);
    const reacted = parseJson(react.stdout, react.stderr, 'react add');
    expect(reacted).toMatchObject({ status: 'ok', command: 'react.add' });

    // 3) Update
    const update = await runCli([
      'message',
      'update',
      '--channel',
      channel,
      '--ts',
      ts,
      '--text',
      'edited',
      '--json',
    ]);
    expect(update.code).toBe(0);
    const updated = parseJson(update.stdout, update.stderr, 'message update');
    expect(updated).toMatchObject({ status: 'ok', command: 'message.update' });

    // 4) Reply once so the thread has >1 message, then view thread (inclusive)
    const reply = await runCli([
      'message',
      'post',
      '--channel',
      channel,
      '--thread',
      threadTs,
      '--text',
      'reply-for-e2e',
      '--json',
    ]);
    expect(reply.code).toBe(0);

    const thread = await runCli([
      'thread',
      'view',
      '--channel',
      channel,
      '--ts',
      threadTs,
      '--inclusive',
      '--json',
    ]);
    expect(thread.code).toBe(0);
    const viewed = parseJson(thread.stdout, thread.stderr, 'thread view');
    expect(viewed).toMatchObject({ status: 'ok', command: 'thread.view' });
    const msgs = (viewed['result'] as Json)['messages'] as unknown[];
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.length).toBeGreaterThanOrEqual(1);

    // Note: The external files upload E2E was intentionally removed for now
    // due to invalid/broken workspace token permissions. We'll re-enable a live
    // upload check once tokens are fixed (see PR #16 discussion).
    // 5) Delete original message (cleanup)
    const del = await runCli([
      'message',
      'delete',
      '--channel',
      channel,
      '--ts',
      ts,
      '--json',
    ]);
    expect(del.code).toBe(0);
    const deleted = JSON.parse(del.stdout) as Json;
    expect(deleted).toMatchObject({ status: 'ok', command: 'message.delete' });
  });
});
