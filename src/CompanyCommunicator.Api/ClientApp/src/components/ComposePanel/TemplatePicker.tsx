import { useState } from 'react';
import type { ComponentType } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
} from '@fluentui/react-components';
import type { FluentIconsProps } from '@fluentui/react-icons';
import {
  ChevronDownRegular,
  ChevronUpRegular,
  Dismiss16Regular,
  MegaphoneRegular,
  CalendarRegular,
  AlertUrgentRegular,
  LinkRegular,
  ClipboardTaskRegular,
  DocumentOnePage20Regular,
  PeopleRegular,
  ShieldCheckmarkRegular,
  StarRegular,
} from '@fluentui/react-icons';
import { useTemplates, useDeleteTemplate } from '@/api/templates';
import {
  BUILTIN_TEMPLATE_DEFINITIONS,
  BLANK_TEMPLATE_ID,
} from '@/lib/templateDefinitions';
import { templateToFormDefaults } from '@/lib/formBridge';
import type { TemplateDefinition, CardSchema } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';

// ---------------------------------------------------------------------------
// Icon lookup — maps TemplateDefinition.iconName to Fluent icon components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, ComponentType<FluentIconsProps>> = {
  DocumentOnePage: DocumentOnePage20Regular,
  Megaphone: MegaphoneRegular,
  Calendar: CalendarRegular,
  AlertUrgent: AlertUrgentRegular,
  Link: LinkRegular,
  ClipboardTask: ClipboardTaskRegular,
  People: PeopleRegular,
  ShieldCheckmark: ShieldCheckmarkRegular,
  Star: StarRegular,
};

