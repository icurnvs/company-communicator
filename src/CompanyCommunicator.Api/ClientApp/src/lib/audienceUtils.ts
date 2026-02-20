import type { AudienceDto } from '@/types';

// Average member estimates per audience type.
const AVG_TEAM_SIZE = 50;
const AVG_GROUP_SIZE = 30;
const AVG_ROSTER_SIZE = 20;

/**
 * Build a human-readable audience summary from form state.
 */
export function buildAudienceSummary(
  allUsers: boolean,
  audiences: AudienceDto[] | null | undefined,
): { label: string; chipTypes: string[] } {
  if (allUsers) {
    return { label: 'All Users', chipTypes: ['All Users'] };
  }

  const list = audiences ?? [];
  if (list.length === 0) {
    return { label: '', chipTypes: [] };
  }

  const typeCounts: Record<string, number> = {};
  for (const a of list) {
    typeCounts[a.audienceType] = (typeCounts[a.audienceType] ?? 0) + 1;
  }

  const chips: string[] = [];
  if (typeCounts['Team']) chips.push(`${typeCounts['Team']} team${typeCounts['Team'] > 1 ? 's' : ''}`);
  if (typeCounts['Roster']) chips.push(`${typeCounts['Roster']} roster${typeCounts['Roster'] > 1 ? 's' : ''}`);
  if (typeCounts['Group']) chips.push(`${typeCounts['Group']} group${typeCounts['Group'] > 1 ? 's' : ''}`);

  return { label: chips.join(', '), chipTypes: chips };
}

/**
 * Rough reach estimate based on average member counts per audience type.
 * Returns null when the reach cannot be estimated (e.g., "All Users").
 */
export function estimateReach(
  allUsers: boolean,
  audiences: AudienceDto[] | null | undefined,
): number | null {
  if (allUsers) return null;
  const list = audiences ?? [];
  if (list.length === 0) return null;
  return list.reduce((sum, a) => {
    if (a.audienceType === 'Team') return sum + AVG_TEAM_SIZE;
    if (a.audienceType === 'Group') return sum + AVG_GROUP_SIZE;
    return sum + AVG_ROSTER_SIZE;
  }, 0);
}
