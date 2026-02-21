// components/TemplateEditor/TemplatePreviewPanel.tsx
import { useMemo } from 'react';
import {
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';
import type { TemplateDefinition, CardDocument } from '@/types';
import { getThemeById, DEFAULT_THEME_ID } from '@/lib/builtinThemes';
import { buildCard } from '@/lib/cardPipeline';
import { CardPreviewPanel } from '@/components/ComposePanel/CardPreviewPanel';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },

  header: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    flexShrink: 0,
  },

  headerLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },

  preview: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Build preview document from template definition
// ---------------------------------------------------------------------------

function templateToPreviewDocument(template: TemplateDefinition): CardDocument {
  const slotValues: Record<string, unknown> = {};
  const slotVisibility: Record<string, boolean> = {};

  for (const slot of template.slots) {
    slotVisibility[slot.id] = slot.visibility !== 'optionalOff';
    if (slot.defaultValue !== undefined) {
      slotValues[slot.id] = slot.defaultValue;
    } else {
      // Generate sample data when no default is set
      slotValues[slot.id] = generateSampleValue(slot.type);
    }
  }

  return {
    templateId: null,
    themeId: DEFAULT_THEME_ID,
    slotValues,
    slotVisibility,
    cardPreference: 'template',
  };
}

/** Generate sample data for preview when no default value is set. */
function generateSampleValue(type: string): unknown {
  switch (type) {
    case 'heading':
      return { text: 'Sample Heading' };
    case 'subheading':
      return { text: 'Sample Subheading' };
    case 'bodyText':
      return { text: 'This is sample body text to preview the template layout. It shows how the content will appear to recipients.' };
    case 'heroImage':
      return { url: 'https://picsum.photos/seed/template-preview/800/300', altText: 'Preview image' };
    case 'keyDetails':
      return { pairs: [{ label: 'Detail', value: 'Value' }, { label: 'Another', value: 'Info' }] };
    case 'linkButton':
      return { title: 'Click Here', url: 'https://example.com' };
    case 'footer':
      return { text: 'Footer text appears here' };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplatePreviewPanelProps {
  template: TemplateDefinition;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePreviewPanel({ template }: TemplatePreviewPanelProps) {
  const styles = useStyles();

  // getThemeById always returns a ThemeDefinition (falls back to default)
  const cardTheme = useMemo(() => getThemeById(DEFAULT_THEME_ID), []);

  // CRITICAL FIX: Use buildCard() directly with the template object instead of
  // buildCardFromDocument(), which only resolves built-in templates via getTemplateById().
  // Custom templates being authored here are NOT in the built-in registry.
  const previewResult = useMemo(() => {
    if (template.slots.length === 0) return null;

    const document = templateToPreviewDocument(template);
    try {
      return buildCard({
        document,
        template,     // Pass the in-progress template directly — bypasses registry lookup
        theme: cardTheme,
        customVariables: [],
      });
    } catch {
      return null;
    }
  }, [template, cardTheme]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.headerLabel}>Preview</Text>
      </div>
      <div className={styles.preview}>
        <CardPreviewPanel
          cardPayload={previewResult?.cardPayload ?? null}
          cardTheme={cardTheme}
        />
      </div>
    </div>
  );
}
