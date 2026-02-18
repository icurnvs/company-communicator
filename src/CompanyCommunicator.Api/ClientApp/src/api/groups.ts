import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type { GroupDto } from '@/types';

export function useSearchGroups(query: string) {
  return useQuery({
    queryKey: queryKeys.groups.search(query),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ query });
      return apiClient.get<GroupDto[]>(
        `/api/groups?${params.toString()}`,
        signal,
      );
    },
    enabled: query.length >= 2, // Only search when at least 2 chars typed
    staleTime: 60_000,
    placeholderData: (prev) => prev, // Keep previous results while fetching
  });
}
