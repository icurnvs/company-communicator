import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type { TeamDto } from '@/types';

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.list(),
    queryFn: ({ signal }) =>
      apiClient.get<TeamDto[]>('/api/teams', signal),
    staleTime: 5 * 60_000, // Teams list changes infrequently
  });
}
