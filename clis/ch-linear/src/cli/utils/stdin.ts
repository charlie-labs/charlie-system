/**
 * Read entire stdin as a UTF‑8 string. Returns an empty string immediately
 * when stdin is a TTY (no pipe/heredoc), avoiding interactive blocking.
 */
export async function readAllStdin(): Promise<string> {
  const { stdin } = process;
  if (stdin.isTTY) return '';
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    stdin.once('error', (err) => reject(err));
    stdin.once('end', () => resolve(data));
    // Ensure the stream is flowing
    try {
      stdin.resume();
    } catch {
      // ignore
    }
  });
}
