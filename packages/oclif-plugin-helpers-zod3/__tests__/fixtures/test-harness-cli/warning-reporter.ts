// Bun omits warning codes from its default stderr rendering, so expose the code
// for lifecycle assertions without changing the command under test.
process.on('warning', (warning) => {
  const code = (warning as Error & { code?: unknown }).code;
  if (typeof code === 'string') {
    process.stderr.write(`[${code}] ${warning.message}\n`);
  }
});
