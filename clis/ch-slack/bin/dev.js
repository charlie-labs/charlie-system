#!/usr/bin/env bun

import { handle } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { execute } from '@oclif/core';

import { maybePrintVersionAndExit } from './shared/version.js';

await maybePrintVersionAndExit(undefined, import.meta.url);

await execute({ development: true, dir: import.meta.url }).catch(handle);
