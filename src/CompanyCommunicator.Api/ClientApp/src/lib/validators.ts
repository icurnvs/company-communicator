import { z } from 'zod';
import type { CreateNotificationRequest, UpdateNotificationRequest } from '@/types';

// ---------------------------------------------------------------------------
// Audience schema
// ---------------------------------------------------------------------------
export const audienceDtoSchema = z.object({
  audienceType: z.enum(['Team', 'Roster', 'Group']),
  audienceId: z.string().min(1),
  displayName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Key detail pair schema
// ---------------------------------------------------------------------------
export const keyDetailPairSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string().min(1, 'Value is required'),
});

// ---------------------------------------------------------------------------
// Custom variable schema
// ---------------------------------------------------------------------------
export const customVariableSchema = z.object({
  name: z.string().min(1, 'Variable name is required'),
  value: z.string(),
});

// ---------------------------------------------------------------------------
// Compose form schema (used by react-hook-form with Zod resolver)
// Covers both Create and Update with the redesigned card builder fields
// ---------------------------------------------------------------------------
export const composeFormSchema = z
  .object({
    // Content tab — Standard mode
    headline: z
      .string()
      .min(1, 'Headline is required')
      .max(200, 'Headline cannot exceed 200 characters'),

    body: z.string().max(4000).optional().nullable(),

    imageLink: z
      .string()
      .url('Must be a valid URL')
      .refine((v) => v.startsWith('https://'), 'Image URL must use HTTPS')
      .optional()
      .nullable()
      .or(z.literal('')),

    keyDetails: z.array(keyDetailPairSchema).optional().nullable(),

    buttonTitle: z.string().max(200).optional().nullable(),

    buttonLink: z
      .string()
      .url('Must be a valid URL')
      .refine((v) => v.startsWith('https://'), 'Button URL must use HTTPS')
      .optional()
      .nullable()
      .or(z.literal('')),

    secondaryText: z
      .string()
      .max(2000, 'Secondary text cannot exceed 2000 characters')
      .optional()
      .nullable(),

    // Content tab — Dynamic variables
    customVariables: z.array(customVariableSchema).optional().nullable(),

    // Content tab — Advanced mode
    cardPreference: z.enum(['Standard', 'Advanced']).optional().nullable(),
    advancedBlocks: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum([
            'ColumnLayout',
            'ImageSet',
            'TextBlock',
            'Table',
            'ActionButton',
            'Divider',
          ]),
          data: z.record(z.unknown()),
        }),
      )
      .optional()
      .nullable(),

    // Audience tab
    allUsers: z.boolean(),
    audiences: z.array(audienceDtoSchema).optional().nullable(),
  })
  .refine(
    (data) => {
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
      if (data.allUsers) return true;
      return (data.audiences ?? []).length > 0;
    },
    {
      message:
        'At least one audience is required. Select "All Users" or choose specific teams or groups.',
      path: ['audiences'],
    },
  );

export type ComposeFormValues = z.infer<typeof composeFormSchema>;

// Keep the old schema name as alias for backwards compat during migration
export const notificationFormSchema = composeFormSchema;
export type NotificationFormValues = ComposeFormValues;

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
// Helpers — convert form values to API request shapes
// ---------------------------------------------------------------------------
function formToApiFields(values: ComposeFormValues) {
  return {
    title: values.headline,
    summary: values.body || null,
    imageLink: values.imageLink || null,
    buttonTitle: values.buttonTitle || null,
    buttonLink: values.buttonLink || null,
    allUsers: values.allUsers,
    audiences: values.allUsers ? null : (values.audiences ?? null),
    keyDetails: values.keyDetails?.length
      ? JSON.stringify(values.keyDetails)
      : null,
    secondaryText: values.secondaryText || null,
    customVariables:
      values.customVariables?.length
        ? JSON.stringify(
            Object.fromEntries(
              values.customVariables.map((v) => [v.name, v.value]),
            ),
          )
        : null,
    advancedBlocks: values.advancedBlocks?.length
      ? JSON.stringify(values.advancedBlocks)
      : null,
    cardPreference: values.cardPreference || null,
  };
}

export function formValuesToCreateRequest(
  values: ComposeFormValues,
): CreateNotificationRequest {
  return formToApiFields(values);
}

export function formValuesToUpdateRequest(
  values: ComposeFormValues,
): UpdateNotificationRequest {
  return formToApiFields(values);
}
