#!/usr/bin/env bun

import { handle } from '@charlie-labs/oclif-plugin-helpers';
import { run } from '@oclif/core';

await run(undefined, import.meta.url).catch(handle);
