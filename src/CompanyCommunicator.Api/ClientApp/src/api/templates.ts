import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import type {
  TemplateDto,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@/types';

// ---------------------------------------------------------------------------
// List user's templates
// ---------------------------------------------------------------------------
export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) =>
      apiClient.get<TemplateDto[]>('/api/templates', signal),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateRequest) =>
      apiClient.post<TemplateDto>('/api/templates', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.templates.list() });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTemplateRequest }) =>
      apiClient.put<TemplateDto>(`/api/templates/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.templates.list() });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.templates.list() });
    },
  });
}
