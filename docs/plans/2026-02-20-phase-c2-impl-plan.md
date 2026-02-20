# Phase C2 — Advanced Block Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 15 new Adaptive Cards block types to the card builder, each with the full vertical: type → builder → serializer → editor → palette → properties.

**Architecture:** Each block follows the existing `statsRow` pattern — a value interface in types, a builder function in `cardElementTree.ts`, an editor component, a palette entry, and property panel definitions. New blocks are advanced-mode only, added via "Add Section" palette. Charts share a reusable `ChartDataEditor` component.

**Tech Stack:** React 19, TypeScript 5.6, Fluent UI v9, react-hook-form + Zod, Vite 6

**Verify command:** `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit && npx vite build`

**ClientApp src prefix:** `src/CompanyCommunicator.Api/ClientApp/src/` (abbreviated as `src/.../` below)

---

## Task 1: Type System — Content Block Value Interfaces

**Files:**
- Modify: `src/.../types/cardBuilder.ts` (after line 214, before SlotValueMap)

**Step 1: Add 6 content block value interfaces**

Add after `IconTextRowSlotValue` (line 214), before `SlotValueMap` (line 217):

```ts
// ---------------------------------------------------------------------------
// Content block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface RichTextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: string;
}

export interface RichTextSlotValue {
  segments: RichTextSegment[];
}

export interface IconSlotValue {
  name: string;
  size?: 'xxSmall' | 'xSmall' | 'Small' | 'Standard' | 'Medium' | 'Large' | 'xLarge' | 'xxLarge';
  color?: 'Default' | 'Dark' | 'Light' | 'Accent' | 'Good' | 'Warning' | 'Attention';
  style?: 'Regular' | 'Filled';
}

export interface BadgeSlotValue {
  text: string;
  icon?: string;
  appearance?: string;
}

export interface CodeBlockSlotValue {
  code: string;
  language: string;
  startLineNumber?: number;
}

export interface RatingDisplaySlotValue {
  value: number;
  max?: number;
  color?: 'Neutral' | 'Marigold';
  style?: 'Default' | 'Compact';
  count?: number;
}

export interface CompoundButtonSlotValue {
  title: string;
  description?: string;
  icon?: string;
  badge?: string;
  url?: string;
}
```

**Step 2: Add layout block value interfaces**

Add after `CompoundButtonSlotValue`:

```ts
// ---------------------------------------------------------------------------
// Layout block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface FlowLayoutSlotValue {
  items: { text: string; icon?: string }[];
  itemWidth?: string;
  columnSpacing?: string;
}

export interface GridLayoutSlotValue {
  columns: number[];
  areas: { name: string; content: string; imageUrl?: string }[];
}
```

**Step 3: Add chart block value interfaces**

Add after `GridLayoutSlotValue`:

```ts
// ---------------------------------------------------------------------------
// Chart block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeriesData {
  legend: string;
  color?: string;
  values: { x: string; y: number }[];
}

export interface DonutChartSlotValue {
  title?: string;
  data: ChartDataPoint[];
  colorSet?: 'categorical' | 'sequential' | 'diverging';
}

export interface VerticalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  showBarValues?: boolean;
}

export interface GroupedBarSlotValue {
  title?: string;
  series: ChartSeriesData[];
  stacked?: boolean;
  showBarValues?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
}

export interface HorizontalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  displayMode?: 'AbsoluteWithAxis' | 'AbsoluteNoAxis' | 'PartToWhole';
}

export interface StackedBarSlotValue {
  title?: string;
  series: { title: string; data: ChartDataPoint[] }[];
}

export interface LineChartSlotValue {
  title?: string;
  series: ChartSeriesData[];
  xAxisTitle?: string;
  yAxisTitle?: string;
}

export interface GaugeSlotValue {
  value: number;
  min?: number;
  max?: number;
  valueFormat?: 'Percentage' | 'Fraction';
  segments?: { legend: string; size: number; color?: string }[];
  subLabel?: string;
}
```

**Step 4: Update SlotValueMap**

Add 15 new entries to the existing `SlotValueMap` interface (after line 233):

```ts
  // Phase C2 — Content blocks
  richText: RichTextSlotValue;
  icon: IconSlotValue;
  badge: BadgeSlotValue;
  codeBlock: CodeBlockSlotValue;
  ratingDisplay: RatingDisplaySlotValue;
  compoundButton: CompoundButtonSlotValue;
  // Phase C2 — Layout blocks
  flowLayout: FlowLayoutSlotValue;
  gridLayout: GridLayoutSlotValue;
  // Phase C2 — Chart blocks
  donutChart: DonutChartSlotValue;
  verticalBar: VerticalBarSlotValue;
  groupedBar: GroupedBarSlotValue;
  horizontalBar: HorizontalBarSlotValue;
  stackedBar: StackedBarSlotValue;
  lineChart: LineChartSlotValue;
  gauge: GaugeSlotValue;
```

**Step 5: Widen AdditionalSlot.type**

Change `AdditionalSlot` interface (line 136-141):

```ts
export interface AdditionalSlot {
  id: string;
  type: AnyBlockType;  // was: SlotType
  order: number;
  data: Record<string, unknown>;
}
```

**Step 6: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/types/cardBuilder.ts
git commit -m "feat(types): add 15 Phase C2 block value interfaces and widen AdditionalSlot"
```

---

## Task 2: Type Re-exports

**Files:**
- Modify: `src/.../types/index.ts` (line 236-269)

**Step 1: Add re-exports for all new types**

Add to the existing `export type { ... } from './cardBuilder'` block (before the closing `}`):

```ts
  // Phase C2 — Content block values
  RichTextSegment,
  RichTextSlotValue,
  IconSlotValue,
  BadgeSlotValue,
  CodeBlockSlotValue,
  RatingDisplaySlotValue,
  CompoundButtonSlotValue,
  // Phase C2 — Layout block values
  FlowLayoutSlotValue,
  GridLayoutSlotValue,
  // Phase C2 — Chart block values
  ChartDataPoint,
  ChartSeriesData,
  DonutChartSlotValue,
  VerticalBarSlotValue,
  GroupedBarSlotValue,
  HorizontalBarSlotValue,
  StackedBarSlotValue,
  LineChartSlotValue,
  GaugeSlotValue,
```

**Step 2: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/types/index.ts
git commit -m "feat(types): re-export Phase C2 value interfaces"
```

---

## Task 3: Zod Schema — Widen additionalSlots.type Enum

**Files:**
- Modify: `src/.../lib/validators.ts` (lines 98-116, 247)

**Step 1: Widen the Zod enum for additionalSlots.type**

Replace the `type: z.enum([...])` at lines 102-109 with:

```ts
          type: z.enum([
            // Phase C (Extended)
            'imageGallery',
            'statsRow',
            'quoteCallout',
            'columns',
            'table',
            'expandableSection',
            'iconTextRow',
            // Phase C2 — Content
            'richText',
            'icon',
            'badge',
            'codeBlock',
            'ratingDisplay',
            'compoundButton',
            // Phase C2 — Layout
            'flowLayout',
            'gridLayout',
            // Phase C2 — Charts
            'donutChart',
            'verticalBar',
            'groupedBar',
            'horizontalBar',
            'stackedBar',
            'lineChart',
            'gauge',
          ]),
```

**Step 2: Widen TemplateMetadata.additionalSlots type**

At line 247, change `ExtendedSlotType` to accept any block type. Replace:

```ts
  additionalSlots?: Array<{ id: string; type: ExtendedSlotType; data: Record<string, unknown>; order: number }> | null;
```

