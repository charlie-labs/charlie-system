#!/usr/bin/env bun

import { systemGreeting } from '@charlie-labs/system-core';

const name = Bun.argv[2] ?? 'world';

console.log(systemGreeting(name));
