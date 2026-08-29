export { ApplyPatchError } from './core/errors.js';
export { applyPatch } from './runtime/apply-patch.js';
export { applyPatchWithReport } from './runtime/apply-patch-with-report.js';

/* FS adapters */
export { nodeFs } from './runtime/fs/node.js';
export { bunFs } from './runtime/fs/bun.js';
export { createMemoryFs, memoryFs } from './runtime/fs/memory.js';
