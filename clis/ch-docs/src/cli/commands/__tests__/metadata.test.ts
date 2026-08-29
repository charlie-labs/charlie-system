import { expect, test } from 'bun:test';

import Feedback from '../feedback.js';
import Filesystem from '../filesystem.js';
import Full from '../full.js';
import Index from '../index/index.js';
import Page from '../page.js';
import Search from '../search.js';

test('registers all ch-docs command metadata', () => {
  expect([
    Feedback.summary,
    Filesystem.summary,
    Full.summary,
    Index.summary,
    Page.summary,
    Search.summary,
  ]).toEqual([
    'Submit documentation feedback',
    'Run a read-only filesystem command',
    'Read the full documentation corpus',
    'Read the documentation index',
    'Read one documentation page',
    'Search the documentation',
  ]);
});
