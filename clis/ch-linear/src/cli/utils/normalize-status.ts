import { InitiativeStatus } from '../../generated/linear-sdk.js';

export function normalizeStatus(raw?: string): InitiativeStatus | undefined {
  if (!raw) return undefined;
  switch (raw.trim().toLowerCase()) {
    case 'planned':
      return InitiativeStatus.Planned;
    case 'active':
      return InitiativeStatus.Active;
    case 'completed':
      return InitiativeStatus.Completed;
    default:
      throw new Error(
        `Invalid status "${raw}". Valid values are planned, active, completed.`
      );
  }
}
