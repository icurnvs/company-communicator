import { useState } from 'react';
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
import { ChevronDownRegular, ChevronUpRegular, Dismiss16Regular } from '@fluentui/react-icons';
import { useTemplates, useDeleteTemplate } from '@/api/templates';
import {
  BLANK_TEMPLATE,
  BLANK_TEMPLATE_ID,
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from '@/lib/builtinTemplates';
import type { CardSchema } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  // Collapsible header row
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

  // Grid of template cards
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    paddingBottom: tokens.spacingVerticalS,
  },

  // Divider between built-in and custom templates
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

  // Individual template card — redesigned with accent header
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
      borderColor: tokens.colorBrandStroke1,
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

  // Colored accent strip at the top
  cardAccent: {
    height: '4px',
    flexShrink: 0,
  },

  // Card body content
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    flex: 1,
  },

  // Icon + name row
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
    // Clamp to 2 lines
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },

  // Feature tags row
  cardFeatures: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  },

  // Delete button overlay on custom template cards
  deleteBtn: {
    position: 'absolute',
    top: '8px',
    right: '4px',
    opacity: 0,
    ':focus-visible': {
      opacity: 1,
    },
  },

  // Wrapper makes delete button visible on card hover
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

/** Determine whether the form has any user-entered content. */
function formHasContent(values: ComposeFormValues): boolean {
  return (
    Boolean(values.headline?.trim()) ||
    Boolean(values.body?.trim()) ||
    Boolean(values.imageLink?.trim()) ||
    Boolean(values.buttonTitle?.trim()) ||
    Boolean(values.buttonLink?.trim()) ||
    Boolean(values.secondaryText?.trim()) ||
    (values.keyDetails?.length ?? 0) > 0
  );
}

/** Apply a CardSchema to the RHF form. */
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

// ---------------------------------------------------------------------------
// TemplateCard — individual card in the grid
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  name: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
        {/* Colored accent strip */}
        <div className={styles.cardAccent} style={{ backgroundColor: accentColor }} />

        <div className={styles.cardBody}>
          {/* Icon + name row */}
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} style={{ color: accentColor }}>
              <Icon aria-hidden="true" />
            </span>
            <span className={styles.cardName}>{name}</span>
          </div>

          {/* Description */}
          <span className={styles.cardDescription}>{description}</span>

          {/* Feature tags */}
          {features && features.length > 0 && (
            <div className={styles.cardFeatures}>
              {features.map((f) => (
                <Badge
                  key={f}
                  appearance="outline"
                  size="small"
                  color="informative"
                >
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
}

// ---------------------------------------------------------------------------
// TemplatePicker
// ---------------------------------------------------------------------------

export function TemplatePicker({ form, defaultCollapsed = false }: TemplatePickerProps) {
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
  // Template selection
  // ---------------------------------------------------------------------------

  const handleSelect = (schema: CardSchema, templateId: string) => {
    const values = form.getValues();
    const hasContent = formHasContent(values);

    // If the user selects blank and form is already empty, no-op
    if (templateId === BLANK_TEMPLATE_ID && !hasContent) {
      return;
    }

    if (hasContent && templateId !== BLANK_TEMPLATE_ID) {
      setPendingAction({
        message: 'Replace current content with this template?',
        onConfirm: () => { applySchema(form, schema); },
      });
      return;
    }

    if (hasContent && templateId === BLANK_TEMPLATE_ID) {
      setPendingAction({
        message: 'Clear current content and start with a blank card?',
        onConfirm: () => { applySchema(form, schema); },
      });
      return;
    }

    applySchema(form, schema);
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

  // ---------------------------------------------------------------------------
  // Parse custom template schema safely
  // ---------------------------------------------------------------------------

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
      {/* Toggle header */}
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

      {/* Collapsible grid */}
      {expanded && (
        <div id="template-picker-grid" className={styles.grid}>
          {/* Blank card — always first */}
          <TemplateCard
            name={BLANK_TEMPLATE.name}
            description={BLANK_TEMPLATE.description}
            icon={BLANK_TEMPLATE.icon}
            accentColor={BLANK_TEMPLATE.accentColor}
            onSelect={() => { handleSelect(BLANK_TEMPLATE.schema, BLANK_TEMPLATE.id); }}
          />

          {/* Built-in templates */}
          {BUILTIN_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              icon={t.icon}
              accentColor={t.accentColor}
              features={t.features}
              onSelect={() => { handleSelect(t.schema, t.id); }}
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
                    icon={BLANK_TEMPLATE.icon}
                    accentColor={BLANK_TEMPLATE.accentColor}
                    onSelect={() => { handleSelect(schema, t.id); }}
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
