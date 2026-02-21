import { z } from 'zod';
import type { CreateNotificationRequest, UpdateNotificationRequest, CardSettings } from '@/types';

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

    // Content tab — Template mode
    templateId: z.string().nullable().optional(),
    themeId: z.string().optional(),
    slotVisibility: z.record(z.boolean()).optional(),

    // Content tab — Card preference mode
    cardPreference: z.enum(['Standard', 'Advanced', 'Template']).optional().nullable(),
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

    // Phase C: Additional slots (extended block types)
    additionalSlots: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum([
            // Phase C (Extended)
            'imageGallery',
            'statsRow',
            'quoteCallout',
            'columns',
            'table',
            'expandableSection',
            'iconTextRow',
            // Phase C2 — Content
            'richText',
            'icon',
            'badge',
            'codeBlock',
            'ratingDisplay',
            'compoundButton',
            // Phase C2 — Layout
            'flowLayout',
            'gridLayout',
            // Phase C2 — Charts
            'donutChart',
            'verticalBar',
            'groupedBar',
            'horizontalBar',
            'stackedBar',
            'lineChart',
            'gauge',
          ]),
          data: z.record(z.unknown()),
          order: z.number(),
        }),
      )
      .optional()
      .nullable(),

    // Phase C: Per-slot AC property overrides
    advancedOverrides: z.record(z.record(z.unknown())).optional().nullable(),

    // Phase C: Card-level settings
    cardSettings: z
      .object({
        fullWidth: z.boolean().optional(),
        accentColorOverride: z.string().nullable().optional(),
      })
      .optional()
      .nullable(),

    // Phase C: Slot ordering (user-defined, maps slotId → order number)
    slotOrder: z.record(z.number()).optional().nullable(),

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
  // When in Template mode, pack template metadata into cardPreference as JSON
  let cardPreference: string | null = values.cardPreference || null;
  if (values.cardPreference === 'Template' && values.templateId) {
    cardPreference = JSON.stringify({
      mode: 'Template' as const,
      templateId: values.templateId,
      themeId: values.themeId ?? 'theme-default',
      slotVisibility: values.slotVisibility ?? {},
      slotOrder: values.slotOrder ?? null,
      additionalSlots: values.additionalSlots ?? null,
      advancedOverrides: values.advancedOverrides ?? null,
      cardSettings: values.cardSettings ?? null,
    });
  }

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
    cardPreference,
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

// ---------------------------------------------------------------------------
// Template metadata parsing — extract templateId/themeId/slotVisibility from
// the serialized cardPreference field when loading an existing notification.
// ---------------------------------------------------------------------------

export interface TemplateMetadata {
  mode: 'Template';
  templateId: string;
  themeId: string;
  slotVisibility: Record<string, boolean>;
  slotOrder?: Record<string, number> | null;
  additionalSlots?: ComposeFormValues['additionalSlots'];
  advancedOverrides?: Record<string, Record<string, unknown>> | null;
  cardSettings?: CardSettings | null;
}

/** Parse template metadata from the cardPreference API field. */
export function parseTemplateMetadata(raw: string | null): TemplateMetadata | null {
  if (!raw) return null;
  // Legacy values are plain strings like "Standard" or "Advanced"
  if (raw === 'Standard' || raw === 'Advanced') return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.mode === 'Template' && typeof parsed.templateId === 'string') {
      return {
        mode: 'Template',
        templateId: parsed.templateId as string,
        themeId: (parsed.themeId as string) ?? 'theme-default',
        slotVisibility: (parsed.slotVisibility as Record<string, boolean>) ?? {},
        slotOrder: (parsed.slotOrder as Record<string, number>) ?? null,
        additionalSlots: (parsed.additionalSlots as TemplateMetadata['additionalSlots']) ?? null,
        advancedOverrides: (parsed.advancedOverrides as Record<string, Record<string, unknown>>) ?? null,
        cardSettings: (parsed.cardSettings as CardSettings) ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
