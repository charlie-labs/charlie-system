const test = require('node:test');
const assert = require('node:assert/strict');

const {
  duplicateNames,
  extractMarkdownLinks,
  parseFrontMatter,
  scanTextForSecrets,
  validateRepository,
} = require('./validate.ts');

test('validates the checked-in public repository', () => {
  const result = validateRepository();
  assert.deepEqual(result.errors, []);
});

test('parses required skill front matter', () => {
  assert.deepEqual(
    parseFrontMatter('---\nname: public-skill\ndescription: Public guidance\n---\n\n# Skill'),
    { name: 'public-skill', description: 'Public guidance' },
  );
  assert.equal(parseFrontMatter('# Missing metadata'), null);
});

test('extracts relative and external Markdown links', () => {
  assert.deepEqual(
    extractMarkdownLinks('[guide](docs/guide.md) and [site](https://example.com)'),
    ['docs/guide.md', 'https://example.com'],
  );
});

test('reports duplicate names without treating them as errors', () => {
  assert.deepEqual(
    duplicateNames([
      { name: 'same', source: 'one' },
      { name: 'same', source: 'two' },
      { name: 'other', source: 'three' },
    ]),
    [{ name: 'same', sources: ['one', 'two'] }],
  );
});

test('detects common credential patterns', () => {
  const privateKeyMarker = `-----BEGIN ${'PRIVATE KEY'}-----`;
  const secretAssignment = `${'secret'}: "not-a-real-secret-but-long-enough"`;
  assert.deepEqual(scanTextForSecrets(privateKeyMarker), ['private key']);
  assert.deepEqual(scanTextForSecrets(secretAssignment), ['quoted secret assignment']);
  assert.deepEqual(scanTextForSecrets('ordinary public text'), []);
});
