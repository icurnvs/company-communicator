// components/TemplateEditor/TemplateListView.tsx
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Badge,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Edit20Regular,
  Delete20Regular,
  DocumentOnePage20Regular,
} from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { useTemplates, useDeleteTemplate } from '@/api/templates';
import {
  isTemplateDefinitionJson,
  parseTemplateDefinition,
  BUILTIN_TEMPLATE_DEFINITIONS,
  BLANK_TEMPLATE_ID,
} from '@/lib/templateDefinitions';
import { resolveTemplateIcon } from './IconPicker';
import type { TemplateDto } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    paddingTop: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    paddingRight: '24px',
    gap: '24px',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: tokens.shadow4,
    },
  },

  cardAccent: {
    height: '4px',
    flexShrink: 0,
  },

  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '16px',
    paddingBottom: '16px',
    paddingLeft: '16px',
    paddingRight: '16px',
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
  },

  cardDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },

  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '4px',
    paddingTop: '0',
    paddingBottom: '12px',
    paddingLeft: '16px',
    paddingRight: '16px',
  },

  createCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '140px',
    borderTopWidth: '2px',
    borderTopStyle: 'dashed',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightWidth: '2px',
    borderRightStyle: 'dashed',
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomWidth: '2px',
    borderBottomStyle: 'dashed',
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftWidth: '2px',
    borderLeftStyle: 'dashed',
    borderLeftColor: tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusLarge,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: tokens.colorBrandForeground1,
    gap: '8px',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    transitionProperty: 'border-color, background-color',
    transitionDuration: '0.15s',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    paddingTop: '48px',
    paddingBottom: '48px',
    paddingLeft: '48px',
    paddingRight: '48px',
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateListViewProps {
  onCreateNew: () => void;
  onEdit: (templateId: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateListView({ onCreateNew, onEdit, onClose }: TemplateListViewProps) {
  const styles = useStyles();
  const { data: templates, isLoading } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateDto | null>(null);

  // Memoize parsed templates to avoid double JSON.parse per template per render
  const parsedTemplates = useMemo(() =>
    (templates ?? []).map((t) => ({
      dto: t,
      parsed: isTemplateDefinitionJson(t.cardSchema) ? parseTemplateDefinition(t.cardSchema) : null,
    })),
    [templates],
  );

  // Built-in templates (excluding Blank)
  const builtinTemplates = useMemo(
    () => BUILTIN_TEMPLATE_DEFINITIONS.filter((t) => t.id !== BLANK_TEMPLATE_ID),
    [],
  );

  const handleDelete = (template: TemplateDto) => {
    setDeleteConfirm(template);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.title}>Manage Templates</Text>
        <Button
          appearance="subtle"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px', paddingBottom: '48px' }}>
          <Spinner label="Loading templates..." />
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Create new card */}
          <button
            type="button"
            className={styles.createCard}
            onClick={onCreateNew}
          >
            <Add24Regular />
            Create Template
          </button>

          {/* Built-in template cards */}
          {builtinTemplates.map((t) => {
            const Icon = resolveTemplateIcon(t.iconName);
            const slotCount = t.slots.length;

            return (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardAccent} style={{ backgroundColor: t.accentColor }} />
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon} style={{ color: t.accentColor }}>
                      <Icon />
                    </span>
                    <span className={styles.cardName}>{t.name}</span>
                  </div>
                  {t.description && (
                    <span className={styles.cardDescription}>{t.description}</span>
                  )}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <Badge appearance="outline" size="small" color="informative">
                      {slotCount} {slotCount === 1 ? 'section' : 'sections'}
                    </Badge>
                    <Badge appearance="outline" size="small" color="subtle">
                      Built-in
                    </Badge>
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Edit20Regular />}
                    onClick={() => { onEdit(t.id); }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Divider between built-in and custom templates */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase100 }}>
            <span style={{ flex: 1, height: '1px', backgroundColor: tokens.colorNeutralStroke2 }} />
            <span>Custom Templates</span>
            <span style={{ flex: 1, height: '1px', backgroundColor: tokens.colorNeutralStroke2 }} />
          </div>

          {/* Custom templates from API */}
          {parsedTemplates.map(({ dto: t, parsed }) => {
            const Icon = parsed ? resolveTemplateIcon(parsed.iconName) : DocumentOnePage20Regular;
            const accentColor = parsed?.accentColor ?? '#8a8886';
            const slotCount = parsed?.slots.length ?? 0;

            return (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardAccent} style={{ backgroundColor: accentColor }} />
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon} style={{ color: accentColor }}>
                      <Icon />
                    </span>
                    <span className={styles.cardName}>{t.name}</span>
                  </div>
                  {t.description && (
                    <span className={styles.cardDescription}>{t.description}</span>
                  )}
                  {parsed && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <Badge appearance="outline" size="small" color="informative">
                        {slotCount} {slotCount === 1 ? 'section' : 'sections'}
                      </Badge>
                      {parsed.category !== 'general' && (
                        <Badge appearance="outline" size="small">
                          {parsed.category}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.cardFooter}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Edit20Regular />}
                    onClick={() => { onEdit(t.id); }}
                  >
                    Edit
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete20Regular />}
                    onClick={() => { handleDelete(t); }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Inline empty state for custom templates section */}
          {(templates ?? []).length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: tokens.colorNeutralForeground3, textAlign: 'center', paddingTop: '16px', paddingBottom: '16px', fontSize: tokens.fontSizeBase200 }}>
              No custom templates yet — click Create Template to get started.
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(_e, data) => { if (!data.open) setDeleteConfirm(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogContent>
              Delete &quot;{deleteConfirm?.name}&quot;? This cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setDeleteConfirm(null); }}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
