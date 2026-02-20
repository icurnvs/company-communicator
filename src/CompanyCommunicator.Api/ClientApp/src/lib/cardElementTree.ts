// lib/cardElementTree.ts
import type {
  CardElementNode,
  TemplateDefinition,
  CardDocument,
  SlotDefinition,
  SlotType,
  HeadingSlotValue,
  SubheadingSlotValue,
  BodyTextSlotValue,
  HeroImageSlotValue,
  KeyDetailsSlotValue,
  LinkButtonSlotValue,
  FooterSlotValue,
  ImageGallerySlotValue,
  StatsRowSlotValue,
  QuoteCalloutSlotValue,
  ColumnsSlotValue,
  TableSlotValue,
  ExpandableSectionSlotValue,
  IconTextRowSlotValue,
} from '@/types';

// ---------------------------------------------------------------------------
// Main entry point: template + document → element tree
// ---------------------------------------------------------------------------

export function resolveTemplate(
  template: TemplateDefinition,
  document: CardDocument,
): CardElementNode[] {
  const nodes: CardElementNode[] = [];

  // Build nodes from template slots (respecting user-defined order if present)
  const sortedSlots = [...template.slots].sort((a, b) => {
    const orderA = document.slotOrder?.[a.id] ?? a.order;
    const orderB = document.slotOrder?.[b.id] ?? b.order;
    return orderA - orderB;
  });

  for (const slot of sortedSlots) {
    // Check visibility: required slots are always shown, optional respects toggle
    const isVisible = slot.visibility === 'required'
      || (document.slotVisibility[slot.id] ?? (slot.visibility === 'optionalOn'));

    if (!isVisible) continue;

    const value = document.slotValues[slot.id] ?? slot.defaultValue;
    const overrides = document.advancedOverrides?.[slot.id];

    const element = buildSlotElement(slot, value, overrides);
    if (element) {
      nodes.push(...(Array.isArray(element) ? element : [element]));
    }
  }

  // Append additional slots (added beyond template)
  if (document.additionalSlots?.length) {
    const sorted = [...document.additionalSlots].sort((a, b) => a.order - b.order);
    for (const additional of sorted) {
      const fakeSlot: SlotDefinition = {
        id: additional.id,
        type: additional.type,
        label: '',
        visibility: 'required',
        order: additional.order,
      };
      const overrides = document.advancedOverrides?.[additional.id];
      const element = buildSlotElement(fakeSlot, additional.data, overrides);
      if (element) {
        nodes.push(...(Array.isArray(element) ? element : [element]));
      }
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Slot → element node(s)
// ---------------------------------------------------------------------------

function buildSlotElement(
  slot: SlotDefinition,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | CardElementNode[] | null {
  const builder = SLOT_BUILDERS[slot.type];
  if (!builder) return null;

  const nodes = builder(slot.id, value, overrides);
  return nodes;
}

type SlotBuilder = (
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
) => CardElementNode | CardElementNode[] | null;

const SLOT_BUILDERS: Record<SlotType, SlotBuilder> = {
  heading: buildHeading,
  subheading: buildSubheading,
  bodyText: buildBodyText,
  heroImage: buildHeroImage,
  keyDetails: buildKeyDetails,
  linkButton: buildLinkButton,
  footer: buildFooter,
  divider: buildDivider,
  imageGallery: buildImageGallery,
  statsRow: buildStatsRow,
  quoteCallout: buildQuoteCallout,
  columns: buildColumns,
  table: buildTable,
  expandableSection: buildExpandableSection,
  iconTextRow: buildIconTextRow,
};

// ---------------------------------------------------------------------------
// Individual slot builders
// ---------------------------------------------------------------------------

function buildHeading(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as HeadingSlotValue | undefined;
  if (!v?.text) return null;

  const headerTextNode: CardElementNode = {
    id: `${slotId}-text`,
    sourceType: 'heading',
    placement: 'body',
    acType: 'TextBlock',
    properties: {
      text: v.text,
      size: 'Large',
      weight: 'Bolder',
      wrap: true,
      horizontalAlignment: v.alignment ?? 'left',
      ...overrides,
    },
  };

  return {
    id: slotId,
    sourceType: 'heading',
    placement: 'body',
    acType: 'Container',
    properties: {
      style: 'accent',
      bleed: true,
    },
    children: [headerTextNode],
    themeTokens: { backgroundColor: 'accent' },
  };
}

function buildSubheading(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as SubheadingSlotValue | undefined;
  if (!v?.text) return null;

  return {
    id: slotId,
    sourceType: 'subheading',
    placement: 'body',
    acType: 'TextBlock',
    properties: {
      text: v.text,
      size: 'Medium',
      isSubtle: true,
      wrap: true,
      ...overrides,
    },
  };
}

function buildBodyText(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as BodyTextSlotValue | undefined;
  if (!v?.text) return null;

  return {
    id: slotId,
    sourceType: 'bodyText',
    placement: 'body',
    acType: 'TextBlock',
    properties: {
      text: v.text,
      wrap: true,
      spacing: 'Medium',
      ...overrides,
    },
  };
}

function buildHeroImage(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as HeroImageSlotValue | undefined;
  if (!v?.url) return null;

  return {
    id: slotId,
    sourceType: 'heroImage',
    placement: 'body',
    acType: 'Container',
    properties: {
      bleed: true,
      spacing: 'None',
      ...overrides,
    },
    children: [
      {
        id: `${slotId}-img`,
        sourceType: 'heroImage',
        placement: 'body',
        acType: 'Image',
        properties: {
          url: v.url,
          size: 'Stretch',
          altText: v.altText ?? '',
          msTeams: { allowExpand: true },
        },
      },
    ],
  };
}

function buildKeyDetails(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as KeyDetailsSlotValue | undefined;
  const pairs = v?.pairs?.filter((p) => p.label || p.value);
  if (!pairs?.length) return null;

  return {
    id: slotId,
    sourceType: 'keyDetails',
    placement: 'body',
    acType: 'Container',
    properties: {
      style: 'emphasis',
      bleed: true,
      spacing: 'Medium',
      ...overrides,
    },
    children: [
      {
        id: `${slotId}-facts`,
        sourceType: 'keyDetails',
        placement: 'body',
        acType: 'FactSet',
        properties: {
          facts: pairs.map((p) => ({ title: p.label, value: p.value })),
        },
      },
    ],
    themeTokens: { backgroundColor: 'emphasis' },
  };
}

function buildLinkButton(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as LinkButtonSlotValue | undefined;
  if (!v?.title || !v?.url) return null;

  return {
    id: slotId,
    sourceType: 'linkButton',
    placement: 'actions',
    acType: 'Action.OpenUrl',
    properties: {
      title: v.title,
      url: v.url,
      style: 'positive',
      ...overrides,
    },
  };
}

function buildFooter(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as FooterSlotValue | undefined;
  if (!v?.text) return null;

  return {
    id: slotId,
    sourceType: 'footer',
    placement: 'body',
    acType: 'TextBlock',
    properties: {
      text: v.text,
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Medium',
      separator: true,
      ...overrides,
    },
  };
}

function buildDivider(slotId: string): CardElementNode {
  return {
    id: slotId,
    sourceType: 'divider',
    placement: 'body',
    acType: 'TextBlock',
    properties: {
      text: ' ',
      separator: true,
      spacing: 'Medium',
    },
  };
}

function buildImageGallery(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as ImageGallerySlotValue | undefined;
  if (!v?.images?.length) return null;

  return {
    id: slotId,
    sourceType: 'imageGallery',
    placement: 'body',
    acType: 'ImageSet',
    properties: {
      imageSize: v.imageSize ?? 'Medium',
      images: v.images.map((img) => ({
        type: 'Image',
        url: img.url,
        altText: img.altText ?? '',
      })),
      spacing: 'Medium',
      ...overrides,
    },
  };
}

function buildStatsRow(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as StatsRowSlotValue | undefined;
  if (!v?.stats?.length) return null;

  return {
    id: slotId,
    sourceType: 'statsRow',
    placement: 'body',
    acType: 'ColumnSet',
    properties: {
      spacing: 'Medium',
      ...overrides,
    },
    children: v.stats.map((stat, i) => ({
      id: `${slotId}-col-${i}`,
      sourceType: 'statsRow' as const,
      placement: 'body' as const,
      acType: 'Column',
      properties: { width: 'stretch' },
      children: [
        {
          id: `${slotId}-val-${i}`,
          sourceType: 'statsRow' as const,
          placement: 'body' as const,
          acType: 'TextBlock',
          properties: {
            text: stat.value,
            size: 'ExtraLarge',
            weight: 'Bolder',
            horizontalAlignment: 'Center',
            wrap: true,
          },
        },
        {
          id: `${slotId}-lbl-${i}`,
          sourceType: 'statsRow' as const,
          placement: 'body' as const,
          acType: 'TextBlock',
          properties: {
            text: stat.label,
            size: 'Small',
            isSubtle: true,
            horizontalAlignment: 'Center',
            wrap: true,
            spacing: 'None',
          },
        },
      ],
    })),
  };
}

function buildQuoteCallout(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as QuoteCalloutSlotValue | undefined;
  if (!v?.text) return null;

  const style = v.style && v.style !== 'default' ? v.style : 'emphasis';

  return {
    id: slotId,
    sourceType: 'quoteCallout',
    placement: 'body',
    acType: 'Container',
    properties: {
      style,
      separator: true,
      spacing: 'Medium',
      ...overrides,
    },
    children: [
      {
        id: `${slotId}-text`,
        sourceType: 'quoteCallout',
        placement: 'body',
        acType: 'TextBlock',
        properties: {
          text: v.text,
          wrap: true,
        },
      },
    ],
  };
}

function buildColumns(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as ColumnsSlotValue | undefined;
  if (!v?.columns?.length) return null;

  return {
    id: slotId,
    sourceType: 'columns',
    placement: 'body',
    acType: 'ColumnSet',
    properties: {
      spacing: 'Medium',
      ...overrides,
    },
    children: v.columns.map((col, i) => {
      const items: CardElementNode[] = [];

      if (col.imageUrl) {
        items.push({
          id: `${slotId}-col-${i}-img`,
          sourceType: 'columns',
          placement: 'body',
          acType: 'Image',
          properties: { url: col.imageUrl, size: 'Stretch' },
        });
      }

      if (col.content) {
        items.push({
          id: `${slotId}-col-${i}-text`,
          sourceType: 'columns',
          placement: 'body',
          acType: 'TextBlock',
          properties: { text: col.content, wrap: true },
        });
      }

      return {
        id: `${slotId}-col-${i}`,
        sourceType: 'columns' as const,
        placement: 'body' as const,
        acType: 'Column',
        properties: { width: 'stretch' },
        children: items,
      };
    }),
  };
}

function buildTable(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as TableSlotValue | undefined;
  if (!v?.headers?.length) return null;

  const rows: CardElementNode[] = [];

  // Header row
  rows.push({
    id: `${slotId}-header`,
    sourceType: 'table',
    placement: 'body',
    acType: 'ColumnSet',
    properties: { separator: true, spacing: 'Medium' },
    children: v.headers.map((h, i) => ({
      id: `${slotId}-hdr-${i}`,
      sourceType: 'table' as const,
      placement: 'body' as const,
      acType: 'Column',
      properties: { width: 'stretch' },
      children: [{
        id: `${slotId}-hdr-${i}-text`,
        sourceType: 'table' as const,
        placement: 'body' as const,
        acType: 'TextBlock',
        properties: { text: h, weight: 'Bolder', wrap: true },
      }],
    })),
  });

  // Data rows
  if (v.rows?.length) {
    for (let r = 0; r < v.rows.length; r++) {
      const row = v.rows[r]!;
      rows.push({
        id: `${slotId}-row-${r}`,
        sourceType: 'table',
        placement: 'body',
        acType: 'ColumnSet',
        properties: {},
        children: row.map((cell, c) => ({
          id: `${slotId}-row-${r}-col-${c}`,
          sourceType: 'table' as const,
          placement: 'body' as const,
          acType: 'Column',
          properties: { width: 'stretch' },
          children: [{
            id: `${slotId}-row-${r}-col-${c}-text`,
            sourceType: 'table' as const,
            placement: 'body' as const,
            acType: 'TextBlock',
            properties: { text: cell, wrap: true },
          }],
        })),
      });
    }
  }

  return {
    id: slotId,
    sourceType: 'table',
    placement: 'body',
    acType: 'Container',
    properties: { spacing: 'Medium', ...overrides },
    children: rows,
  };
}

function buildExpandableSection(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode[] | null {
  const v = value as ExpandableSectionSlotValue | undefined;
  if (!v?.title) return null;

  const contentId = `${slotId}-content`;

  return [
    // The toggle action rendered as an ActionSet
    {
      id: `${slotId}-toggle`,
      sourceType: 'expandableSection',
      placement: 'body',
      acType: 'ActionSet',
      properties: {
        spacing: 'Medium',
        actions: [
          {
            type: 'Action.ToggleVisibility',
            title: v.title,
            targetElements: [contentId],
          },
        ],
        ...overrides,
      },
    },
    // The collapsible content container (hidden by default)
    {
      id: contentId,
      sourceType: 'expandableSection',
      placement: 'body',
      acType: 'Container',
      properties: {
        isVisible: false,
        spacing: 'Small',
      },
      children: v.body ? [
        {
          id: `${contentId}-text`,
          sourceType: 'expandableSection',
          placement: 'body',
          acType: 'TextBlock',
          properties: { text: v.body, wrap: true },
        },
      ] : [],
    },
  ];
}

function buildIconTextRow(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as IconTextRowSlotValue | undefined;
  if (!v?.text) return null;

  const children: CardElementNode[] = [];

  if (v.iconName) {
    children.push({
      id: `${slotId}-icon`,
      sourceType: 'iconTextRow',
      placement: 'body',
      acType: 'Image',
      properties: {
        url: `icon:${v.iconName}`,
        width: '24px',
        height: '24px',
      },
    });
  }

  children.push({
    id: `${slotId}-text`,
    sourceType: 'iconTextRow',
    placement: 'body',
    acType: 'TextBlock',
    properties: { text: v.text, wrap: true },
  });

  return {
    id: slotId,
    sourceType: 'iconTextRow',
    placement: 'body',
    acType: 'ColumnSet',
    properties: {
      spacing: 'Medium',
      ...overrides,
    },
    children: [
      ...(v.iconName ? [{
        id: `${slotId}-icon-col`,
        sourceType: 'iconTextRow' as const,
        placement: 'body' as const,
        acType: 'Column',
        properties: { width: 'auto' },
        children: [children[0]!],
      }] : []),
      {
        id: `${slotId}-text-col`,
        sourceType: 'iconTextRow',
        placement: 'body',
        acType: 'Column',
        properties: { width: 'stretch' },
        children: [children[v.iconName ? 1 : 0]!],
      },
    ],
  };
}
