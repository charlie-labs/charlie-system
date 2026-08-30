import {
  BaseCommand,
  type ExecCtxOf,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Customer Need topic entry-point.
 */
export default class CustomerNeedTopic extends BaseCommand {
  static description =
    'Work with customer needs – list, create, update, archive';

  static examples = ['$ <%= config.bin %> customer-need list'];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected override async execute(_ctx: ExecCtxOf<this>): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
