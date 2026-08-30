import {
  SlackClient,
  type SlackHttpClient,
  type SlackHttpResponse,
} from '../../lib/index.js';
import { resolveToken } from './parse.js';

function makeTestHttp(): SlackHttpClient {
  return {
    async request(options): Promise<SlackHttpResponse> {
      const ok = { ok: true } as const;
      switch (options.path) {
        case 'auth.test':
          return {
            data: {
              ...ok,
              url: 'https://test.slack.com',
              team: 'Test Team',
              team_id: 'TTEST',
              user: 'test-bot',
              user_id: 'UTEST',
            },
            status: 200,
            headers: new Headers(),
          };
        case 'conversations.list':
          return {
            data: {
              ...ok,
              channels: [
                { id: 'C01234567', name: 'general', is_channel: true },
              ],
            },
            status: 200,
            headers: new Headers(),
          };
        case 'conversations.history':
          return {
            data: {
              ...ok,
              messages: [
                {
                  type: 'message',
                  ts: '1726512000.000100',
                  text: 'hello',
                  user: 'UTEST',
                },
                {
                  type: 'message',
                  ts: '1726515600.000200',
                  text: 'world',
                  user: 'UTEST',
                },
              ],
              has_more: false,
              response_metadata: { next_cursor: '' },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'conversations.replies':
          return {
            data: {
              ...ok,
              messages: [
                {
                  type: 'message',
                  ts: '1726512000.000100',
                  text: 'parent',
                  user: 'UTEST',
                },
                {
                  type: 'message',
                  ts: '1726515600.000200',
                  text: 'reply',
                  user: 'UTEST',
                },
              ],
              has_more: false,
              response_metadata: { next_cursor: '' },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'conversations.open':
          return {
            data: {
              ...ok,
              channel: { id: 'DTEST', name: 'directmessage', is_im: true },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'conversations.join':
          return {
            data: {
              ...ok,
              channel: {
                id: 'C01234567',
                name: 'general',
                is_channel: true,
                is_member: true,
              },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'chat.postMessage': {
          // Echo back request inputs to improve test fidelity
          const payload = options.json as Record<string, unknown> | undefined;
          const textVal = payload?.['text'];
          const pmText = typeof textVal === 'string' ? textVal : 'hello';
          const chVal =
            typeof payload?.['channel'] === 'string'
              ? (payload!['channel'] as string)
              : 'C01234567';
          return {
            data: {
              ...ok,
              channel: chVal,
              ts: '1726519200.000300',
              message: {
                type: 'message',
                ts: '1726519200.000300',
                text: String(pmText),
              },
            },
            status: 200,
            headers: new Headers(),
          };
        }
        case 'chat.update': {
          const payload = options.json as Record<string, unknown> | undefined;
          const textVal = payload?.['text'];
          const upText = typeof textVal === 'string' ? textVal : 'edited';
          const chVal =
            typeof payload?.['channel'] === 'string'
              ? (payload!['channel'] as string)
              : 'C01234567';
          return {
            data: {
              ...ok,
              channel: chVal,
              ts: '1726519200.000300',
              message: {
                type: 'message',
                ts: '1726519200.000300',
                text: String(upText),
              },
            },
            status: 200,
            headers: new Headers(),
          };
        }
        case 'chat.delete': {
          const payload = options.json as Record<string, unknown> | undefined;
          const chVal =
            typeof payload?.['channel'] === 'string'
              ? (payload!['channel'] as string)
              : 'C01234567';
          const tsVal =
            typeof payload?.['ts'] === 'string'
              ? (payload!['ts'] as string)
              : '1726519200.000300';
          return {
            data: {
              ...ok,
              channel: chVal,
              ts: tsVal,
            },
            status: 200,
            headers: new Headers(),
          };
        }
        case 'reactions.add':
        case 'reactions.remove':
          return { data: { ...ok }, status: 200, headers: new Headers() };
        case 'users.list':
          return {
            data: {
              ...ok,
              members: [
                { id: 'UTEST', name: 'test-user', is_bot: false },
                { id: 'WTEST', name: 'test-bot', is_bot: true },
              ],
              response_metadata: { next_cursor: '' },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'files.upload':
          return {
            data: {
              ...ok,
              file: {
                id: 'FTEST',
                name: 'upload',
                url_private: 'https://test.slack.com/files/FTEST',
              },
            },
            status: 200,
            headers: new Headers(),
          };
        case 'files.getUploadURLExternal':
          return {
            data: {
              ...ok,
              upload_url: 'https://upload.test/slack',
              file_id: 'FTEST',
              upload_url_expires_at: '2099-01-01T00:00:00Z',
            },
            status: 200,
            headers: new Headers(),
          } as SlackHttpResponse;
        case 'files.completeUploadExternal':
          return {
            data: {
              ...ok,
              files: [
                {
                  id: 'FTEST',
                  name: 'upload',
                  url_private: 'https://test.slack.com/files/FTEST',
                },
              ],
            },
            status: 200,
            headers: new Headers(),
          } as SlackHttpResponse;
        default:
          return {
            data: { ...ok },
            status: 200,
            headers: new Headers(),
          } as SlackHttpResponse;
      }
    },
  };
}

function makeTestFetch(): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    // Pretend all external uploads succeed in stub mode
    if (method === 'POST') {
      return new Response('', { status: 200, headers: new Headers() });
    }
    return new Response('', { status: 200, headers: new Headers() });
  }) as typeof fetch;
}

function createClient(token: string): SlackClient {
  // eslint-disable-next-line no-process-env
  if (process.env['CH_SLACK_TEST_MODE'] === '1') {
    return new SlackClient({
      token,
      http: makeTestHttp(),
      fetch: makeTestFetch(),
    });
  }
  return new SlackClient({ token });
}

export type SlackCommandDeps = { token: string; client: SlackClient };

export function buildSlackDeps(
  parsed: { token?: string | undefined }
): SlackCommandDeps {
  const token = resolveToken(parsed.token);
  const client = createClient(token);
  return { token, client };
}
