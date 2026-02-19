// Hierarchical TanStack Query key factory
// All keys are typed as `const` tuples for precise cache invalidation

export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: { status?: string; page?: number; pageSize?: number }) =>
      [...queryKeys.notifications.lists(), filters] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notifications.details(), id] as const,
    status: (id: string) =>
      [...queryKeys.notifications.all, 'status', id] as const,
  },
  teams: {
    all: ['teams'] as const,
    search: (query: string) =>
      [...queryKeys.teams.all, 'search', query] as const,
  },
  groups: {
    all: ['groups'] as const,
    search: (query: string) =>
      [...queryKeys.groups.all, 'search', query] as const,
  },
  exports: {
    all: ['exports'] as const,
    detail: (id: string) => [...queryKeys.exports.all, id] as const,
    download: (id: string) =>
      [...queryKeys.exports.all, id, 'download'] as const,
  },
} as const;
