import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type {
  ExportJobDto,
  ExportDownloadDto,
  CreateExportRequest,
} from '@/types';

export function useExportJob(id: string | null) {
  return useQuery({
    queryKey: queryKeys.exports.detail(id ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<ExportJobDto>(`/api/exports/${id ?? ''}`, signal),
    enabled: Boolean(id),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 5_000;
      return status === 'Queued' || status === 'InProgress' ? 3_000 : false;
    },
  });
}

export function useExportDownload(exportJobId: string | null) {
  return useQuery({
    queryKey: queryKeys.exports.download(exportJobId ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<ExportDownloadDto>(
        `/api/exports/${exportJobId ?? ''}/download`,
        signal,
      ),
    enabled: Boolean(exportJobId),
    staleTime: 60_000, // Download URLs are typically long-lived SAS URIs
  });
}

export function useCreateExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExportRequest) =>
      apiClient.post<ExportJobDto>('/api/exports', body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.exports.detail(data.id), data);
    },
  });
}
