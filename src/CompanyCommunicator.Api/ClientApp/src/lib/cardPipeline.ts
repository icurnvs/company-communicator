// lib/cardPipeline.ts
import type {
  CardBuildInput,
  CardDocument,
  TemplateDefinition,
  ThemeDefinition,
} from '@/types';
import { resolveTemplate } from './cardElementTree';
import { applyTheme, buildThemedHostConfig } from './themeEngine';
import { resolveVariables } from './variableResolver';
import { serializeToAdaptiveCard } from './serializer';
import { getThemeById, DEFAULT_THEME_ID } from './builtinThemes';
import { getTemplateById } from './templateDefinitions';

export interface CardBuildResult {
  /** The final Adaptive Card JSON payload */
  cardPayload: object;
  /** The themed HostConfig for the preview renderer */
  hostConfig: object;
}

/**
 * Full card building pipeline:
 *   template + slotValues → elementTree → theme → variables → AC JSON
 */
export function buildCard(
  input: CardBuildInput,
  recipientTheme: 'default' | 'dark' | 'contrast' = 'default',
): CardBuildResult {
  const { document, template, theme, customVariables } = input;

  // 1. Resolve template into element tree
  const effectiveTemplate = template ?? getFallbackTemplate();
  const tree = resolveTemplate(effectiveTemplate, document);

  // 2. Apply card theme colors
  applyTheme(tree, theme);

  // 3. Resolve {{variable}} tokens
  resolveVariables(tree, customVariables);

  // 4. Serialize to AC JSON
  const cardPayload = serializeToAdaptiveCard(tree);

  // 5. Build themed host config for renderer
  const hostConfig = buildThemedHostConfig(recipientTheme, theme);

  return { cardPayload, hostConfig };
}

/**
 * Convenience: build a card from IDs (looks up template and theme).
 */
export function buildCardFromDocument(
  document: CardDocument,
  customVariables?: { name: string; value: string }[],
  recipientTheme: 'default' | 'dark' | 'contrast' = 'default',
): CardBuildResult {
  const template = document.templateId
    ? getTemplateById(document.templateId) ?? null
    : null;

  const theme = getThemeById(document.themeId ?? DEFAULT_THEME_ID);

  return buildCard(
    { document, template, theme, customVariables },
    recipientTheme,
  );
}

/** Fallback template with just a heading slot — used when templateId is null. */
function getFallbackTemplate(): TemplateDefinition {
  return {
    id: '_fallback',
    name: 'Freeform',
    description: '',
    iconName: 'Document',
    category: 'general',
    accentColor: '#5B5FC7',
    isBuiltIn: true,
    slots: [
      { id: 'heading', type: 'heading', label: 'Heading', visibility: 'required', order: 0 },
    ],
  };
}
