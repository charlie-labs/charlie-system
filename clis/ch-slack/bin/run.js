#!/usr/bin/env bun

// Always import oclif up-front to avoid divergent side-effects from lazy loading.
import { handle } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { execute } from '@oclif/core';

import { maybePrintVersionAndExit } from './shared/version.js';

// Preserve raw version output contract while no longer deferring the oclif import.
await maybePrintVersionAndExit(undefined, import.meta.url);

await execute({ dir: import.meta.url }).catch(handle);
