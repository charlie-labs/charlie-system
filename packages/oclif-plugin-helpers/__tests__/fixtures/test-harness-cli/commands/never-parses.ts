import { Command } from '@oclif/core';

export default class NeverParses extends Command {
  static override id = 'never-parses';

  public override run(): Promise<void> {
    return Promise.resolve();
  }
}
