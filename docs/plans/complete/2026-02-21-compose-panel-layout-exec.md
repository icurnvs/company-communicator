# Execution Plan: Compose Panel — Wider Layout + Preview Showcase + Template Auto-Collapse

**Source plan:** `docs/plans/2026-02-21-compose-panel-layout.md`
**Generated:** 2026-02-21
**Tech stacks:** TypeScript, React, Fluent UI v9

<!-- build-cmd: npm run build -->
<!-- typecheck-cmd: npm run typecheck -->

## Wave 1: Layout and preview styling

### Task 1: Widen compose panel to 1120px
**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`
**Action:** Edit
**Commit:** `style: widen compose panel from 900px to 1120px`
**Depends on:** none

Edit 1:
```
old_string: |
    maxWidth: '900px',
new_string: |
    maxWidth: '1120px',
```

### Task 2: Adjust form/preview split and add preview background
**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`
**Action:** Edit
**Commit:** `style: adjust form/preview split to 55/45 and add preview background`
**Depends on:** none

Edit 1 — Change formArea split from 58% to 55%:
```
old_string: |
  formArea: {
    flex: '0 0 58%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
  },
new_string: |
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
```

Edit 2 — Change previewArea split from 42% to 45%, increase padding, add background:
```
old_string: |
  previewArea: {
    flex: '0 0 42%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
new_string: |
  previewArea: {
    flex: '0 0 45%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground3,
  },
```

### Task 3: Showcase preview cards with framed tiles
**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/CardPreviewPanel.tsx`
**Action:** Edit
**Commit:** `style: showcase preview cards with framed tiles, labels, and shadows`
**Depends on:** none

Edit 1 — Increase gap between showcase tiles from spacingVerticalM to spacingVerticalL:
```
old_string: |
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
    overflow: 'auto',
  },
new_string: |
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    height: '100%',
    overflow: 'auto',
  },
```

Edit 2 — Add showcase frame styling to section (background, border-radius, padding, shadow):
```
old_string: |
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
new_string: |
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalM,
    boxShadow: tokens.shadow2,
  },
```

Edit 3 — Restyle label to semibold uppercase with letter-spacing (consistent with sectionLabel pattern):
```
old_string: |
  label: {
    color: tokens.colorNeutralForeground3,
    paddingLeft: tokens.spacingHorizontalXS,
  },
new_string: |
  label: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },
```

Edit 4 — Increase inner preview container padding from spacingHorizontalM to spacingHorizontalL:
```
old_string: |
  previewContainer: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalM,
  },
new_string: |
  previewContainer: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalL,
  },
```

## Wave 2: Template auto-collapse on selection

**Depends on:** Wave 1 complete

### Task 4: Add auto-collapse and active template indicator to TemplatePicker
**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx`
**Action:** Edit
**Commit:** `feat: auto-collapse template picker on selection with active indicator`
**Depends on:** none

Edit 1 — Add activeIndicator and activeIndicatorDot styles after toggleIcon:
```
old_string: |
  toggleIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },

  grid: {
new_string: |
  toggleIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },

  activeIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
    textTransform: 'none',
    letterSpacing: 'normal',
  },

  activeIndicatorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  grid: {
```

Edit 2 — Add activeTemplateName and activeTemplateAccentColor props to interface:
```
old_string: |
export interface TemplatePickerProps {
  form: UseFormReturn<ComposeFormValues>;
  /** When true (edit mode), the picker starts collapsed. */
  defaultCollapsed?: boolean;
  /** Called after a built-in template is applied to the form. */
  onTemplateSelect?: (template: TemplateDefinition) => void;
  /** Called when the user clicks "Manage Templates". */
  onManageTemplates?: () => void;
}
new_string: |
export interface TemplatePickerProps {
  form: UseFormReturn<ComposeFormValues>;
  /** When true (edit mode), the picker starts collapsed. */
  defaultCollapsed?: boolean;
  /** Called after a built-in template is applied to the form. */
  onTemplateSelect?: (template: TemplateDefinition) => void;
  /** Called when the user clicks "Manage Templates". */
  onManageTemplates?: () => void;
  /** Name of the active template (shown as indicator when collapsed). */
  activeTemplateName?: string;
  /** Accent color of the active template (shown as dot when collapsed). */
  activeTemplateAccentColor?: string;
}
```

