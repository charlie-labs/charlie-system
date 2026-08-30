import { expect, test } from 'bun:test';

import {
  ApiRequestError,
  createLinearClient,
  getIssue,
  listIssues,
  listProjects,
  MemoryCacheProvider,
  NotFoundError,
  paginateConnection,
  PaginationError,
} from '../index.js';

test('lib layer exposes only named exports for primary symbols', () => {
  // Functions/classes should be present as named exports
  expect(typeof createLinearClient).toBe('function');
  expect(typeof MemoryCacheProvider).toBe('function');
  expect(typeof getIssue).toBe('function');
  expect(typeof listIssues).toBe('function');
  expect(typeof listProjects).toBe('function');
  expect(typeof paginateConnection).toBe('function');

  // Error classes should also be available
  expect(typeof ApiRequestError).toBe('function');
  expect(typeof PaginationError).toBe('function');
  expect(typeof NotFoundError).toBe('function');
});
