import * as AdaptiveCards from 'adaptivecards';
import type { KeyDetailPair, LegacyBlock, CustomVariable } from '@/types';

export interface CardData {
  title: string;
  summary?: string | null;
  imageLink?: string | null;
  keyDetails?: KeyDetailPair[] | null;
  buttonTitle?: string | null;
  buttonLink?: string | null;
  secondaryText?: string | null;
  author?: string | null;
  advancedBlocks?: LegacyBlock[] | null;
  customVariables?: CustomVariable[] | null;
}

// ---------------------------------------------------------------------------
// Variable resolution
// ---------------------------------------------------------------------------
const RECIPIENT_SAMPLE_VALUES: Record<string, string> = {
  firstName: 'Sarah',
  displayName: 'Sarah Johnson',
  department: 'Engineering',
  jobTitle: 'Software Engineer',
  officeLocation: 'Building 25',
};

/** Replace {{variableName}} tokens in text with sample/custom values for preview. */
export function resolvePreviewVariables(
  text: string,
  customVariables?: CustomVariable[] | null,
): string {
  let result = text;

  // Recipient variables → sample values
  for (const [name, sample] of Object.entries(RECIPIENT_SAMPLE_VALUES)) {
    result = result.replaceAll(`{{${name}}}`, sample);
  }

  // Custom variables → author-defined values
  if (customVariables?.length) {
    for (const v of customVariables) {
      if (v.name) {
        result = result.replaceAll(`{{${v.name}}}`, v.value || `{{${v.name}}}`);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Build Adaptive Card JSON payload (schema 1.5)
//
// Layout structure:
//   ┌──────────────────────────────────────┐
//   │  ▓▓ Accent header container ▓▓▓▓▓▓  │  brand-colored background
//   │  ▓▓  Title (Large, Bolder)  ▓▓▓▓▓▓  │
//   │  ▓▓  Author (Small)         ▓▓▓▓▓▓  │
//   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
//   │                                      │
//   │  [Hero image — full bleed]           │
//   │                                      │
//   │  Body text (wrapping)                │
//   │                                      │
//   │  ┌─ emphasis container ────────────┐ │  subtle background
//   │  │  Label     Value                │ │
//   │  │  Label     Value                │ │
//   │  └─────────────────────────────────┘ │
//   │                                      │
//   │  ─── separator ───                   │
//   │  Footnote (Small, subtle)            │
//   │                                      │
//   │  [ ████ Primary Button ████████████ ]│  style: "positive"
//   └──────────────────────────────────────┘
// ---------------------------------------------------------------------------
export function buildCardPayload(data: CardData): object {
  const body: object[] = [];
  const actions: object[] = [];

  const resolve = (text: string | null | undefined): string =>
    text ? resolvePreviewVariables(text, data.customVariables) : '';

  // -----------------------------------------------------------------------
  // Header — accent-styled container with brand background
  // -----------------------------------------------------------------------
  const headerItems: object[] = [
    {
      type: 'TextBlock',
      text: resolve(data.title) || 'Message Title',
      size: 'Large',
      weight: 'Bolder',
      wrap: true,
    },
  ];

  if (data.author) {
    headerItems.push({
      type: 'TextBlock',
      text: data.author,
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Small',
    });
  }

  body.push({
    type: 'Container',
    style: 'accent',
    bleed: true,
    items: headerItems,
  });

  // -----------------------------------------------------------------------
  // Hero image — bleed for full-width edge-to-edge
  // -----------------------------------------------------------------------
  if (data.imageLink) {
    body.push({
      type: 'Container',
      bleed: true,
      spacing: 'None',
      items: [
        {
          type: 'Image',
          url: data.imageLink,
          size: 'Stretch',
          altText: resolve(data.title),
        },
      ],
    });
  }

  // -----------------------------------------------------------------------
  // Body text
  // -----------------------------------------------------------------------
  if (data.summary) {
    body.push({
      type: 'TextBlock',
      text: resolve(data.summary),
      wrap: true,
      spacing: 'Medium',
    });
  }

  // -----------------------------------------------------------------------
  // Key details — emphasis container with subtle background
  // -----------------------------------------------------------------------
  if (data.keyDetails?.length) {
    const facts = data.keyDetails
      .filter((kd) => kd.label && kd.value)
      .map((kd) => ({
        title: resolve(kd.label),
        value: resolve(kd.value),
      }));
    if (facts.length > 0) {
      body.push({
        type: 'Container',
        style: 'emphasis',
        bleed: true,
        spacing: 'Medium',
        items: [
          {
            type: 'FactSet',
            facts,
          },
        ],
      });
    }
  }

  // -----------------------------------------------------------------------
  // Advanced blocks (when in Advanced mode)
  // -----------------------------------------------------------------------
  if (data.advancedBlocks?.length) {
    for (const block of data.advancedBlocks) {
      const element = buildLegacyBlockElement(block, resolve);
      if (element) {
        if (block.type === 'ActionButton') {
          actions.push(element);
        } else {
          body.push(element);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Primary action button — positive style for brand-colored button
  // -----------------------------------------------------------------------
  if (data.buttonTitle && data.buttonLink) {
    actions.unshift({
      type: 'Action.OpenUrl',
      title: resolve(data.buttonTitle),
      url: data.buttonLink,
      style: 'positive',
    });
  }

  // -----------------------------------------------------------------------
  // Secondary text (footnote) — separated visually
  // -----------------------------------------------------------------------
  if (data.secondaryText) {
    body.push({
      type: 'TextBlock',
      text: resolve(data.secondaryText),
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Medium',
      separator: true,
    });
  }

  const card: Record<string, unknown> = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
  };

  if (actions.length > 0) {
    card['actions'] = actions;
  }

  return card;
}

// ---------------------------------------------------------------------------
// Advanced block → Adaptive Card element
// ---------------------------------------------------------------------------
function buildLegacyBlockElement(
  block: LegacyBlock,
  resolve: (text: string | null | undefined) => string,
): object | null {
  const d = block.data;

  switch (block.type) {
    case 'TextBlock':
      return {
        type: 'TextBlock',
        text: resolve(d['text'] as string | undefined),
        size: (d['size'] as string) || 'Default',
        weight: (d['weight'] as string) || 'Default',
        wrap: true,
        spacing: 'Medium',
      };

    case 'Divider':
      return {
        type: 'TextBlock',
        text: ' ',
        separator: true,
        spacing: 'Medium',
      };

    case 'ImageSet': {
      const images = d['images'] as (string | { url: string })[] | undefined;
      if (!images?.length) return null;
      return {
        type: 'ImageSet',
        imageSize: 'Medium',
        images: images.map((img) => ({
          type: 'Image',
          url: typeof img === 'string' ? img : img.url,
        })),
      };
    }

    case 'ColumnLayout': {
      const columns = d['columns'] as { text?: string }[] | undefined;
      if (!columns?.length) return null;
      return {
        type: 'ColumnSet',
        columns: columns.map((col) => ({
          type: 'Column',
          width: 'stretch',
          items: [
            {
              type: 'TextBlock',
              text: resolve(col.text),
              wrap: true,
            },
          ],
        })),
        spacing: 'Medium',
      };
    }

    case 'Table': {
      const headers = d['headers'] as string[] | undefined;
      const rows = d['rows'] as string[][] | undefined;
      if (!headers?.length) return null;
      const elements: object[] = [];

      // Header row
      elements.push({
        type: 'ColumnSet',
        separator: true,
        spacing: 'Medium',
        columns: headers.map((h) => ({
          type: 'Column',
          width: 'stretch',
          items: [
            { type: 'TextBlock', text: resolve(h), weight: 'Bolder', wrap: true },
          ],
        })),
      });

      // Data rows
      if (rows?.length) {
        for (const row of rows) {
          elements.push({
            type: 'ColumnSet',
            columns: row.map((cell) => ({
              type: 'Column',
              width: 'stretch',
              items: [
                { type: 'TextBlock', text: resolve(cell), wrap: true },
              ],
            })),
          });
        }
      }

      // Return a container wrapping all table rows
      return {
        type: 'Container',
        items: elements,
        spacing: 'Medium',
      };
    }

    case 'ActionButton':
      return {
        type: 'Action.OpenUrl',
        title: resolve(d['title'] as string | undefined) || 'Click Here',
        url: (d['url'] as string) || '',
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Render an Adaptive Card into a DOM element; returns cleanup function
// ---------------------------------------------------------------------------
export function renderCard(
  container: HTMLElement,
  cardPayload: object,
  theme: 'default' | 'dark' | 'contrast' = 'default',
): () => void {
  container.innerHTML = '';

  try {
    const adaptiveCard = new AdaptiveCards.AdaptiveCard();
    const hostConfig = buildHostConfig(theme);
    adaptiveCard.hostConfig = new AdaptiveCards.HostConfig(hostConfig);

    adaptiveCard.parse(cardPayload);

    const renderedCard = adaptiveCard.render();
    if (renderedCard) {
      container.appendChild(renderedCard);
    }
  } catch (err) {
    const errorEl = document.createElement('div');
    errorEl.style.cssText =
      'color: red; padding: 8px; font-size: 12px; font-family: monospace;';
    errorEl.textContent = `Card render error: ${String(err)}`;
    container.appendChild(errorEl);
  }

  return () => {
    container.innerHTML = '';
  };
}

function buildHostConfig(theme: 'default' | 'dark' | 'contrast'): object {
  const isDark = theme === 'dark';
  const isContrast = theme === 'contrast';

  const textColor = isContrast ? '#ffffff' : isDark ? '#d6d6d6' : '#242424';
  const subtleColor = isContrast ? '#e0e0e0' : isDark ? '#8a8a8a' : '#616161';
  const backgroundColor = isContrast ? '#000000' : isDark ? '#1f1f1f' : '#ffffff';
  const borderColor = isContrast ? '#ffffff' : isDark ? '#3d3d3d' : '#e0e0e0';
  const accentColor = '#5b5fc7'; // Teams brand indigo
  const accentDark = '#4f52b2';  // Slightly darker for dark theme
  const emphasisBg = isDark ? '#292929' : '#f5f5f5';

  return {
    supportsInteractivity: true,
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSizes: {
      small: 12,
      default: 14,
      medium: 17,
      large: 21,
      extraLarge: 26,
    },
    fontWeights: {
      lighter: 300,
      default: 400,
      bolder: 600,
    },
    containerStyles: {
      default: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: accentColor, subtle: accentColor },
          attention: { default: '#c4314b', subtle: '#d13438' },
          good: { default: '#13a10e', subtle: '#498205' },
          warning: { default: '#986f0b', subtle: '#c19c00' },
          light: { default: '#ffffff', subtle: '#d2d0ee' },
        },
        backgroundColor,
      },
      emphasis: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: accentColor, subtle: accentColor },
        },
        backgroundColor: emphasisBg,
      },
      accent: {
        foregroundColors: {
          default: { default: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
          accent: { default: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
          light: { default: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
        },
        backgroundColor: isDark ? accentDark : accentColor,
      },
      good: {
        foregroundColors: {
          default: { default: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
        },
        backgroundColor: '#13a10e',
      },
      attention: {
        foregroundColors: {
          default: { default: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
        },
        backgroundColor: '#c4314b',
      },
      warning: {
        foregroundColors: {
          default: { default: '#242424', subtle: '#616161' },
        },
        backgroundColor: '#fde300',
      },
    },
    actions: {
      maxActions: 5,
      buttonSpacing: 10,
      showCard: { actionMode: 'inline', inlineTopMargin: 16 },
      actionsOrientation: 'horizontal',
      actionAlignment: 'stretch',
    },
    adaptiveCard: {
      allowCustomStyle: false,
    },
    imageSet: { imageSize: 'medium', maxImageHeight: 100 },
    factSet: {
      title: { color: 'Default', size: 'Default', isSubtle: false, weight: 'Bolder' },
      value: { color: 'Default', size: 'Default', isSubtle: true, weight: 'Default' },
      spacing: 12,
    },
    separator: { lineThickness: 1, lineColor: borderColor },
    spacing: {
      small: 4,
      default: 8,
      medium: 16,
      large: 24,
      extraLarge: 32,
      padding: 20,
    },
  };
}
