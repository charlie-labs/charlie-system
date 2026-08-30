import { expect, test } from 'bun:test';

import EventList from '../events/list.js';
import EventView from '../events/view.js';
import IssuesList from '../issues/list.js';
import IssuesOverview from '../issues/overview.js';
import IssuesView from '../issues/view.js';
import ProjectsList from '../projects/list.js';
import ProjectsView from '../projects/view.js';
import ReleasesList from '../releases/list.js';
import TagsList from '../tags/list.js';
import TagsValues from '../tags/values.js';

test('registers all Sentry command metadata', () => {
  expect([
    EventList.description,
    EventView.description,
    IssuesList.description,
    IssuesOverview.description,
    IssuesView.description,
    ProjectsList.description,
    ProjectsView.description,
    ReleasesList.description,
    TagsList.description,
    TagsValues.description,
  ]).toEqual([
    'List recent events for a specific Sentry issue',
    'View details of a specific event for a Sentry issue',
    'List and search Sentry issues for a project',
    'Generate an overview of Sentry issues across projects for a time window.',
    'View detailed information for a specific Sentry issue',
    'List all Sentry projects for the organization',
    'Display details for a specific Sentry project',
    'List recent releases for an organization',
    'List tags available for a project',
    'List distinct values for a specific tag key',
  ]);
});
