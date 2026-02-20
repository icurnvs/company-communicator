import * as AdaptiveCards from 'adaptivecards';
import type { KeyDetailPair, AdvancedBlock, CustomVariable } from '@/types';

export interface CardData {
  title: string;
  summary?: string | null;
  imageLink?: string | null;
  keyDetails?: KeyDetailPair[] | null;
  buttonTitle?: string | null;
  buttonLink?: string | null;
  secondaryText?: string | null;
  author?: string | null;
  advancedBlocks?: AdvancedBlock[] | null;
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
// Build Adaptive Card JSON payload (schema 1.4)
// ---------------------------------------------------------------------------
export function buildCardPayload(data: CardData): object {
  const body: object[] = [];
  const actions: object[] = [];

  const resolve = (text: string | null | undefined): string =>
    text ? resolvePreviewVariables(text, data.customVariables) : '';

  // Title
  body.push({
    type: 'TextBlock',
    text: resolve(data.title) || 'Message Title',
    size: 'Large',
    weight: 'Bolder',
    wrap: true,
  });

  // Author (if provided)
  if (data.author) {
    body.push({
      type: 'TextBlock',
      text: data.author,
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'None',
    });
  }

  // Image (if provided)
  if (data.imageLink) {
    body.push({
      type: 'Image',
      url: data.imageLink,
      size: 'Stretch',
      altText: data.title,
    });
  }

  // Summary / Body
  if (data.summary) {
    body.push({
      type: 'TextBlock',
      text: resolve(data.summary),
      wrap: true,
      spacing: 'Medium',
    });
  }

  // Key Details → FactSet
  if (data.keyDetails?.length) {
    const facts = data.keyDetails
      .filter((kd) => kd.label && kd.value)
      .map((kd) => ({
        title: resolve(kd.label),
        value: resolve(kd.value),
      }));
    if (facts.length > 0) {
      body.push({
        type: 'FactSet',
        facts,
        spacing: 'Medium',
      });
    }
  }

  // Advanced blocks (when in Advanced mode)
  if (data.advancedBlocks?.length) {
    for (const block of data.advancedBlocks) {
      const element = buildAdvancedBlockElement(block, resolve);
      if (element) {
        if (block.type === 'ActionButton') {
          actions.push(element);
        } else {
          body.push(element);
        }
      }
    }
  }

  // Primary action button
  if (data.buttonTitle && data.buttonLink) {
    actions.unshift({
      type: 'Action.OpenUrl',
      title: resolve(data.buttonTitle),
      url: data.buttonLink,
    });
  }

  // Secondary text (footnote)
  if (data.secondaryText) {
    body.push({
      type: 'TextBlock',
      text: resolve(data.secondaryText),
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Medium',
    });
  }

  const card: Record<string, unknown> = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
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
function buildAdvancedBlockElement(
  block: AdvancedBlock,
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

  const textColor = isContrast ? '#ffffff' : isDark ? '#d6d6d6' : '#252424';
  const subtleColor = isContrast ? '#e0e0e0' : isDark ? '#8a8a8a' : '#605e5c';
  const backgroundColor = isContrast ? '#000000' : isDark ? '#1f1f1f' : '#ffffff';
  const borderColor = isContrast ? '#ffffff' : isDark ? '#3d3d3d' : '#e1dfdd';
  const accentColor = '#6264a7'; // Teams purple

  return {
    supportsInteractivity: true,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSizes: {
      small: 12,
      default: 14,
      medium: 16,
      large: 20,
      extraLarge: 24,
    },
    containerStyles: {
      default: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: accentColor, subtle: accentColor },
        },
        backgroundColor,
      },
      emphasis: {
        foregroundColors: {
          default: { default: textColor, subtle: subtleColor },
          accent: { default: accentColor, subtle: accentColor },
        },
        backgroundColor: isDark ? '#2d2c2c' : '#f3f2f1',
      },
    },
    actions: {
      maxActions: 5,
      buttonSpacing: 8,
      showCard: { actionMode: 'inline', inlineTopMargin: 16 },
      actionsOrientation: 'horizontal',
      actionAlignment: 'left',
    },
    adaptiveCard: {
      allowCustomStyle: false,
    },
    imageSet: { imageSize: 'medium', maxImageHeight: 100 },
    separator: { lineThickness: 1, lineColor: borderColor },
    spacing: {
      small: 4,
      default: 8,
      medium: 16,
      large: 20,
      extraLarge: 24,
      padding: 16,
    },
  };
}
