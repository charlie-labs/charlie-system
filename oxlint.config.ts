import { defineConfig, type OxlintOverride } from 'oxlint';

const basePlugins = [
  'import',
  'oxc',
  'promise',
  'typescript',
  'unicorn',
] as const;

const systemImportRestrictions = [
  { message: 'Use injected Flywheel dependencies.', name: 'bun' },
  {
    message: 'Use the injected process capability.',
    name: 'node:child_process',
  },
  {
    allowTypeImports: true,
    message: 'Use the injected filesystem capability.',
    name: 'node:fs',
  },
  {
    message: 'Use the injected filesystem capability.',
    name: 'node:fs/promises',
  },
  {
    message: 'Use explicit inputs or injected dependencies.',
    name: 'node:process',
  },
];

const semanticLayers = [
  'artifacts',
  'graph',
  'projection',
  'references',
  'targets',
  'validation',
] as const;
const restrictedLayers = {
  content: ['presets'],
  presets: [...semanticLayers, 'content', 'repository', 'retrieval'],
  repository: [...semanticLayers, 'content', 'presets', 'retrieval'],
  retrieval: ['content', 'presets'],
  runtime: [...semanticLayers, 'content', 'presets', 'repository', 'retrieval'],
} as const;

type OxlintRules = NonNullable<OxlintOverride['rules']>;
type RestrictedImportsRule = NonNullable<OxlintRules['no-restricted-imports']>;

const restrictedRuntimeGlobals: NonNullable<
  OxlintRules['no-restricted-globals']
> = [
  'error',
  { message: 'Use the injected Flywheel runtime.', name: 'Bun' },
  { message: 'Use explicit inputs or injected dependencies.', name: 'process' },
];

function architectureImportRule(
  forbiddenLayers: readonly string[],
  allowSystemImports = false
): RestrictedImportsRule {
  const patterns = [
    {
      message: 'Flywheel library components must not depend on CLI modules.',
      regex: '(^|/)cli(/|$)',
    },
  ];
  if (forbiddenLayers.length > 0) {
    patterns.push({
      message: `This component must not depend on higher-level Flywheel components: ${forbiddenLayers.join(', ')}.`,
      regex: `(^|/)(${forbiddenLayers.join('|')})(/|$)`,
    });
  }
  return [
    'error',
    {
      paths: allowSystemImports ? [] : systemImportRestrictions,
      patterns,
    },
  ];
}

const flywheelArchitectureOverrides: OxlintOverride[] = [
  {
    files: ['clis/flywheel/src/lib/**/*.ts'],
    rules: {
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'typescript/consistent-type-exports': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/explicit-module-boundary-types': 'error',
    },
  },
  {
    files: ['clis/flywheel/src/lib/**/*.ts'],
    excludeFiles: [
      '**/__tests__/**',
      'clis/flywheel/src/lib/repository/source/**',
      'clis/flywheel/src/lib/runtime/**',
    ],
    rules: {
      'no-restricted-globals': restrictedRuntimeGlobals,
      'no-restricted-imports': architectureImportRule([]),
    },
  },
  {
    files: ['clis/flywheel/src/lib/runtime/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.runtime,
        true
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/repository/source/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-globals': restrictedRuntimeGlobals,
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.repository,
        true
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/repository/*.ts'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.repository
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/retrieval/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.retrieval
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/content/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(restrictedLayers.content),
    },
  },
  {
    files: ['clis/flywheel/src/lib/presets/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(restrictedLayers.presets),
    },
  },
];

export default defineConfig({
  ignorePatterns: [
    'clis/apply-patch/**',
    'clis/ch-linear/**',
    'clis/ch-outline/**',
    'clis/ch-sentry/**',
    'clis/ch-slack/**',
    'coverage/**',
    'dist/**',
    'packages/format-for/**',
    'packages/oclif-plugin-helpers/**',
    'packages/oclif-plugin-helpers-zod3/**',
  ],
  plugins: [...basePlugins],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    pedantic: 'error',
    perf: 'error',
  },
  options: {
    typeAware: true,
  },
  rules: {
    complexity: [
      'error',
      {
        max: 10,
        variant: 'classic',
      },
    ],
    'max-depth': [
      'error',
      {
        max: 3,
      },
    ],
    'max-lines': [
      'error',
      {
        max: 300,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    'max-lines-per-function': [
      'error',
      {
        max: 60,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      },
    ],
    'max-nested-callbacks': [
      'error',
      {
        max: 3,
      },
    ],
    'max-params': [
      'error',
      {
        max: 4,
      },
    ],
    'no-nested-ternary': 'error',
    'no-param-reassign': 'error',
    'require-await': 'off',
    'typescript/ban-ts-comment': [
      'error',
      {
        minimumDescriptionLength: 10,
        'ts-check': false,
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
      },
    ],
    'typescript/consistent-type-assertions': [
      'error',
      {
        assertionStyle: 'never',
      },
    ],
    'typescript/no-confusing-void-expression': 'error',
    'typescript/no-deprecated': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unsafe-argument': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
    'typescript/no-unsafe-type-assertion': 'error',
    'typescript/only-throw-error': 'error',
    'typescript/prefer-readonly-parameter-types': 'off',
    'typescript/promise-function-async': 'off',
    'typescript/require-await': 'error',
    'typescript/strict-boolean-expressions': 'error',
    'typescript/switch-exhaustiveness-check': 'error',
    'typescript/use-unknown-in-catch-callback-variable': 'error',
    'import/no-commonjs': [
      'error',
      {
        allowConditionalRequire: false,
        allowPrimitiveModules: false,
        allowRequire: false,
      },
    ],
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-namespace': 'error',
    'import/no-unassigned-import': 'error',
    'unicorn/no-abusive-eslint-disable': 'error',
  },
  overrides: flywheelArchitectureOverrides,
});
