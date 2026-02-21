import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';
import type { ComposeFormValues } from '@/lib/validators';
import type { TemplateDefinition } from '@/types';
import {
  BUILTIN_TEMPLATE_DEFINITIONS,
  BLANK_TEMPLATE_ID,
  getTemplateById,
} from '@/lib/templateDefinitions';
import { getThemeById, DEFAULT_THEME_ID } from '@/lib/builtinThemes';
import { formValuesToCardDocument } from '@/lib/formBridge';
import { buildCardFromDocument } from '@/lib/cardPipeline';
import { TemplatePicker } from './TemplatePicker';
import { ThemePicker } from './ThemePicker';
import { SlotList } from './SlotList';
import { CardPreviewPanel } from './CardPreviewPanel';
import { CardSettingsPanel } from './CardSettingsPanel';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    height: 0,
  },

  formArea: {
    flex: '0 0 55%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
  },

  previewArea: {
    flex: '0 0 45%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground3,
  },

  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },

  themeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContentTabProps {
  form: UseFormReturn<ComposeFormValues>;
  isEdit?: boolean;
  advancedMode?: boolean;
  onManageTemplates?: () => void;
}

// ---------------------------------------------------------------------------
// ContentTab
// ---------------------------------------------------------------------------

export function ContentTab({ form, isEdit = false, advancedMode = false, onManageTemplates }: ContentTabProps) {
  const styles = useStyles();
  const { watch, setValue } = form;

  // Track the active template definition (needed by SlotList)
  const [activeTemplate, setActiveTemplate] = useState<TemplateDefinition>(
    () => {
      const templateId = form.getValues('templateId');
      if (templateId) {
        return getTemplateById(templateId) ?? BUILTIN_TEMPLATE_DEFINITIONS[0]!;
      }
      return BUILTIN_TEMPLATE_DEFINITIONS[0]!; // Blank
    },
  );

  // Keep activeTemplate in sync when form is reset (e.g. edit-mode fetch)
  const watchedTemplateId = watch('templateId');
  useEffect(() => {
    const resolved = watchedTemplateId ? getTemplateById(watchedTemplateId) : null;
    if (resolved) {
      setActiveTemplate(resolved);
    }
  }, [watchedTemplateId]);

  // Watch form values for live preview (deferred to avoid blocking inputs)
  const watchedValues = watch();
  const deferredValues = useDeferredValue(watchedValues);

  const themeId = watchedValues.themeId ?? DEFAULT_THEME_ID;
  const slotVisibility = watchedValues.slotVisibility ?? {};

  // Build the preview card payload via the pipeline (all from deferred values)
  const previewResult = useMemo(() => {
    const deferredThemeId = deferredValues.themeId ?? DEFAULT_THEME_ID;
    const deferredSlotVis = deferredValues.slotVisibility ?? {};

    const document = formValuesToCardDocument(
      deferredValues,
      activeTemplate,
      deferredThemeId,
      deferredSlotVis,
    );

    const customVars = deferredValues.customVariables
      ?.filter((v) => v.name)
      .map((v) => ({ name: v.name, value: v.value || `{{${v.name}}}` }));

    try {
      return buildCardFromDocument(document, customVars);
    } catch {
      return null;
    }
  }, [deferredValues, activeTemplate]);

  const cardTheme = useMemo(
    () => getThemeById(deferredValues.themeId ?? DEFAULT_THEME_ID),
    [deferredValues.themeId],
  );

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  const handleTemplateSelect = useCallback(
    (template: TemplateDefinition) => {
      setActiveTemplate(template);
    },
    [],
  );

  const handleThemeSelect = useCallback(
    (newThemeId: string) => {
      setValue('themeId', newThemeId, { shouldDirty: true });
    },
    [setValue],
  );

  const handleToggleSlot = useCallback(
    (slotId: string, visible: boolean) => {
      const current = form.getValues('slotVisibility') ?? {};
      setValue('slotVisibility', { ...current, [slotId]: visible }, { shouldDirty: true });
    },
    [form, setValue],
  );

  const handleAddCustomVariable = useCallback(
    (name: string) => {
      const current = watchedValues.customVariables ?? [];
      if (current.some((v) => v.name === name)) return;
      setValue('customVariables', [...current, { name, value: '' }], { shouldDirty: true });
    },
    [watchedValues.customVariables, setValue],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.root}>
      {/* Left: Form editor */}
      <div className={styles.formArea}>
        <TemplatePicker
          form={form}
          defaultCollapsed={isEdit}
          onTemplateSelect={handleTemplateSelect}
          onManageTemplates={onManageTemplates}
          activeTemplateName={activeTemplate.id !== BLANK_TEMPLATE_ID ? activeTemplate.name : undefined}
          activeTemplateAccentColor={activeTemplate.id !== BLANK_TEMPLATE_ID ? activeTemplate.accentColor : undefined}
        />

        {/* Card Settings — only in advanced mode */}
        {advancedMode && <CardSettingsPanel form={form} />}

        <div className={styles.themeSection}>
          <Text className={styles.sectionLabel}>Color Theme</Text>
          <ThemePicker
            selectedThemeId={themeId}
            onSelectTheme={handleThemeSelect}
          />
        </div>

        <SlotList
          template={activeTemplate}
          form={form}
          slotVisibility={slotVisibility}
          advancedMode={advancedMode}
          onToggleSlot={handleToggleSlot}
          onAddCustomVariable={handleAddCustomVariable}
        />
      </div>

      {/* Right: Live Preview */}
      <div className={styles.previewArea}>
        <CardPreviewPanel
          cardPayload={previewResult?.cardPayload ?? null}
          cardTheme={cardTheme}
        />
      </div>
    </div>
  );
}
