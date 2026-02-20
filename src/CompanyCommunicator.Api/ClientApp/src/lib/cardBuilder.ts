// lib/cardBuilder.ts — Public API for the card building pipeline

// Types (re-exported for convenience)
export type {
  CardBuildInput,
  CardDocument,
  TemplateDefinition,
  ThemeDefinition,
  CardElementNode,
  SlotType,
  SlotDefinition,
} from '@/types';

// Pipeline
export { buildCard, buildCardFromDocument } from './cardPipeline';
export type { CardBuildResult } from './cardPipeline';

// Element tree
export { resolveTemplate } from './cardElementTree';

// Theme
export { applyTheme, buildThemedHostConfig } from './themeEngine';
export { BUILTIN_THEMES, DEFAULT_THEME_ID, getThemeById } from './builtinThemes';

// Templates
export {
  BUILTIN_TEMPLATE_DEFINITIONS,
  BLANK_TEMPLATE_ID,
  getTemplateById,
} from './templateDefinitions';

// Serialization
export { serializeToAdaptiveCard } from './serializer';

// Variables
export { resolveVariables } from './variableResolver';

// React hook
export { useCardPreview } from './useCardPreview';
