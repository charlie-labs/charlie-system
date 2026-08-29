import { Flags } from '@oclif/core';

import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type ExecCtxOf,
  zString,
  // NodeNext + Bun resolve the .js specifier to the adjacent TypeScript source; keeping
  // the .js suffix matches the rest of the test suite.
} from '../src-under-test.js';

const manifest = defineFlags({
  insight: {
    oclif: Flags.string({
      description: 'Insight text',
      required: true,
    }),
    schema: zString(),
  },
  corpus: {
    oclif: Flags.string({
      description: 'Corpus name',
    }),
    schema: zString().optional(),
  },
});

export default class UsesRegisterManifest extends BaseCommand<
  CfgFlags<typeof manifest>
> {
  static override id = 'uses-register-manifest';
  static override enableJsonFlag = true as const;
  static override flags = super.registerManifest(manifest);

  protected override async execute({ parsed }: ExecCtxOf<this>) {
    this.log(JSON.stringify(parsed));
    return undefined;
  }
}
