import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type {
  NotificationSummaryDto,
  NotificationDto,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  ScheduleNotificationRequest,
  DeliveryStatusDto,
  PaginatedResult,
} from '@/types';
import { TERMINAL_STATUSES } from '@/types';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// List (paginated)
// ---------------------------------------------------------------------------
interface UseNotificationsOptions {
  status: 'Draft' | 'Sent' | 'Scheduled';
  page?: number;
  pageSize?: number;
}

export function useNotifications(options: UseNotificationsOptions) {
  const { status, page = 1, pageSize = PAGE_SIZE } = options;

  return useQuery({
    queryKey: queryKeys.notifications.list({ status, page, pageSize }),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const { data, headers } = await apiClient.getWithHeaders<
        NotificationSummaryDto[]
      >(`/api/notifications?${params.toString()}`, signal);
      const totalCount = parseInt(
        headers.get('X-Total-Count') ?? '0',
        10,
      );
      return { items: data, totalCount } satisfies PaginatedResult<NotificationSummaryDto>;
    },
    staleTime: 30_000,
    // Auto-refresh the sent list while in-progress notifications exist
    refetchInterval: (query) => {
      if (status !== 'Sent') return false;
      const data = query.state.data;
      if (!data) return false;
      const hasInProgress = data.items.some(
        (n) => !TERMINAL_STATUSES.includes(n.status),
      );
      return hasInProgress ? 10_000 : false;
    },
  });
}

// ---------------------------------------------------------------------------
// Single notification detail
// ---------------------------------------------------------------------------
export function useNotification(
  id: string,
  options?: Partial<UseQueryOptions<NotificationDto>>,
) {
  return useQuery({
    queryKey: queryKeys.notifications.detail(id),
    queryFn: ({ signal }) =>
      apiClient.get<NotificationDto>(`/api/notifications/${id}`, signal),
    staleTime: 30_000,
    enabled: Boolean(id),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Delivery status (polled while not terminal)
// ---------------------------------------------------------------------------
export function useDeliveryStatus(id: string) {
  return useQuery({
    queryKey: queryKeys.notifications.status(id),
    queryFn: ({ signal }) =>
      apiClient.get<DeliveryStatusDto>(
        `/api/notifications/${id}/status`,
        signal,
      ),
    staleTime: 5_000,
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 10_000;
      return TERMINAL_STATUSES.includes(status) ? false : 10_000;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNotificationRequest) =>
      apiClient.post<NotificationDto>('/api/notifications', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function useUpdateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateNotificationRequest;
    }) => apiClient.put<NotificationDto>(`/api/notifications/${id}`, body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.notifications.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/notifications/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.notifications.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<void>(`/api/notifications/${id}/send`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.notifications.detail(id),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function useScheduleNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ScheduleNotificationRequest;
    }) =>
      apiClient.post<NotificationDto>(
        `/api/notifications/${id}/schedule`,
        body,
      ),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.notifications.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function useCancelNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<NotificationDto>(`/api/notifications/${id}/cancel`),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.notifications.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
}

export function usePreviewNotification() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<void>(`/api/notifications/${id}/preview`),
  });
}
