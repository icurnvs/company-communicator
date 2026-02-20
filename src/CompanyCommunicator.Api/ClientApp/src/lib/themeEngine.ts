// lib/themeEngine.ts
import type { CardElementNode, ThemeDefinition } from '@/types';

/**
 * Resolve theme tokens on all nodes in the element tree.
 * Mutates nodes in-place for performance (called on every preview render).
 * Returns the same array for chaining.
 *
 * WARNING: The tree is single-use after this call. Theme tokens are replaced
 * with resolved color values, so calling applyTheme again with a different
 * theme will layer on top of the previous resolution instead of re-resolving
 * from the original tokens. Always start from a fresh resolveTemplate() tree.
 */
export function applyTheme(
  nodes: CardElementNode[],
  theme: ThemeDefinition,
): CardElementNode[] {
  for (const node of nodes) {
    if (node.themeTokens) {
      for (const [prop, token] of Object.entries(node.themeTokens)) {
        const resolved = resolveToken(token, theme);
        if (resolved) {
          node.properties[prop] = resolved;
        }
      }
    }

    if (node.children?.length) {
      applyTheme(node.children, theme);
    }
  }

  return nodes;
}

function resolveToken(token: string, theme: ThemeDefinition): string | undefined {
  switch (token) {
    case 'accent':
      return theme.accentColor;
    case 'accentForeground':
      return theme.accentForeground;
    case 'emphasis':
      return theme.emphasisBackground;
    case 'border':
      return theme.borderColor;
    case 'good':
      return theme.semanticOverrides?.good ?? '#13A10E';
    case 'warning':
      return theme.semanticOverrides?.warning ?? '#986F0B';
    case 'attention':
      return theme.semanticOverrides?.attention ?? '#C4314B';
    default:
      return undefined;
  }
}

/**
 * Build an AC HostConfig that uses the given theme's colors.
 * Used for the preview renderer. `recipientTheme` controls the
 * Teams light/dark/contrast chrome; `cardTheme` controls our
 * card-level accent and emphasis colors.
 */
export function buildThemedHostConfig(
  recipientTheme: 'default' | 'dark' | 'contrast',
  cardTheme: ThemeDefinition,
): object {
  const isDark = recipientTheme === 'dark';
  const isContrast = recipientTheme === 'contrast';

  const textColor = isContrast ? '#FFFFFF' : isDark ? '#D6D6D6' : '#242424';
  const subtleColor = isContrast ? '#E0E0E0' : isDark ? '#8A8A8A' : '#616161';
  const backgroundColor = isContrast ? '#000000' : isDark ? '#1F1F1F' : '#FFFFFF';
  const borderColor = isContrast ? '#FFFFFF' : isDark ? '#3D3D3D' : cardTheme.borderColor;

  const accentBg = isDark
    ? darkenHex(cardTheme.accentColor, 0.1)
    : cardTheme.accentColor;

  const emphasisBg = isDark
    ? '#292929'
    : cardTheme.emphasisBackground;

  return {
    supportsInteractivity: true,
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSizes: { small: 12, default: 14, medium: 17, large: 21, extraLarge: 26 },
    fontWeights: { lighter: 300, default: 400, bolder: 600 },
    containerStyles: {
      default: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: cardTheme.accentColor, subtle: cardTheme.accentColor },
          attention: { default: cardTheme.semanticOverrides?.attention ?? '#C4314B', subtle: '#D13438' },
          good: { default: cardTheme.semanticOverrides?.good ?? '#13A10E', subtle: '#498205' },
          warning: { default: cardTheme.semanticOverrides?.warning ?? '#986F0B', subtle: '#C19C00' },
          light: { default: '#FFFFFF', subtle: '#D2D0EE' },
        },
        backgroundColor,
      },
      emphasis: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: cardTheme.accentColor, subtle: cardTheme.accentColor },
        },
        backgroundColor: emphasisBg,
      },
      accent: {
        foregroundColors: {
          default: { default: cardTheme.accentForeground, subtle: `${cardTheme.accentForeground}B3` },
          accent: { default: cardTheme.accentForeground, subtle: `${cardTheme.accentForeground}B3` },
          light: { default: cardTheme.accentForeground, subtle: `${cardTheme.accentForeground}B3` },
        },
        backgroundColor: accentBg,
      },
      good: {
        foregroundColors: {
          default: { default: '#FFFFFF', subtle: 'rgba(255,255,255,0.7)' },
        },
        backgroundColor: cardTheme.semanticOverrides?.good ?? '#13A10E',
      },
      attention: {
        foregroundColors: {
          default: { default: '#FFFFFF', subtle: 'rgba(255,255,255,0.7)' },
        },
        backgroundColor: cardTheme.semanticOverrides?.attention ?? '#C4314B',
      },
      warning: {
        foregroundColors: {
          default: { default: '#242424', subtle: '#616161' },
        },
        backgroundColor: '#FDE300',
      },
    },
    actions: {
      maxActions: 5,
      buttonSpacing: 10,
      showCard: { actionMode: 'inline', inlineTopMargin: 16 },
      actionsOrientation: 'horizontal',
      actionAlignment: 'stretch',
    },
    adaptiveCard: { allowCustomStyle: false },
    imageSet: { imageSize: 'medium', maxImageHeight: 100 },
    factSet: {
      title: { color: 'Default', size: 'Default', isSubtle: false, weight: 'Bolder' },
      value: { color: 'Default', size: 'Default', isSubtle: true, weight: 'Default' },
      spacing: 12,
    },
    separator: { lineThickness: 1, lineColor: borderColor },
    spacing: { small: 4, default: 8, medium: 16, large: 24, extraLarge: 32, padding: 20 },
  };
}

/** Simple hex color darkening for dark theme accent backgrounds. */
function darkenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  if (isNaN(num) || cleaned.length !== 6) return hex;
  const r = Math.max(0, ((num >> 16) & 0xFF) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xFF) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xFF) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
