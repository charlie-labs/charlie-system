import { type Hook } from '@oclif/core';

import { errorToExitCode } from '../../errors/index.js';

const hook: Hook.Finally = async function (opts) {
  if (opts.error && (!process.exitCode || process.exitCode === 0)) {
    process.exitCode = errorToExitCode(opts.error);
  }
};

export default hook;