With:

```ts
  additionalSlots?: Array<{ id: string; type: string; data: Record<string, unknown>; order: number }> | null;
```

**Step 3: Run verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/lib/validators.ts
git commit -m "feat(validators): widen additionalSlots Zod enum for 15 Phase C2 block types"
```

---

## Task 4: Pipeline Builders — Content Blocks

**Files:**
- Modify: `src/.../lib/cardElementTree.ts`

**Step 1: Add imports for new value types**

Add to the import list at lines 1-22:

```ts
import type {
  // ... existing imports ...
  RichTextSlotValue,
  RichTextSegment,
  IconSlotValue,
  BadgeSlotValue,
  CodeBlockSlotValue,
  RatingDisplaySlotValue,
  CompoundButtonSlotValue,
  AnyBlockType,
} from '@/types';
```

**Step 2: Widen SLOT_BUILDERS type**

Change line 101 from:

```ts
const SLOT_BUILDERS: Record<SlotType, SlotBuilder> = {
```

To:

```ts
const SLOT_BUILDERS: Record<AnyBlockType, SlotBuilder> = {
```

**Step 3: Add 6 content builder entries to SLOT_BUILDERS**

After `iconTextRow: buildIconTextRow,` (line 116), add:

```ts
  // Phase C2 — Content blocks
  richText: buildRichText,
  icon: buildIconBlock,
  badge: buildBadge,
  codeBlock: buildCodeBlock,
  ratingDisplay: buildRatingDisplay,
  compoundButton: buildCompoundButton,
```

(Note: `buildIconBlock` not `buildIcon` to avoid name conflict with potential future use.)

**Step 4: Add 6 content builder functions**

Add after the `buildIconTextRow` function (after line 689):

```ts
// ---------------------------------------------------------------------------
// Phase C2 — Content block builders
// ---------------------------------------------------------------------------

function buildRichText(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as RichTextSlotValue | undefined;
  if (!v?.segments?.length) return null;

  const inlines = v.segments.map((seg: RichTextSegment) => {
    const run: Record<string, unknown> = { type: 'TextRun', text: seg.text };
    if (seg.bold) run['weight'] = 'Bolder';
    if (seg.italic) run['italic'] = true;
    if (seg.strikethrough) run['strikethrough'] = true;
    if (seg.underline) run['underline'] = true;
    if (seg.highlight) run['highlight'] = true;
    if (seg.color) run['color'] = seg.color;
    return run;
  });

  return {
    id: slotId,
    sourceType: 'richText',
    placement: 'body',
    acType: 'RichTextBlock',
    properties: {
      inlines,
      spacing: 'Medium',
      ...overrides,
    },
  };
}

function buildIconBlock(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as IconSlotValue | undefined;
  if (!v?.name) return null;

  return {
    id: slotId,
    sourceType: 'icon',
    placement: 'body',
    acType: 'Icon',
    properties: {
      name: v.name,
      size: v.size ?? 'Standard',
      color: v.color ?? 'Default',
      style: v.style ?? 'Regular',
      spacing: 'Medium',
      ...overrides,
    },
  };
}

function buildBadge(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as BadgeSlotValue | undefined;
  if (!v?.text) return null;

  const props: Record<string, unknown> = {
    text: v.text,
    spacing: 'Medium',
    ...overrides,
  };
  if (v.icon) props['icon'] = { name: v.icon };
  if (v.appearance) props['appearance'] = v.appearance;

  return {
    id: slotId,
    sourceType: 'badge',
    placement: 'body',
    acType: 'Badge',
    properties: props,
  };
}

function buildCodeBlock(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as CodeBlockSlotValue | undefined;
  if (!v?.code) return null;

  return {
    id: slotId,
    sourceType: 'codeBlock',
    placement: 'body',
    acType: 'CodeBlock',
    properties: {
      codeSnippet: v.code,
      language: v.language || 'PlainText',
      startLineNumber: v.startLineNumber ?? 1,
      spacing: 'Medium',
      ...overrides,
    },
  };
}

function buildRatingDisplay(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as RatingDisplaySlotValue | undefined;
  if (v?.value == null) return null;

  const props: Record<string, unknown> = {
    value: v.value,
    max: v.max ?? 5,
    spacing: 'Medium',
    ...overrides,
  };
  if (v.color) props['color'] = v.color;
  if (v.style) props['style'] = v.style;
  if (v.count != null) props['count'] = v.count;

  return {
    id: slotId,
    sourceType: 'ratingDisplay',
    placement: 'body',
    acType: 'Rating',
    properties: props,
  };
}

function buildCompoundButton(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as CompoundButtonSlotValue | undefined;
  if (!v?.title) return null;

  const props: Record<string, unknown> = {
    title: v.title,
    spacing: 'Medium',
    ...overrides,
  };
  if (v.description) props['description'] = v.description;
  if (v.icon) props['icon'] = { name: v.icon };
  if (v.badge) props['badge'] = v.badge;
  if (v.url) {
    props['selectAction'] = {
      type: 'Action.OpenUrl',
      url: v.url,
    };
  }

  return {
    id: slotId,
    sourceType: 'compoundButton',
    placement: 'body',
    acType: 'CompoundButton',
    properties: props,
  };
}
```

**Step 5: Run verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
Expected: FAIL — SLOT_BUILDERS is missing layout and chart entries. That's expected, we'll add them in Tasks 5 and 6.

**Note:** To pass type-check at this point, temporarily add placeholder entries. OR — better — change `SLOT_BUILDERS` type to `Partial<Record<AnyBlockType, SlotBuilder>>` temporarily and update `buildSlotElement` to handle `undefined`. But the cleanest approach is to add ALL builders before running type-check. So **do NOT verify yet** — continue to Tasks 5 and 6, then verify all at once.

**Step 6: Commit (hold — commit after Task 6)**

---

## Task 5: Pipeline Builders — Layout Blocks

**Files:**
- Modify: `src/.../lib/cardElementTree.ts`

**Step 1: Add layout value imports**

Add to the import block:

```ts
  FlowLayoutSlotValue,
  GridLayoutSlotValue,
```

**Step 2: Add layout entries to SLOT_BUILDERS**

After the content entries added in Task 4:

```ts
  // Phase C2 — Layout blocks
  flowLayout: buildFlowLayout,
  gridLayout: buildGridLayout,
```

**Step 3: Add layout builder functions**

Add after the content builders from Task 4:

```ts
// ---------------------------------------------------------------------------
// Phase C2 — Layout block builders
// ---------------------------------------------------------------------------

function buildFlowLayout(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as FlowLayoutSlotValue | undefined;
  if (!v?.items?.length) return null;

  const children: CardElementNode[] = v.items.map((item, i) => {
    if (item.icon) {
      // Icon + text as a small container
      return {
        id: `${slotId}-item-${i}`,
        sourceType: 'flowLayout' as const,
        placement: 'body' as const,
        acType: 'Container',
        properties: {},
        children: [
          {
            id: `${slotId}-item-${i}-icon`,
            sourceType: 'flowLayout' as const,
            placement: 'body' as const,
            acType: 'Icon',
            properties: { name: item.icon, size: 'Small' },
          },
          {
            id: `${slotId}-item-${i}-text`,
            sourceType: 'flowLayout' as const,
            placement: 'body' as const,
            acType: 'TextBlock',
            properties: { text: item.text, wrap: true, size: 'Small' },
          },
        ],
      };
    }
    return {
      id: `${slotId}-item-${i}`,
      sourceType: 'flowLayout' as const,
      placement: 'body' as const,
      acType: 'TextBlock',
      properties: { text: item.text, wrap: true },
    };
  });

  const layout: Record<string, unknown> = { type: 'Layout.Flow' };
  if (v.itemWidth) layout['itemWidth'] = v.itemWidth;
  if (v.columnSpacing) layout['columnSpacing'] = v.columnSpacing;

  return {
    id: slotId,
    sourceType: 'flowLayout',
    placement: 'body',
    acType: 'Container',
    properties: {
      layouts: [layout],
      spacing: 'Medium',
      ...overrides,
    },
    children,
  };
}

function buildGridLayout(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as GridLayoutSlotValue | undefined;
  if (!v?.areas?.length) return null;

  const gridAreas = v.areas.map((area, i) => ({
    name: area.name || `area-${i}`,
    column: (i % (v.columns?.length || 2)) + 1,
    row: Math.floor(i / (v.columns?.length || 2)) + 1,
  }));

  const children: CardElementNode[] = v.areas.map((area, i) => {
    const items: CardElementNode[] = [];

    if (area.imageUrl) {
      items.push({
        id: `${slotId}-area-${i}-img`,
        sourceType: 'gridLayout' as const,
        placement: 'body' as const,
        acType: 'Image',
        properties: { url: area.imageUrl, size: 'Stretch' },
      });
    }

    if (area.content) {
      items.push({
        id: `${slotId}-area-${i}-text`,
        sourceType: 'gridLayout' as const,
        placement: 'body' as const,
        acType: 'TextBlock',
        properties: { text: area.content, wrap: true },
      });
    }

    return {
      id: `${slotId}-area-${i}`,
      sourceType: 'gridLayout' as const,
      placement: 'body' as const,
      acType: 'Container',
      properties: {
        'grid.area': area.name || `area-${i}`,
      },
      children: items,
    };
  });

  return {
    id: slotId,
    sourceType: 'gridLayout',
    placement: 'body',
    acType: 'Container',
    properties: {
      layouts: [{
        type: 'Layout.AreaGrid',
        columns: v.columns?.length ? v.columns : [50, 50],
        areas: gridAreas,
      }],
      spacing: 'Medium',
      ...overrides,
    },
    children,
  };
}
```

---

## Task 6: Pipeline Builders — Chart Blocks

**Files:**
- Modify: `src/.../lib/cardElementTree.ts`

**Step 1: Add chart value imports**

Add to the import block:

```ts
  ChartDataPoint,
  ChartSeriesData,
  DonutChartSlotValue,
  VerticalBarSlotValue,
  GroupedBarSlotValue,
  HorizontalBarSlotValue,
  StackedBarSlotValue,
  LineChartSlotValue,
  GaugeSlotValue,
```

**Step 2: Add chart entries to SLOT_BUILDERS**

After the layout entries:

```ts
  // Phase C2 — Chart blocks
  donutChart: buildDonutChart,
  verticalBar: buildVerticalBar,
  groupedBar: buildGroupedBar,
  horizontalBar: buildHorizontalBar,
  stackedBar: buildStackedBar,
  lineChart: buildLineChart,
  gauge: buildGauge,
```

**Step 3: Add chart builder helper and 7 chart builder functions**

```ts
// ---------------------------------------------------------------------------
// Phase C2 — Chart block builders
// ---------------------------------------------------------------------------

/** Shared helper for simple single-series charts */
function buildSimpleChart(
  slotId: string,
  sourceType: AnyBlockType,
  acType: string,
  data: ChartDataPoint[],
  extraProps: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  if (!data?.length) return null;

  return {
    id: slotId,
    sourceType,
    placement: 'body',
    acType,
    properties: {
      data: data.map((d) => {
        const point: Record<string, unknown> = { x: d.label, y: d.value };
        if (d.color) point['color'] = d.color;
        return point;
      }),
      spacing: 'Medium',
      ...extraProps,
      ...overrides,
    },
  };
}

function buildDonutChart(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as DonutChartSlotValue | undefined;
  if (!v?.data?.length) return null;

  const props: Record<string, unknown> = {};
  if (v.title) props['title'] = v.title;
  if (v.colorSet) props['colorSet'] = v.colorSet;

  return {
    id: slotId,
    sourceType: 'donutChart',
    placement: 'body',
    acType: 'Chart.Donut',
    properties: {
      data: v.data.map((d) => {
        const point: Record<string, unknown> = { legend: d.label, value: d.value };
        if (d.color) point['color'] = d.color;
        return point;
      }),
      spacing: 'Medium',
      ...props,
      ...overrides,
    },
  };
}

function buildVerticalBar(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as VerticalBarSlotValue | undefined;
  const extra: Record<string, unknown> = {};
  if (v?.title) extra['title'] = v.title;
  if (v?.showBarValues) extra['showBarValues'] = true;
  return buildSimpleChart(slotId, 'verticalBar', 'Chart.VerticalBar', v?.data ?? [], extra, overrides);
}

function buildGroupedBar(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as GroupedBarSlotValue | undefined;
  if (!v?.series?.length) return null;

  const props: Record<string, unknown> = {
    data: v.series.map((s) => {
      const series: Record<string, unknown> = { legend: s.legend, values: s.values };
      if (s.color) series['color'] = s.color;
      return series;
    }),
    spacing: 'Medium',
  };
  if (v.title) props['title'] = v.title;
  if (v.stacked) props['stacked'] = true;
  if (v.showBarValues) props['showBarValues'] = true;
  if (v.xAxisTitle) props['xAxisTitle'] = v.xAxisTitle;
  if (v.yAxisTitle) props['yAxisTitle'] = v.yAxisTitle;

  return {
    id: slotId,
    sourceType: 'groupedBar',
    placement: 'body',
    acType: 'Chart.VerticalBar.Grouped',
    properties: { ...props, ...overrides },
  };
}

function buildHorizontalBar(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as HorizontalBarSlotValue | undefined;
  const extra: Record<string, unknown> = {};
  if (v?.title) extra['title'] = v.title;
  if (v?.displayMode) extra['displayMode'] = v.displayMode;
  return buildSimpleChart(slotId, 'horizontalBar', 'Chart.HorizontalBar', v?.data ?? [], extra, overrides);
}

function buildStackedBar(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as StackedBarSlotValue | undefined;
  if (!v?.series?.length) return null;

  const props: Record<string, unknown> = {
    data: v.series.map((s) => ({
      title: s.title,
      data: s.data.map((d) => {
        const point: Record<string, unknown> = { legend: d.label, value: d.value };
        if (d.color) point['color'] = d.color;
        return point;
      }),
    })),
    spacing: 'Medium',
  };
  if (v.title) props['title'] = v.title;

  return {
    id: slotId,
    sourceType: 'stackedBar',
    placement: 'body',
    acType: 'Chart.HorizontalBar.Stacked',
    properties: { ...props, ...overrides },
  };
}

function buildLineChart(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as LineChartSlotValue | undefined;
  if (!v?.series?.length) return null;

  const props: Record<string, unknown> = {
    data: v.series.map((s) => {
      const series: Record<string, unknown> = { legend: s.legend, values: s.values };
      if (s.color) series['color'] = s.color;
      return series;
    }),
    spacing: 'Medium',
  };
  if (v.title) props['title'] = v.title;
  if (v.xAxisTitle) props['xAxisTitle'] = v.xAxisTitle;
  if (v.yAxisTitle) props['yAxisTitle'] = v.yAxisTitle;

  return {
    id: slotId,
    sourceType: 'lineChart',
    placement: 'body',
    acType: 'Chart.Line',
    properties: { ...props, ...overrides },
  };
}

function buildGauge(
  slotId: string,
  value: unknown,
  overrides?: Record<string, unknown>,
): CardElementNode | null {
  const v = value as GaugeSlotValue | undefined;
  if (v?.value == null) return null;

  const props: Record<string, unknown> = {
    value: v.value,
    min: v.min ?? 0,
    max: v.max ?? 100,
    spacing: 'Medium',
  };
  if (v.valueFormat) props['valueFormat'] = v.valueFormat;
  if (v.segments?.length) {
    props['segments'] = v.segments.map((s) => {
      const seg: Record<string, unknown> = { legend: s.legend, size: s.size };
      if (s.color) seg['color'] = s.color;
      return seg;
    });
  }
  if (v.subLabel) props['subLabel'] = v.subLabel;

  return {
    id: slotId,
    sourceType: 'gauge',
    placement: 'body',
    acType: 'Chart.Gauge',
    properties: { ...props, ...overrides },
  };
}
```

**Step 4: Run verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
Expected: PASS — all builders present, types match.

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/lib/cardElementTree.ts
git commit -m "feat(pipeline): add 15 Phase C2 builder functions for content, layout, and chart blocks"
```

---

## Task 7: ChartDataEditor — Shared Component

**Files:**
- Create: `src/.../components/ComposePanel/ChartDataEditor.tsx`

**Step 1: Create ChartDataEditor**

This is a reusable component for entering chart data points. It handles two modes: single-series (label+value rows) and multi-series (series groups with label+value rows each).

```tsx
// ChartDataEditor.tsx — Shared data table for chart block editors
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Button,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { ChartDataPoint, ChartSeriesData } from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  valueField: {
    flex: 0,
    minWidth: '80px',
    maxWidth: '100px',
  },
  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },
  seriesBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  seriesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Single-series editor
// ---------------------------------------------------------------------------

export interface SingleSeriesEditorProps {
  data: ChartDataPoint[];
  labelPlaceholder?: string;
  onChange: (data: ChartDataPoint[]) => void;
}

export function SingleSeriesEditor({
  data,
  labelPlaceholder = 'Label',
  onChange,
}: SingleSeriesEditorProps) {
  const styles = useStyles();

  const update = useCallback((index: number, field: 'label' | 'value' | 'color', val: string | number) => {
    const next = data.map((d, i) => (i === index ? { ...d, [field]: val } : d));
    onChange(next);
  }, [data, onChange]);

  const add = useCallback(() => {
    onChange([...data, { label: '', value: 0 }]);
  }, [data, onChange]);

  const remove = useCallback((index: number) => {
    onChange(data.filter((_, i) => i !== index));
  }, [data, onChange]);

  return (
    <div className={styles.container}>
      {data.map((point, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            {i === 0 && <Text size={200} weight="semibold">Label</Text>}
            <Input
              value={point.label}
              onChange={(_e, d) => { update(i, 'label', d.value); }}
              placeholder={labelPlaceholder}
            />
          </div>
          <div className={styles.valueField}>
            {i === 0 && <Text size={200} weight="semibold">Value</Text>}
            <Input
              type="number"
              value={String(point.value)}
              onChange={(_e, d) => { update(i, 'value', Number(d.value) || 0); }}
              placeholder="0"
            />
          </div>
          {data.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { remove(i); }}
              aria-label={`Remove data point ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={add}
        style={{ alignSelf: 'flex-start' }}
      >
        Add data point
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-series editor
// ---------------------------------------------------------------------------

export interface MultiSeriesEditorProps {
  series: ChartSeriesData[];
  onChange: (series: ChartSeriesData[]) => void;
}

export function MultiSeriesEditor({ series, onChange }: MultiSeriesEditorProps) {
  const styles = useStyles();

  const updateSeriesName = useCallback((index: number, legend: string) => {
    const next = series.map((s, i) => (i === index ? { ...s, legend } : s));
    onChange(next);
  }, [series, onChange]);

  const updateSeriesValues = useCallback((index: number, values: { x: string; y: number }[]) => {
    const next = series.map((s, i) => (i === index ? { ...s, values } : s));
    onChange(next);
  }, [series, onChange]);

  const addSeries = useCallback(() => {
    onChange([...series, { legend: '', values: [{ x: '', y: 0 }] }]);
  }, [series, onChange]);

  const removeSeries = useCallback((index: number) => {
    onChange(series.filter((_, i) => i !== index));
  }, [series, onChange]);

  // Adapter: convert ChartSeriesData.values to/from ChartDataPoint[] for SingleSeriesEditor
  const toPoints = (values: { x: string; y: number }[]): ChartDataPoint[] =>
    values.map((v) => ({ label: v.x, value: v.y }));

  const fromPoints = (points: ChartDataPoint[]): { x: string; y: number }[] =>
    points.map((p) => ({ x: p.label, y: p.value }));

  return (
    <div className={styles.container}>
      {series.map((s, i) => (
        <div key={i} className={styles.seriesBlock}>
          <div className={styles.seriesHeader}>
            <Field label={`Series ${i + 1}`} style={{ flex: 1 }}>
              <Input
                value={s.legend}
                onChange={(_e, d) => { updateSeriesName(i, d.value); }}
                placeholder="Series name"
              />
            </Field>
            {series.length > 1 && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeSeries(i); }}
                aria-label={`Remove series ${i + 1}`}
              />
            )}
          </div>
          <SingleSeriesEditor
            data={toPoints(s.values)}
            labelPlaceholder="X value"
            onChange={(points) => { updateSeriesValues(i, fromPoints(points)); }}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSeries}
        style={{ alignSelf: 'flex-start' }}
      >
        Add series
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ChartDataEditor.tsx
git commit -m "feat(ui): add shared ChartDataEditor component for chart block editors"
```

---

## Task 8: AdvancedBlockEditors — All 15 Editors

**Files:**
- Create: `src/.../components/ComposePanel/AdvancedBlockEditors.tsx`

**Step 1: Create the file with all 15 editors + dispatch**

This is a large file. The dispatch `AdvancedBlockEditor` component routes to the correct sub-editor based on `AdvancedBlockType`. Each editor follows the same pattern as existing `ExtendedSlotEditors.tsx` editors.

```tsx
// AdvancedBlockEditors.tsx — 15 advanced block editors for Phase C2
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Button,
  Select,
  Switch,
  SpinButton,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { AdvancedBlockType } from '@/types';
import { SingleSeriesEditor, MultiSeriesEditor } from './ChartDataEditor';
import type { ChartDataPoint, ChartSeriesData } from '@/types';

// ---------------------------------------------------------------------------
// Styles (shared across all editors)
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },
  segmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
  toggleGroup: {
    display: 'flex',
    gap: '2px',
  },
  toggleBtn: {
    minWidth: '28px',
    padding: '2px 4px',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AdvancedBlockEditorProps {
  type: AdvancedBlockType;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function AdvancedBlockEditor({ type, data, onChange }: AdvancedBlockEditorProps) {
  const styles = useStyles();

  switch (type) {
    // Content
    case 'richText':
      return <RichTextEditor data={data} onChange={onChange} styles={styles} />;
    case 'icon':
      return <IconEditor data={data} onChange={onChange} styles={styles} />;
    case 'badge':
      return <BadgeEditor data={data} onChange={onChange} styles={styles} />;
    case 'codeBlock':
      return <CodeBlockEditor data={data} onChange={onChange} styles={styles} />;
    case 'ratingDisplay':
      return <RatingDisplayEditor data={data} onChange={onChange} styles={styles} />;
    case 'compoundButton':
      return <CompoundButtonEditor data={data} onChange={onChange} styles={styles} />;
    // Layout
    case 'flowLayout':
      return <FlowLayoutEditor data={data} onChange={onChange} styles={styles} />;
    case 'gridLayout':
      return <GridLayoutEditor data={data} onChange={onChange} styles={styles} />;
    // Charts
    case 'donutChart':
      return <DonutChartEditor data={data} onChange={onChange} styles={styles} />;
    case 'verticalBar':
      return <VerticalBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'groupedBar':
      return <GroupedBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'horizontalBar':
      return <HorizontalBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'stackedBar':
      return <StackedBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'lineChart':
      return <LineChartEditor data={data} onChange={onChange} styles={styles} />;
    case 'gauge':
      return <GaugeEditor data={data} onChange={onChange} styles={styles} />;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Shared editor props
// ---------------------------------------------------------------------------

type Styles = ReturnType<typeof useStyles>;

interface EditorProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  styles: Styles;
}

// ============================================================================
// CONTENT EDITORS
// ============================================================================

// ---------------------------------------------------------------------------
// RichTextEditor — TextRun segments with inline formatting
// ---------------------------------------------------------------------------

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: string;
}

function RichTextEditor({ data, onChange, styles }: EditorProps) {
  const segments = (data.segments as Segment[]) ?? [{ text: '' }];

  const updateSegment = useCallback((index: number, updates: Partial<Segment>) => {
    const next = segments.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange({ ...data, segments: next });
  }, [data, segments, onChange]);

  const addSegment = useCallback(() => {
    onChange({ ...data, segments: [...segments, { text: '' }] });
  }, [data, segments, onChange]);

  const removeSegment = useCallback((index: number) => {
    onChange({ ...data, segments: segments.filter((_, i) => i !== index) });
  }, [data, segments, onChange]);

  return (
    <div className={styles.container}>
      {segments.map((seg, i) => (
        <div key={i} className={styles.segmentRow}>
          <div className={styles.field}>
            <Input
              value={seg.text}
              onChange={(_e, d) => { updateSegment(i, { text: d.value }); }}
              placeholder="Text segment..."
            />
          </div>
          <div className={styles.toggleGroup}>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.bold ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { bold: !seg.bold }); }}
              aria-label="Bold"
            >
              <strong>B</strong>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.italic ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { italic: !seg.italic }); }}
              aria-label="Italic"
            >
              <em>I</em>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.strikethrough ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { strikethrough: !seg.strikethrough }); }}
              aria-label="Strikethrough"
            >
              <s>S</s>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.underline ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { underline: !seg.underline }); }}
              aria-label="Underline"
            >
              <u>U</u>
            </Button>
          </div>
          {segments.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeSegment(i); }}
              aria-label={`Remove segment ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSegment}
        style={{ alignSelf: 'flex-start' }}
      >
        Add text segment
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconEditor
// ---------------------------------------------------------------------------

function IconEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Icon name">
            <Input
              value={(data.name as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, name: d.value }); }}
              placeholder="e.g. Calendar, Heart, Star"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Size">
            <Select
              value={(data.size as string) ?? 'Standard'}
              onChange={(_e, d) => { onChange({ ...data, size: d.value }); }}
            >
              <option value="xxSmall">XX-Small</option>
              <option value="xSmall">X-Small</option>
              <option value="Small">Small</option>
              <option value="Standard">Standard</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
              <option value="xLarge">X-Large</option>
              <option value="xxLarge">XX-Large</option>
            </Select>
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Color">
            <Select
              value={(data.color as string) ?? 'Default'}
              onChange={(_e, d) => { onChange({ ...data, color: d.value }); }}
            >
              <option value="Default">Default</option>
              <option value="Dark">Dark</option>
              <option value="Light">Light</option>
              <option value="Accent">Accent</option>
              <option value="Good">Good</option>
              <option value="Warning">Warning</option>
              <option value="Attention">Attention</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Style">
            <Select
              value={(data.style as string) ?? 'Regular'}
              onChange={(_e, d) => { onChange({ ...data, style: d.value }); }}
            >
              <option value="Regular">Regular</option>
              <option value="Filled">Filled</option>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BadgeEditor
// ---------------------------------------------------------------------------

function BadgeEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Badge text">
            <Input
              value={(data.text as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, text: d.value }); }}
              placeholder="Status text..."
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Icon (optional)">
            <Input
              value={(data.icon as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, icon: d.value }); }}
              placeholder="e.g. CheckmarkCircle"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeBlockEditor
// ---------------------------------------------------------------------------

const CODE_LANGUAGES = [
  'PlainText', 'Bash', 'C', 'C++', 'C#', 'CSS', 'DOS', 'Go', 'GraphQL',
  'HTML', 'Java', 'JavaScript', 'JSON', 'Perl', 'PHP', 'PowerShell',
  'Python', 'SQL', 'TypeScript', 'Visual Basic', 'XML',
];

function CodeBlockEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <Field label="Language">
        <Select
          value={(data.language as string) ?? 'PlainText'}
          onChange={(_e, d) => { onChange({ ...data, language: d.value }); }}
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </Select>
      </Field>
      <Field label="Code">
        <Textarea
          value={(data.code as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, code: d.value }); }}
          placeholder="Paste or type code here..."
          rows={6}
          resize="vertical"
          style={{ fontFamily: 'monospace' }}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RatingDisplayEditor
// ---------------------------------------------------------------------------

function RatingDisplayEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Rating value">
            <SpinButton
              value={Number(data.value) || 0}
              min={0}
              max={Number(data.max) || 5}
              step={0.5}
              onChange={(_e, d) => { onChange({ ...data, value: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Max stars">
            <SpinButton
              value={Number(data.max) || 5}
              min={1}
              max={10}
              onChange={(_e, d) => { onChange({ ...data, max: d.value ?? 5 }); }}
            />
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Color">
            <Select
              value={(data.color as string) ?? 'Neutral'}
              onChange={(_e, d) => { onChange({ ...data, color: d.value }); }}
            >
              <option value="Neutral">Neutral</option>
              <option value="Marigold">Marigold (gold)</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Style">
            <Select
              value={(data.style as string) ?? 'Default'}
              onChange={(_e, d) => { onChange({ ...data, style: d.value }); }}
            >
              <option value="Default">Default (stars)</option>
              <option value="Compact">Compact (number)</option>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompoundButtonEditor
// ---------------------------------------------------------------------------

function CompoundButtonEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <Field label="Button title">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Click me"
        />
      </Field>
      <Field label="Description (optional)">
        <Input
          value={(data.description as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, description: d.value }); }}
          placeholder="Additional context..."
        />
      </Field>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Icon (optional)">
            <Input
              value={(data.icon as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, icon: d.value }); }}
              placeholder="e.g. Send"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="URL (optional)">
            <Input
              value={(data.url as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, url: d.value }); }}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LAYOUT EDITORS
// ============================================================================

// ---------------------------------------------------------------------------
// FlowLayoutEditor
// ---------------------------------------------------------------------------

function FlowLayoutEditor({ data, onChange, styles }: EditorProps) {
  const items = (data.items as Array<{ text: string; icon?: string }>) ?? [{ text: '' }];

  const updateItem = useCallback((index: number, field: string, val: string) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: val } : item));
    onChange({ ...data, items: next });
  }, [data, items, onChange]);

  const addItem = useCallback(() => {
    onChange({ ...data, items: [...items, { text: '' }] });
  }, [data, items, onChange]);

  const removeItem = useCallback((index: number) => {
    onChange({ ...data, items: items.filter((_, i) => i !== index) });
  }, [data, items, onChange]);

  return (
    <div className={styles.container}>
      <Field label="Item width (optional)">
        <Input
          value={(data.itemWidth as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, itemWidth: d.value }); }}
          placeholder='e.g. "150px"'
        />
      </Field>
      {items.map((item, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={item.text}
              onChange={(_e, d) => { updateItem(i, 'text', d.value); }}
              placeholder="Item text"
            />
          </div>
          <div className={styles.field}>
            <Input
              value={item.icon ?? ''}
              onChange={(_e, d) => { updateItem(i, 'icon', d.value); }}
              placeholder="Icon (optional)"
            />
          </div>
          {items.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeItem(i); }}
              aria-label={`Remove item ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addItem}
        style={{ alignSelf: 'flex-start' }}
      >
        Add item
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GridLayoutEditor
// ---------------------------------------------------------------------------

