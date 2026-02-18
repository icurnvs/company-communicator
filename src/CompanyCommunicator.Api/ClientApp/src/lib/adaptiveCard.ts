import * as AdaptiveCards from 'adaptivecards';

export interface CardData {
  title: string;
  summary?: string | null;
  imageLink?: string | null;
  buttonTitle?: string | null;
  buttonLink?: string | null;
  author?: string | null;
}

// Build an Adaptive Card JSON payload (schema 1.4)
export function buildCardPayload(data: CardData): object {
  const body: object[] = [];

  // Title
  body.push({
    type: 'TextBlock',
    text: data.title || 'Message Title',
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

  // Summary
  if (data.summary) {
    body.push({
      type: 'TextBlock',
      text: data.summary,
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

  // Action button
  if (data.buttonTitle && data.buttonLink) {
    card['actions'] = [
      {
        type: 'Action.OpenUrl',
        title: data.buttonTitle,
        url: data.buttonLink,
      },
    ];
  }

  return card;
}

// Render an Adaptive Card into a DOM element; returns cleanup function
export function renderCard(
  container: HTMLElement,
  cardPayload: object,
  theme: 'default' | 'dark' | 'contrast' = 'default',
): () => void {
  // Clear previous content
  container.innerHTML = '';

  try {
    const adaptiveCard = new AdaptiveCards.AdaptiveCard();

    // Apply host config based on Teams theme
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