Edit 3 — Destructure new props in component:
```
old_string: |
export function TemplatePicker({
  form,
  defaultCollapsed = false,
  onTemplateSelect,
  onManageTemplates,
}: TemplatePickerProps) {
new_string: |
export function TemplatePicker({
  form,
  defaultCollapsed = false,
  onTemplateSelect,
  onManageTemplates,
  activeTemplateName,
  activeTemplateAccentColor,
}: TemplatePickerProps) {
```

Edit 4 — Add setExpanded(false) after applying built-in template:
```
old_string: |
    const doApply = () => {
      applyTemplateDefaults(form, template);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
      onTemplateSelect?.(template);
    };
new_string: |
    const doApply = () => {
      applyTemplateDefaults(form, template);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
      onTemplateSelect?.(template);
      setExpanded(false);
    };
```

Edit 5 — Add setExpanded(false) after applying custom template:
```
old_string: |
    const doApply = () => {
      applySchema(form, schema);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
    };
new_string: |
    const doApply = () => {
      applySchema(form, schema);
      // Reset dirty state so future template clicks won't prompt
      form.reset(form.getValues());
      setExpanded(false);
    };
```

Edit 6 — Add active template indicator to collapsed toggle row:
```
old_string: |
        <span className={styles.toggleLabel}>Templates</span>
        <span className={styles.toggleIcon} aria-hidden="true">
          {expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
        </span>
new_string: |
        <span className={styles.toggleLabel}>
          Templates
          {!expanded && activeTemplateName && (
            <span className={styles.activeIndicator}>
              {activeTemplateAccentColor && (
                <span
                  className={styles.activeIndicatorDot}
                  style={{ backgroundColor: activeTemplateAccentColor }}
                />
              )}
              {activeTemplateName}
            </span>
          )}
        </span>
        <span className={styles.toggleIcon} aria-hidden="true">
          {expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
        </span>
```

### Task 5: Pass active template info from ContentTab to TemplatePicker
**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`
**Action:** Edit
**Commit:** `feat: pass active template name and color to TemplatePicker for indicator`
**Depends on:** Task 4

Edit 1 — Add BLANK_TEMPLATE_ID to templateDefinitions import:
```
old_string: |
import {
  BUILTIN_TEMPLATE_DEFINITIONS,
  getTemplateById,
} from '@/lib/templateDefinitions';
new_string: |
import {
  BUILTIN_TEMPLATE_DEFINITIONS,
  BLANK_TEMPLATE_ID,
  getTemplateById,
} from '@/lib/templateDefinitions';
```

Edit 2 — Pass activeTemplateName and activeTemplateAccentColor props:
```
old_string: |
        <TemplatePicker
          form={form}
          defaultCollapsed={isEdit}
          onTemplateSelect={handleTemplateSelect}
          onManageTemplates={onManageTemplates}
        />
new_string: |
        <TemplatePicker
          form={form}
          defaultCollapsed={isEdit}
          onTemplateSelect={handleTemplateSelect}
          onManageTemplates={onManageTemplates}
          activeTemplateName={activeTemplate.id !== BLANK_TEMPLATE_ID ? activeTemplate.name : undefined}
          activeTemplateAccentColor={activeTemplate.id !== BLANK_TEMPLATE_ID ? activeTemplate.accentColor : undefined}
        />
```

## Verification

1. `npm run dev` from `src/CompanyCommunicator.Api/ClientApp/`
2. Open the app → click "New Message"
3. Verify: panel is wider, preview area has distinct background, cards are framed with labels
4. Select a template → templates section collapses, shows colored dot + template name
5. Click "Templates" toggle → re-expands to full grid
6. Resize browser narrower → panel shrinks gracefully (`calc(100% - 48px)`)
7. `npm run typecheck` — no TS errors
