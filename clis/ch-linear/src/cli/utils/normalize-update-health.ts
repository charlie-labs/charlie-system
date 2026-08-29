import { ProjectUpdateHealthType } from '../../generated/linear-sdk.js';
import { ValidationError } from '../../lib/errors/index.js';

/**
 * Normalize free-form health strings into the Linear ProjectUpdateHealthType enum.
 *
 * Accepts common variants such as:
 * - onTrack: "on", "on-track", "on_track", "ontrack"
 * - atRisk:  "risk", "at-risk", "at_risk", "atrisk"
 * - offTrack: "off", "off-track", "off_track", "offtrack"
 *
 * @param raw Free-form health string
 * @returns ProjectUpdateHealthType
 * @throws ValidationError when the value is missing or invalid
 */
export function normalizeUpdateHealth(raw: string): ProjectUpdateHealthType {
  if (!raw) {
    throw new ValidationError(
      'Invalid --health. Valid values: onTrack, atRisk, offTrack'
    );
  }
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '');
  switch (s) {
    case 'ontrack':
    case 'on':
      return ProjectUpdateHealthType.OnTrack;
    case 'atrisk':
    case 'risk':
      return ProjectUpdateHealthType.AtRisk;
    case 'offtrack':
    case 'off':
      return ProjectUpdateHealthType.OffTrack;
    default:
      throw new ValidationError(
        'Invalid --health. Valid values: onTrack, atRisk, offTrack'
      );
  }
}
