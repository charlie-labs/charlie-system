import { assert, type IProperty } from 'fast-check';

import { fastCheckParameters } from './fast-check.js';

export function assertParserProperty<Ts extends [unknown, ...unknown[]]>(
  property: IProperty<Ts>
): void {
  assert(property, fastCheckParameters);
}
