import { type SentryIssue } from './sentry-api.js';

/** Minimal shape for annotations we care about in CLI outputs. */
export type IssueAnnotation = { displayName?: string; url?: string };

/** Convenience augmentation for JSON responses that surface Linear link. */
export type IssueWithLinear = SentryIssue & { linearUrl?: string };