function GridLayoutEditor({ data, onChange, styles }: EditorProps) {
  const columns = (data.columns as number[]) ?? [50, 50];
  const areas = (data.areas as Array<{ name: string; content: string; imageUrl?: string }>) ?? [
    { name: 'left', content: '' },
    { name: 'right', content: '' },
  ];

  const updateColumn = useCallback((index: number, val: number) => {
    const next = [...columns];
    next[index] = val;
    onChange({ ...data, columns: next });
  }, [data, columns, onChange]);

  const updateArea = useCallback((index: number, field: string, val: string) => {
    const next = areas.map((a, i) => (i === index ? { ...a, [field]: val } : a));
    onChange({ ...data, areas: next });
  }, [data, areas, onChange]);

  const addArea = useCallback(() => {
    onChange({
      ...data,
      columns: [...columns, 50],
      areas: [...areas, { name: `area-${areas.length}`, content: '' }],
    });
  }, [data, columns, areas, onChange]);

  const removeArea = useCallback((index: number) => {
    if (areas.length <= 1) return;
    onChange({
      ...data,
      columns: columns.filter((_, i) => i !== index),
      areas: areas.filter((_, i) => i !== index),
    });
  }, [data, columns, areas, onChange]);

  return (
    <div className={styles.container}>
      <Text size={200} weight="semibold">Column widths (%)</Text>
      <div className={styles.row}>
        {columns.map((w, i) => (
          <div key={i} className={styles.field}>
            <SpinButton
              value={w}
              min={10}
              max={90}
              step={5}
              onChange={(_e, d) => { updateColumn(i, d.value ?? 50); }}
              size="small"
            />
          </div>
        ))}
      </div>
      {areas.map((area, i) => (
        <div key={i} className={styles.container} style={{ padding: tokens.spacingHorizontalS }}>
          <div className={styles.row}>
            <div className={styles.field}>
              <Field label="Area name">
                <Input
                  value={area.name}
                  onChange={(_e, d) => { updateArea(i, 'name', d.value); }}
                  placeholder="area-name"
                />
              </Field>
            </div>
            {areas.length > 1 && (
              <Button
                className={styles.removeBtn}
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeArea(i); }}
                aria-label={`Remove area ${i + 1}`}
              />
            )}
          </div>
          <Field label="Content">
            <Textarea
              value={area.content}
              onChange={(_e, d) => { updateArea(i, 'content', d.value); }}
              placeholder="Area content..."
              rows={2}
              resize="vertical"
            />
          </Field>
          <Field label="Image URL (optional)">
            <Input
              value={area.imageUrl ?? ''}
              onChange={(_e, d) => { updateArea(i, 'imageUrl', d.value); }}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addArea}
        style={{ alignSelf: 'flex-start' }}
      >
        Add area
      </Button>
    </div>
  );
}

