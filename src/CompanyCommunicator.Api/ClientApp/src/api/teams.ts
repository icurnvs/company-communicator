import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type { TeamDto } from '@/types';

export function useSearchTeams(query: string) {
  return useQuery({
    queryKey: queryKeys.teams.search(query),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ query });
      return apiClient.get<TeamDto[]>(
        `/api/teams?${params.toString()}`,
        signal,
      );
    },
    enabled: query.length >= 2, // Only search when at least 2 chars typed
    staleTime: 60_000,
    placeholderData: (prev) => prev, // Keep previous results while fetching
  });
}
