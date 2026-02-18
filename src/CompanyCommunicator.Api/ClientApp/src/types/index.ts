// TypeScript interfaces matching backend C# DTOs (camelCase JSON)

export interface NotificationDto {
  id: string;
  title: string;
  summary: string | null;
  imageLink: string | null;
  imageBlobName: string | null;
  buttonTitle: string | null;
  buttonLink: string | null;
  author: string | null;
  createdBy: string | null;
  createdDate: string; // ISO datetime
  scheduledDate: string | null;
  sentDate: string | null;
  status: NotificationStatus;
  allUsers: boolean;
  totalRecipientCount: number;
  succeededCount: number;
  failedCount: number;
  recipientNotFoundCount: number;
  canceledCount: number;
  unknownCount: number;
  errorMessage: string | null;
  audiences: AudienceDto[];
}

export interface NotificationSummaryDto {
  id: string;
  title: string;
  author: string | null;
  createdDate: string;
  scheduledDate: string | null;
  sentDate: string | null;
  status: NotificationStatus;
  totalRecipientCount: number;
  succeededCount: number;
  failedCount: number;
}

export type NotificationStatus =
  | 'Draft'
  | 'Scheduled'
  | 'Queued'
  | 'SyncingRecipients'
  | 'InstallingApp'
  | 'Sending'
  | 'Sent'
  | 'Canceled'
  | 'Failed';

export const TERMINAL_STATUSES: NotificationStatus[] = ['Sent', 'Canceled', 'Failed'];

export const IN_PROGRESS_STATUSES: NotificationStatus[] = [
  'Queued',
  'SyncingRecipients',
  'InstallingApp',
  'Sending',
];

export interface AudienceDto {
  audienceType: 'Team' | 'Roster' | 'Group';
  audienceId: string;
}

export interface CreateNotificationRequest {
  title: string;
  summary?: string | null;
  imageLink?: string | null;
  buttonTitle?: string | null;
  buttonLink?: string | null;
  allUsers: boolean;
  audiences?: AudienceDto[] | null;
}

export interface UpdateNotificationRequest {
  title: string;
  summary?: string | null;
  imageLink?: string | null;
  buttonTitle?: string | null;
  buttonLink?: string | null;
  allUsers: boolean;
  audiences?: AudienceDto[] | null;
}

export interface ScheduleNotificationRequest {
  scheduledDate: string; // ISO datetime
}

export interface DeliveryStatusDto {
  notificationId: string;
  status: NotificationStatus;
  totalRecipientCount: number;
  succeededCount: number;
  failedCount: number;
  recipientNotFoundCount: number;
  canceledCount: number;
  unknownCount: number;
}

export interface TeamDto {
  teamId: string;
  name: string | null;
}

export interface GroupDto {
  groupId: string;
  displayName: string | null;
}

export interface ExportJobDto {
  id: string;
  notificationId: string;
  requestedBy: string | null;
  requestedDate: string;
  status: 'Queued' | 'InProgress' | 'Completed' | 'Failed';
  fileName: string | null;
  errorMessage: string | null;
}

export interface ExportDownloadDto {
  exportJobId: string;
  downloadUri: string;
}

export interface CreateExportRequest {
  notificationId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
}

export type NotificationTab = 'Draft' | 'Sent' | 'Scheduled';

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}