function resolveIcon(iconName: string): ComponentType<FluentIconsProps> {
  return ICON_MAP[iconName] ?? DocumentOnePage20Regular;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: `${tokens.spacingVerticalXS} 0`,
    width: '100%',
    textAlign: 'left',
    color: tokens.colorNeutralForeground2,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },

  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'inherit',
  },

  toggleIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    paddingBottom: tokens.spacingVerticalS,
  },

  divider: {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase100,
  },

  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
  },

  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    transitionProperty: 'border-color, box-shadow, transform',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: tokens.shadow4,
      transform: 'translateY(-1px)',
    },
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorBrandStroke1,
      outlineOffset: '2px',
    },
  },

  cardAccent: {
    height: '4px',
    flexShrink: 0,
  },

  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    flex: 1,
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  cardIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },

  cardName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
  },

  cardDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },

  cardFeatures: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  },

  deleteBtn: {
    position: 'absolute',
    top: '8px',
    right: '4px',
    opacity: 0,
    ':focus-visible': {
      opacity: 1,
    },
  },

  cardWrapper: {
    position: 'relative',
    ':hover button[data-delete]': {
      opacity: 1,
    },
  },

  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXS} 0`,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Apply a legacy CardSchema to the RHF form (for custom API templates). */
function applySchema(form: UseFormReturn<ComposeFormValues>, schema: CardSchema) {
  form.setValue('headline', schema.headline ?? '', { shouldDirty: true, shouldTouch: true });
  form.setValue('body', schema.body ?? null, { shouldDirty: true });
  form.setValue('imageLink', schema.imageLink ?? null, { shouldDirty: true });
  form.setValue('keyDetails', schema.keyDetails ?? null, { shouldDirty: true });
  form.setValue('buttonTitle', schema.buttonTitle ?? null, { shouldDirty: true });
  form.setValue('buttonLink', schema.buttonLink ?? null, { shouldDirty: true });
  form.setValue('secondaryText', schema.secondaryText ?? null, { shouldDirty: true });
  if (schema.cardPreference) {
    form.setValue('cardPreference', schema.cardPreference, { shouldDirty: true });
  }
  if (schema.advancedBlocks !== undefined) {
    form.setValue('advancedBlocks', schema.advancedBlocks ?? null, { shouldDirty: true });
  }
}

/** Apply new TemplateDefinition defaults to the form. */
function applyTemplateDefaults(
  form: UseFormReturn<ComposeFormValues>,
  template: TemplateDefinition,
) {
  const defaults = templateToFormDefaults(template);
  for (const [key, value] of Object.entries(defaults)) {
    form.setValue(
      key as keyof ComposeFormValues,
      value as ComposeFormValues[keyof ComposeFormValues],
      { shouldDirty: true },
    );
  }
}

/** Derive feature tags from a template's slots. */
function getSlotFeatures(template: TemplateDefinition): string[] {
  const tags: string[] = [];
  const types = new Set(template.slots.map((s) => s.type));
  if (types.has('heroImage')) tags.push('Image');
  if (types.has('keyDetails')) tags.push('Facts');
  if (types.has('linkButton')) tags.push('Button');
  if (types.has('footer')) tags.push('Footnote');
  return tags;
}

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  name: string;
  description: string;
  icon: ComponentType<FluentIconsProps>;
  accentColor: string;
  features?: string[];
  onSelect: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function TemplateCard({
  name,
  description,
  icon: Icon,
  accentColor,
  features,
  onSelect,
  onDelete,
  isDeleting,
}: TemplateCardProps) {
  const styles = useStyles();

  return (
    <div className={styles.cardWrapper}>
      <button
        type="button"
        className={styles.card}
        onClick={onSelect}
        aria-label={`Use ${name} template`}
      >
        <div className={styles.cardAccent} style={{ backgroundColor: accentColor }} />
        <div className={styles.cardBody}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} style={{ color: accentColor }}>
              <Icon aria-hidden="true" />
            </span>
            <span className={styles.cardName}>{name}</span>
          </div>
          <span className={styles.cardDescription}>{description}</span>
          {features && features.length > 0 && (
            <div className={styles.cardFeatures}>
              {features.map((f) => (
                <Badge key={f} appearance="outline" size="small" color="informative">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </button>

      {onDelete && (
        <Button
          data-delete="true"
          appearance="subtle"
          size="small"
          icon={<Dismiss16Regular />}
          className={styles.deleteBtn}
          aria-label={`Delete ${name} template`}
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ opacity: isDeleting ? 1 : undefined }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplatePickerProps {
  form: UseFormReturn<ComposeFormValues>;
  /** When true (edit mode), the picker starts collapsed. */
  defaultCollapsed?: boolean;
  /** Called after a built-in template is applied to the form. */
  onTemplateSelect?: (template: TemplateDefinition) => void;
}

// ---------------------------------------------------------------------------
// TemplatePicker
// ---------------------------------------------------------------------------

export function TemplatePicker({
  form,
  defaultCollapsed = false,
  onTemplateSelect,
}: TemplatePickerProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const { data: customTemplates, isLoading: isLoadingTemplates } = useTemplates();
  const deleteTemplateMutation = useDeleteTemplate();

  // ---------------------------------------------------------------------------
  // Built-in template selection
  // ---------------------------------------------------------------------------

  const handleSelectBuiltin = (template: TemplateDefinition) => {
    const isDirty = form.formState.isDirty;
    const isBlank = template.id === BLANK_TEMPLATE_ID;

    const doApply = () => {
      applyTemplateDefaults(form, template);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
      onTemplateSelect?.(template);
    };

    if (isBlank && !isDirty) return; // no-op

    if (isDirty) {
      setPendingAction({
        message: isBlank
          ? 'Clear current content and start with a blank card?'
          : 'Replace current content with this template?',
        onConfirm: doApply,
      });
      return;
    }

    doApply();
  };

  // ---------------------------------------------------------------------------
  // Custom template selection (legacy CardSchema)
  // ---------------------------------------------------------------------------

  const handleSelectCustom = (schema: CardSchema) => {
    const isDirty = form.formState.isDirty;

    const doApply = () => {
      applySchema(form, schema);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
    };

    if (isDirty) {
      setPendingAction({
        message: 'Replace current content with this template?',
        onConfirm: doApply,
      });
      return;
    }

    doApply();
  };

  // ---------------------------------------------------------------------------
  // Custom template delete
  // ---------------------------------------------------------------------------

  const handleDelete = (id: string) => {
    setPendingAction({
      message: 'Delete this custom template?',
      onConfirm: () => {
        setDeletingId(id);
        deleteTemplateMutation.mutate(id, {
          onSettled: () => { setDeletingId(null); },
        });
      },
    });
  };

  const parseCustomSchema = (raw: string): CardSchema | null => {
    try {
      return JSON.parse(raw) as CardSchema;
    } catch {
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggleRow}
        onClick={() => { setExpanded((prev) => !prev); }}
        aria-expanded={expanded}
        aria-controls="template-picker-grid"
      >
        <span className={styles.toggleLabel}>Templates</span>
        <span className={styles.toggleIcon} aria-hidden="true">
          {expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
        </span>
      </button>

      {expanded && (
        <div id="template-picker-grid" className={styles.grid}>
          {BUILTIN_TEMPLATE_DEFINITIONS.map((t) => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              icon={resolveIcon(t.iconName)}
              accentColor={t.accentColor}
              features={getSlotFeatures(t)}
              onSelect={() => { handleSelectBuiltin(t); }}
            />
          ))}

          {/* Custom templates — shown after a divider */}
          {isLoadingTemplates && (
            <div className={styles.loadingRow} style={{ gridColumn: '1 / -1' }}>
              <Spinner size="tiny" />
              <Text size={100}>Loading saved templates...</Text>
            </div>
          )}

          {!isLoadingTemplates && (customTemplates?.length ?? 0) > 0 && (
            <>
              <div className={styles.divider}>
                <span className={styles.dividerLine} />
                <span>Saved</span>
                <span className={styles.dividerLine} />
              </div>

              {customTemplates!.map((t) => {
                const schema = parseCustomSchema(t.cardSchema);
                if (!schema) return null;
                return (
                  <TemplateCard
                    key={t.id}
                    name={t.name}
                    description={t.description ?? ''}
                    icon={DocumentOnePage20Regular}
                    accentColor="#8a8886"
                    onSelect={() => { handleSelectCustom(schema); }}
                    onDelete={() => { handleDelete(t.id); }}
                    isDeleting={deletingId === t.id}
                  />
                );
              })}
            </>
          )}
        </div>
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(_e, data) => { if (!data.open) setPendingAction(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Confirm</DialogTitle>
            <DialogContent>{pendingAction?.message}</DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => { setPendingAction(null); }}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  pendingAction?.onConfirm();
                  setPendingAction(null);
                }}
              >
                Confirm
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
