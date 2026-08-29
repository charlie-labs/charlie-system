#!/usr/bin/env bun

import { execute } from '@oclif/core';

// NodeNext + Bun resolve the .js specifier to the adjacent TypeScript source; this
// mirrors how other tests import from the helpers package.
import { handle } from '../src-under-test.js';

await execute({ dir: import.meta.url, development: true }).catch(handle);
