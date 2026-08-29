import {
  CommonFlags,
  defineFlags,
  type ParsedOf,
} from '@charlie-labs/oclif-plugin-helpers';

const manifest = defineFlags(CommonFlags);
type CommonParsed = ParsedOf<typeof manifest>;

const parsed: CommonParsed = manifest.parse({
  start: '2026-06-24',
});

parsed.start?.toISOString();
parsed.limit.toFixed();
parsed.status.map((status) => status.toUpperCase());
