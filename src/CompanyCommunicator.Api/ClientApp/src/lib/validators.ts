import { z } from 'zod';

// ---------------------------------------------------------------------------
// Audience schema
// ---------------------------------------------------------------------------
export const audienceDtoSchema = z.object({
  audienceType: z.enum(['Team', 'Roster', 'Group']),
  audienceId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Notification form schema (used by react-hook-form with Zod resolver)
// This covers both Create and Update operations
// ---------------------------------------------------------------------------
export const notificationFormSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title cannot exceed 200 characters'),

    summary: z.string().max(4000).optional().nullable(),

    imageLink: z
      .string()
      .url('Must be a valid URL')
      .refine((v) => v.startsWith('https://'), 'Image URL must use HTTPS')
      .optional()
      .nullable()
      .or(z.literal('')),

    buttonTitle: z.string().max(200).optional().nullable(),

    buttonLink: z
      .string()
      .url('Must be a valid URL')
      .refine((v) => v.startsWith('https://'), 'Button URL must use HTTPS')
      .optional()
      .nullable()
      .or(z.literal('')),

    allUsers: z.boolean(),

    audiences: z.array(audienceDtoSchema).optional().nullable(),
  })
  .refine(
    (data) => {
      // Button title and link must both be set or both be empty
      const hasTitle = Boolean(data.buttonTitle?.trim());
      const hasLink = Boolean(data.buttonLink?.trim());
      return hasTitle === hasLink;
    },
    {
      message:
        'Both button title and button URL are required when either is set',
      path: ['buttonLink'],
    },
  )
  .refine(
    (data) => {
      // At least one audience is required
      if (data.allUsers) return true;
      return (data.audiences ?? []).length > 0;
    },
    {
      message:
        'At least one audience is required. Select "All Users" or choose specific teams or groups.',
      path: ['audiences'],
    },
  );

export type NotificationFormValues = z.infer<typeof notificationFormSchema>;

// ---------------------------------------------------------------------------
// Schedule form schema
// ---------------------------------------------------------------------------
export const scheduleFormSchema = z.object({
  scheduledDate: z
    .date()
    .refine((d) => d > new Date(), 'Scheduled date must be in the future'),
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formValuesToCreateRequest(values: NotificationFormValues) {
  return {
    title: values.title,
    summary: values.summary || null,
    imageLink: values.imageLink || null,
    buttonTitle: values.buttonTitle || null,
    buttonLink: values.buttonLink || null,
    allUsers: values.allUsers,
    audiences: values.allUsers ? null : (values.audiences ?? null),
  };
}