// ============================================================================
// CHART EDITORS — All delegate to SingleSeriesEditor or MultiSeriesEditor
// ============================================================================

// ---------------------------------------------------------------------------
// DonutChartEditor
// ---------------------------------------------------------------------------

function DonutChartEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Donut chart title"
        />
      </Field>
      <Field label="Color set">
        <Select
          value={(data.colorSet as string) ?? 'categorical'}
          onChange={(_e, d) => { onChange({ ...data, colorSet: d.value }); }}
        >
          <option value="categorical">Categorical</option>
          <option value="sequential">Sequential</option>
          <option value="diverging">Diverging</option>
        </Select>
      </Field>
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerticalBarEditor
// ---------------------------------------------------------------------------

function VerticalBarEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Bar chart title"
        />
      </Field>
      <Switch
        label="Show bar values"
        checked={Boolean(data.showBarValues)}
        onChange={(_e, d) => { onChange({ ...data, showBarValues: d.checked }); }}
      />
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupedBarEditor
// ---------------------------------------------------------------------------

function GroupedBarEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as ChartSeriesData[]) ?? [{ legend: '', values: [{ x: '', y: 0 }] }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Grouped bar chart title"
        />
      </Field>
      <div className={styles.row}>
        <Switch
          label="Stacked"
          checked={Boolean(data.stacked)}
          onChange={(_e, d) => { onChange({ ...data, stacked: d.checked }); }}
        />
        <Switch
          label="Show values"
          checked={Boolean(data.showBarValues)}
          onChange={(_e, d) => { onChange({ ...data, showBarValues: d.checked }); }}
        />
      </div>
      <MultiSeriesEditor
        series={series}
        onChange={(s) => { onChange({ ...data, series: s }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HorizontalBarEditor
// ---------------------------------------------------------------------------

function HorizontalBarEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Horizontal bar chart title"
        />
      </Field>
      <Field label="Display mode">
        <Select
          value={(data.displayMode as string) ?? 'AbsoluteWithAxis'}
          onChange={(_e, d) => { onChange({ ...data, displayMode: d.value }); }}
        >
          <option value="AbsoluteWithAxis">Absolute (with axis)</option>
          <option value="AbsoluteNoAxis">Absolute (no axis)</option>
          <option value="PartToWhole">Part-to-whole (%)</option>
        </Select>
      </Field>
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackedBarEditor
// ---------------------------------------------------------------------------

function StackedBarEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as Array<{ title: string; data: ChartDataPoint[] }>) ?? [
    { title: '', data: [{ label: '', value: 0 }] },
  ];

  const updateSeriesTitle = useCallback((index: number, title: string) => {
    const next = series.map((s, i) => (i === index ? { ...s, title } : s));
    onChange({ ...data, series: next });
  }, [data, series, onChange]);

  const updateSeriesData = useCallback((index: number, points: ChartDataPoint[]) => {
    const next = series.map((s, i) => (i === index ? { ...s, data: points } : s));
    onChange({ ...data, series: next });
  }, [data, series, onChange]);

  const addSeries = useCallback(() => {
    onChange({ ...data, series: [...series, { title: '', data: [{ label: '', value: 0 }] }] });
  }, [data, series, onChange]);

  const removeSeries = useCallback((index: number) => {
    onChange({ ...data, series: series.filter((_, i) => i !== index) });
  }, [data, series, onChange]);

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Stacked bar chart title"
        />
      </Field>
      {series.map((s, i) => (
        <div key={i} className={styles.container} style={{ padding: tokens.spacingHorizontalS }}>
          <div className={styles.row}>
            <div className={styles.field}>
              <Field label={`Series ${i + 1}`}>
                <Input
                  value={s.title}
                  onChange={(_e, d) => { updateSeriesTitle(i, d.value); }}
                  placeholder="Series name"
                />
              </Field>
            </div>
            {series.length > 1 && (
              <Button
                className={styles.removeBtn}
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeSeries(i); }}
                aria-label={`Remove series ${i + 1}`}
              />
            )}
          </div>
          <SingleSeriesEditor
            data={s.data}
            onChange={(points) => { updateSeriesData(i, points); }}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSeries}
        style={{ alignSelf: 'flex-start' }}
      >
        Add series
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineChartEditor
// ---------------------------------------------------------------------------

function LineChartEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as ChartSeriesData[]) ?? [{ legend: '', values: [{ x: '', y: 0 }] }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Line chart title"
        />
      </Field>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="X-axis title">
            <Input
              value={(data.xAxisTitle as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, xAxisTitle: d.value }); }}
              placeholder="X axis"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Y-axis title">
            <Input
              value={(data.yAxisTitle as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, yAxisTitle: d.value }); }}
              placeholder="Y axis"
            />
          </Field>
        </div>
      </div>
      <MultiSeriesEditor
        series={series}
        onChange={(s) => { onChange({ ...data, series: s }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GaugeEditor
// ---------------------------------------------------------------------------

function GaugeEditor({ data, onChange, styles }: EditorProps) {
  const segments = (data.segments as Array<{ legend: string; size: number; color?: string }>) ?? [];

  const updateSegment = useCallback((index: number, field: string, val: string | number) => {
    const next = segments.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange({ ...data, segments: next });
  }, [data, segments, onChange]);

  const addSegment = useCallback(() => {
    onChange({ ...data, segments: [...segments, { legend: '', size: 25 }] });
  }, [data, segments, onChange]);

  const removeSegment = useCallback((index: number) => {
    onChange({ ...data, segments: segments.filter((_, i) => i !== index) });
  }, [data, segments, onChange]);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Value">
            <SpinButton
              value={Number(data.value) || 0}
              min={Number(data.min) || 0}
              max={Number(data.max) || 100}
              onChange={(_e, d) => { onChange({ ...data, value: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Min">
            <SpinButton
              value={Number(data.min) || 0}
              onChange={(_e, d) => { onChange({ ...data, min: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Max">
            <SpinButton
              value={Number(data.max) || 100}
              min={1}
              onChange={(_e, d) => { onChange({ ...data, max: d.value ?? 100 }); }}
            />
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Format">
            <Select
              value={(data.valueFormat as string) ?? 'Percentage'}
              onChange={(_e, d) => { onChange({ ...data, valueFormat: d.value }); }}
            >
              <option value="Percentage">Percentage</option>
              <option value="Fraction">Fraction</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Sub-label (optional)">
            <Input
              value={(data.subLabel as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, subLabel: d.value }); }}
              placeholder="e.g. Complete"
            />
          </Field>
        </div>
      </div>

      <Text size={200} weight="semibold">Segments (optional)</Text>
      {segments.map((seg, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={seg.legend}
              onChange={(_e, d) => { updateSegment(i, 'legend', d.value); }}
              placeholder="Segment label"
            />
          </div>
          <div className={styles.field}>
            <SpinButton
              value={seg.size}
              min={1}
              max={100}
              onChange={(_e, d) => { updateSegment(i, 'size', d.value ?? 25); }}
              size="small"
            />
          </div>
          <Button
            className={styles.removeBtn}
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            onClick={() => { removeSegment(i); }}
            aria-label={`Remove segment ${i + 1}`}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSegment}
        style={{ alignSelf: 'flex-start' }}
      >
        Add segment
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/AdvancedBlockEditors.tsx
git commit -m "feat(ui): add 15 advanced block editors for Phase C2"
```

---

## Task 9: AddSectionPalette — 15 New Block Entries

**Files:**
- Modify: `src/.../components/ComposePanel/AddSectionPalette.tsx`

**Step 1: Widen BlockDef.type and import**

Change line 15:
```ts
import type { ExtendedSlotType, AdvancedBlockType } from '@/types';
```

Change the `BlockDef` interface (line 63-70):
```ts
interface BlockDef {
  type: ExtendedSlotType | AdvancedBlockType;
  name: string;
  description: string;
  icon: string;
  category: 'content' | 'layout' | 'media' | 'dataviz';
  defaultData: Record<string, unknown>;
}
```

**Step 2: Add 15 new entries to BLOCK_DEFS**

After the existing 7 entries (after line 79), add:

```ts
  // Phase C2 — Content blocks
  { type: 'richText', name: 'Rich Text', description: 'Formatted text segments', icon: '\u{1F4DD}', category: 'content', defaultData: { segments: [{ text: '' }] } },
  { type: 'icon', name: 'Icon', description: 'Fluent icon', icon: '\u{2B50}', category: 'content', defaultData: { name: '', size: 'Standard', style: 'Regular' } },
  { type: 'badge', name: 'Badge', description: 'Status indicator', icon: '\u{1F3F7}', category: 'content', defaultData: { text: '' } },
  { type: 'codeBlock', name: 'Code Block', description: 'Syntax-highlighted code', icon: '\u{1F4BB}', category: 'content', defaultData: { code: '', language: 'PlainText' } },
  { type: 'ratingDisplay', name: 'Rating', description: 'Star rating display', icon: '\u{2B50}', category: 'content', defaultData: { value: 0, max: 5 } },
  { type: 'compoundButton', name: 'Compound Button', description: 'Button with description', icon: '\u{1F518}', category: 'content', defaultData: { title: '' } },
  // Phase C2 — Layout blocks
  { type: 'flowLayout', name: 'Flow Layout', description: 'Wrapping flow items', icon: '\u{27A1}', category: 'layout', defaultData: { items: [{ text: '' }] } },
  { type: 'gridLayout', name: 'Grid Layout', description: 'CSS Grid areas', icon: '\u{1F4D0}', category: 'layout', defaultData: { columns: [50, 50], areas: [{ name: 'left', content: '' }, { name: 'right', content: '' }] } },
  // Phase C2 — Chart blocks
  { type: 'donutChart', name: 'Donut Chart', description: 'Pie / donut chart', icon: '\u{1F369}', category: 'dataviz', defaultData: { data: [{ label: '', value: 0 }] } },
  { type: 'verticalBar', name: 'Bar Chart', description: 'Vertical bars', icon: '\u{1F4CA}', category: 'dataviz', defaultData: { data: [{ label: '', value: 0 }] } },
  { type: 'groupedBar', name: 'Grouped Bars', description: 'Multi-series bars', icon: '\u{1F4CA}', category: 'dataviz', defaultData: { series: [{ legend: '', values: [{ x: '', y: 0 }] }] } },
  { type: 'horizontalBar', name: 'Horizontal Bars', description: 'Horizontal bar chart', icon: '\u{1F4CA}', category: 'dataviz', defaultData: { data: [{ label: '', value: 0 }] } },
  { type: 'stackedBar', name: 'Stacked Bars', description: 'Stacked horizontal bars', icon: '\u{1F4CA}', category: 'dataviz', defaultData: { series: [{ title: '', data: [{ label: '', value: 0 }] }] } },
  { type: 'lineChart', name: 'Line Chart', description: 'Multi-series lines', icon: '\u{1F4C8}', category: 'dataviz', defaultData: { series: [{ legend: '', values: [{ x: '', y: 0 }] }] } },
  { type: 'gauge', name: 'Gauge', description: 'Circular gauge', icon: '\u{1F3AF}', category: 'dataviz', defaultData: { value: 0, min: 0, max: 100 } },
```

**Step 3: Add 'dataviz' to CATEGORIES**

Replace the CATEGORIES array (lines 82-86):

```ts
const CATEGORIES = [
  { key: 'content' as const, label: 'Content' },
  { key: 'layout' as const, label: 'Layout' },
  { key: 'media' as const, label: 'Media' },
  { key: 'dataviz' as const, label: 'Data Visualization' },
];
```

**Step 4: Widen onAdd prop type**

Change the `AddSectionPaletteProps` interface (lines 92-94):

```ts
export interface AddSectionPaletteProps {
  onAdd: (type: ExtendedSlotType | AdvancedBlockType, defaultData: Record<string, unknown>) => void;
}
```

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/AddSectionPalette.tsx
git commit -m "feat(ui): add 15 Phase C2 blocks to AddSectionPalette with dataviz category"
```

---

## Task 10: PropertyPanel — 15 New Property Definitions

**Files:**
- Modify: `src/.../components/ComposePanel/PropertyPanel.tsx`

**Step 1: Widen PROPERTY_DEFS type**

Change line 12 import to include `AnyBlockType`:

```ts
import type { SlotType, AnyBlockType } from '@/types';
```

Change line 62:

```ts
const PROPERTY_DEFS: Partial<Record<AnyBlockType, PropertyDef[]>> = {
```

Change `PropertyPanelProps.slotType` at line 131:

```ts
  slotType: AnyBlockType;
```

**Step 2: Add 15 new entries after the existing entries**

After `iconTextRow` entry (line 123), add:

```ts
  // Phase C2 — Content blocks
  richText: [
    { key: 'spacing', label: 'Spacing', type: 'enum', options: ['None', 'Small', 'Medium', 'Large'], defaultValue: 'Medium' },
  ],
  icon: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  badge: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  codeBlock: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  ratingDisplay: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  compoundButton: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  // Phase C2 — Layout blocks
  flowLayout: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  gridLayout: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  // Phase C2 — Chart blocks
  donutChart: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  verticalBar: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  groupedBar: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  horizontalBar: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  stackedBar: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  lineChart: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  gauge: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
```

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/PropertyPanel.tsx
git commit -m "feat(ui): add Phase C2 property definitions for 15 block types"
```

---

## Task 11: SlotList — Wire Up AdvancedBlockEditor

**Files:**
- Modify: `src/.../components/ComposePanel/SlotList.tsx`

**Step 1: Add imports**

Add to the imports (after line 28):

```ts
import { AdvancedBlockEditor } from './AdvancedBlockEditors';
```

Update line 25 to also import `AdvancedBlockType` and `AnyBlockType`:

```ts
import type { TemplateDefinition, ExtendedSlotType, AdvancedBlockType, AnyBlockType, SlotType } from '@/types';
```

**Step 2: Add ADVANCED_BLOCK_LABELS**

After `EXTENDED_SLOT_LABELS` (line 74), add:

```ts
const ADVANCED_BLOCK_LABELS: Record<AdvancedBlockType, string> = {
  richText: 'Rich Text',
  icon: 'Icon',
  badge: 'Badge',
  codeBlock: 'Code Block',
  ratingDisplay: 'Rating Display',
  compoundButton: 'Compound Button',
  flowLayout: 'Flow Layout',
  gridLayout: 'Grid Layout',
  donutChart: 'Donut Chart',
  verticalBar: 'Vertical Bar Chart',
  groupedBar: 'Grouped Bar Chart',
  horizontalBar: 'Horizontal Bar Chart',
  stackedBar: 'Stacked Bar Chart',
  lineChart: 'Line Chart',
  gauge: 'Gauge',
};

const ALL_BLOCK_LABELS: Record<string, string> = {
  ...EXTENDED_SLOT_LABELS,
  ...ADVANCED_BLOCK_LABELS,
};
```

**Step 3: Widen UnifiedSlot.type**

Change `UnifiedSlot` interface at line 82:

```ts
  type: AnyBlockType;
```

**Step 4: Update label resolution in unifiedSlots**

At line 186, change:

```ts
      label: EXTENDED_SLOT_LABELS[s.type as ExtendedSlotType] ?? s.type,
```

To:

```ts
      label: ALL_BLOCK_LABELS[s.type] ?? s.type,
```

Also at line 231 (inside `handleDragEnd`), change the same pattern:

```ts
          label: EXTENDED_SLOT_LABELS[s.type as ExtendedSlotType] ?? s.type,
```

To:

```ts
          label: ALL_BLOCK_LABELS[s.type] ?? s.type,
```

**Step 5: Widen handleAddSection parameter type**

At line 268, change:

```ts
    (type: ExtendedSlotType, defaultData: Record<string, unknown>) => {
```

To:

```ts
    (type: ExtendedSlotType | AdvancedBlockType, defaultData: Record<string, unknown>) => {
```

**Step 6: Update the editor dispatch in the render section**

At lines 364-369, replace the `ExtendedSlotEditor` call:

```ts
          <ExtendedSlotEditor
            type={slot.type as ExtendedSlotType}
            data={safeAdditionalSlots.find((a) => a.id === slot.id)?.data ?? {}}
            onChange={(newData) => { handleAdditionalDataChange(slot.id, newData); }}
          />
```

With a check that dispatches to the right editor:

```ts
          {isAdvancedBlockType(slot.type) ? (
            <AdvancedBlockEditor
              type={slot.type as AdvancedBlockType}
              data={safeAdditionalSlots.find((a) => a.id === slot.id)?.data ?? {}}
              onChange={(newData) => { handleAdditionalDataChange(slot.id, newData); }}
            />
          ) : (
            <ExtendedSlotEditor
              type={slot.type as ExtendedSlotType}
              data={safeAdditionalSlots.find((a) => a.id === slot.id)?.data ?? {}}
              onChange={(newData) => { handleAdditionalDataChange(slot.id, newData); }}
            />
          )}
```

**Step 7: Add helper function**

Before the `SlotList` function (e.g., after the `generateId` helper at line 98), add:

```ts
const ADVANCED_BLOCK_TYPES: Set<string> = new Set<string>([
  'richText', 'icon', 'badge', 'codeBlock', 'ratingDisplay', 'compoundButton',
  'flowLayout', 'gridLayout',
  'donutChart', 'verticalBar', 'groupedBar', 'horizontalBar', 'stackedBar', 'lineChart', 'gauge',
]);

function isAdvancedBlockType(type: string): type is AdvancedBlockType {
  return ADVANCED_BLOCK_TYPES.has(type);
}
```

**Step 8: Run verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit && npx vite build`
Expected: PASS

**Step 9: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/SlotList.tsx
git commit -m "feat(ui): wire AdvancedBlockEditor dispatch into SlotList for Phase C2 blocks"
```

---

## Task 12: Final Verification + Combined Commit

**Step 1: Full type-check and build**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit && npx vite build`
Expected: PASS with zero errors.

**Step 2: Verify no regressions**

Quick smoke-check: ensure all existing Phase C functionality still works by confirming:
- `ExtendedSlotType` values still route to `ExtendedSlotEditor` (not to `AdvancedBlockEditor`)
- `SlotType` and `AnyBlockType` unions still include all original types
- `SLOT_BUILDERS` has entries for all `AnyBlockType` values (no missing keys)

**Step 3: If any type errors remain, fix and re-verify**

Common issues:
- Missing import in `types/index.ts` for a new type
- Zod enum missing a new block type string
- `SLOT_BUILDERS` missing an entry (TypeScript will flag this since it's `Record<AnyBlockType, ...>`)
