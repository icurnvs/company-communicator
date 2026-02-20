# Phase C2 Design — Advanced Block Types (AC Power Tools)

> **Date**: 2026-02-20
> **Status**: Approved
> **Prerequisite**: Phase C (Advanced Compose Layer 1) merged to `main` at `780dbaf`

---

## Goal

Add 15 new Adaptive Cards element types to the card builder, each with the full vertical: type definition, pipeline builder, serializer support, slot editor, palette entry, and property panel.

## Scope

### In Scope
- 6 content blocks: richText, icon, badge, codeBlock, ratingDisplay, compoundButton
- 2 layout blocks: flowLayout, gridLayout
- 7 chart blocks: donutChart, verticalBar, groupedBar, horizontalBar, stackedBar, lineChart, gauge
- All blocks are advanced-mode only (available via "Add Section" palette)
- No backend changes (all serialize to JSON in existing fields)

### Out of Scope
- Nested sub-slots inside layout containers (using fixed content patterns instead)
- Template integration (new blocks only via "Add Section")
- formBridge changes (already maps additionalSlots generically)

---

## 1. Type System

### 1.1 New Value Interfaces (`types/cardBuilder.ts`)

**Content:**

```ts
interface RichTextSlotValue {
  segments: {
    text: string;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    highlight?: boolean;
    color?: string;
  }[];
}

interface IconSlotValue {
  name: string;
  size?: 'xxSmall' | 'xSmall' | 'Small' | 'Standard' | 'Medium' | 'Large' | 'xLarge' | 'xxLarge';
  color?: 'Default' | 'Dark' | 'Light' | 'Accent' | 'Good' | 'Warning' | 'Attention';
  style?: 'Regular' | 'Filled';
}

interface BadgeSlotValue {
  text: string;
  icon?: string;
  appearance?: string;
}

interface CodeBlockSlotValue {
  code: string;
  language: string;
  startLineNumber?: number;
}

interface RatingDisplaySlotValue {
  value: number;
  max?: number;
  color?: 'Neutral' | 'Marigold';
  style?: 'Default' | 'Compact';
  count?: number;
}

interface CompoundButtonSlotValue {
  title: string;
  description?: string;
  icon?: string;
  badge?: string;
  url?: string;
}
```

**Layout:**

```ts
interface FlowLayoutSlotValue {
  items: { text: string; icon?: string }[];
  itemWidth?: string;
  columnSpacing?: string;
}

interface GridLayoutSlotValue {
  columns: number[];
  areas: { name: string; content: string; imageUrl?: string }[];
}
```

**Charts (shared base):**

```ts
interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartSeriesData {
  legend: string;
  color?: string;
  values: { x: string; y: number }[];
}

interface DonutChartSlotValue {
  title?: string;
  data: ChartDataPoint[];
  colorSet?: 'categorical' | 'sequential' | 'diverging';
}

interface VerticalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  showBarValues?: boolean;
}

interface GroupedBarSlotValue {
  title?: string;
  series: ChartSeriesData[];
  stacked?: boolean;
  showBarValues?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
}

interface HorizontalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  displayMode?: 'AbsoluteWithAxis' | 'AbsoluteNoAxis' | 'PartToWhole';
}

interface StackedBarSlotValue {
  title?: string;
  series: { title: string; data: ChartDataPoint[] }[];
}

interface LineChartSlotValue {
  title?: string;
  series: ChartSeriesData[];
  xAxisTitle?: string;
  yAxisTitle?: string;
}

interface GaugeSlotValue {
  value: number;
  min?: number;
  max?: number;
  valueFormat?: 'Percentage' | 'Fraction';
  segments?: { legend: string; size: number; color?: string }[];
  subLabel?: string;
}
```

### 1.2 Key Type Change

`AdditionalSlot.type` widens from `SlotType` to `AnyBlockType` (= `SlotType | AdvancedBlockType`).

`SlotValueMap` gets entries for all 15 new types.

---

## 2. Pipeline

### 2.1 Builders (`lib/cardElementTree.ts`)

`SLOT_BUILDERS` type changes from `Record<SlotType, SlotBuilder>` to `Record<AnyBlockType, SlotBuilder>`.

**Content builders** — each returns a leaf `CardElementNode`:
- `buildRichText` → `acType: 'RichTextBlock'`, inlines as TextRun objects in properties
- `buildIcon` → `acType: 'Icon'`, properties: name, size, color, style
- `buildBadge` → `acType: 'Badge'`, properties: text, icon, appearance
- `buildCodeBlock` → `acType: 'CodeBlock'`, properties: codeSnippet, language, startLineNumber
- `buildRatingDisplay` → `acType: 'Rating'`, properties: value, max, color, style, count
- `buildCompoundButton` → `acType: 'CompoundButton'`, properties: title, description, icon, selectAction

**Layout builders** — return Container nodes with `layouts` property:
- `buildFlowLayout` → Container with `layouts: [{ type: 'Layout.Flow', itemWidth, columnSpacing }]`, children are TextBlock/Icon items
- `buildGridLayout` → Container with `layouts: [{ type: 'Layout.AreaGrid', columns, areas }]`, children have `grid.area` property

**Chart builders** — shared helper `buildChartNode(slotId, chartType, data, overrides)`:
- Maps chart slot value to the correct `Chart.*` acType with data in properties
- All chart nodes are leaf elements (no children)

### 2.2 Serializer (`lib/serializer.ts`)

Minimal changes. New leaf AC types have no children — the existing default path passes through `acType` + `properties`. No new `serializeNode` cases needed unless `RichTextBlock` needs special handling for `inlines` (will test and add if needed).

---

## 3. UI Components

### 3.1 File Structure

| File | Purpose |
|------|---------|
| `AdvancedBlockEditors.tsx` (new) | 15 editor components + `AdvancedBlockEditor` dispatch |
| `ChartDataEditor.tsx` (new) | Shared chart data table editor reused by all 7 chart editors |
| `AddSectionPalette.tsx` (modified) | 15 new BLOCK_DEFS entries, new 'dataviz' category |
| `PropertyPanel.tsx` (modified) | 15 new PROPERTY_DEFS entries |
| `SlotList.tsx` (modified) | Dispatch to AdvancedBlockEditor for AdvancedBlockType slots |
| `ExtendedSlotEditors.tsx` (unchanged) | Existing 7 editors stay as-is |

### 3.2 Editor Descriptions

| Editor | Inputs |
|--------|--------|
| RichTextEditor | Add/remove text segments, per-segment bold/italic/strike/underline/highlight toggles, color select |
| IconEditor | Icon name text input, size select, color select, style toggle (Regular/Filled) |
| BadgeEditor | Text input, optional icon name input |
| CodeBlockEditor | Code textarea, language select dropdown (20+ languages) |
| RatingDisplayEditor | Value number input, max stars spinner, color select |
| CompoundButtonEditor | Title input, description input, icon name input, URL input |
| FlowLayoutEditor | Add/remove items list (text + optional icon per item), item width input |
| GridLayoutEditor | Column width inputs, area editor (name + content + optional image per area) |
| Chart editors (7) | All delegate to ChartDataEditor with type-specific config |

### 3.3 ChartDataEditor (Shared)

A reusable component that renders a data table with add/remove rows:

- **Single-series mode** (donut, verticalBar, horizontalBar): label (string) + value (number) per row
- **Multi-series mode** (groupedBar, stackedBar, lineChart): series name field + data rows per series
- **Gauge mode**: value + min/max + segments editor
- Config prop controls which mode and extra fields (colorSet, displayMode, showBarValues, etc.)

### 3.4 AddSectionPalette Changes

New category: `'dataviz'` with label "Data Visualization"

Existing categories remain: content, layout, media.

`BlockDef.type` widens from `ExtendedSlotType` to `ExtendedSlotType | AdvancedBlockType`.

### 3.5 PropertyPanel Changes

New `PROPERTY_DEFS` entries per type. `PROPERTY_DEFS` type widens from `Partial<Record<SlotType, ...>>` to `Partial<Record<AnyBlockType, ...>>`.

---

## 4. Implementation Batches

### Batch 1 — Content blocks (richText, icon, badge, codeBlock, ratingDisplay, compoundButton)
- Type widening: `AdditionalSlot.type`, `SLOT_BUILDERS`, `BlockDef.type`, `PROPERTY_DEFS`
- 6 value interfaces + SlotValueMap entries
- 6 builder functions
- Create `AdvancedBlockEditors.tsx` with 6 editors + dispatch
- 6 BLOCK_DEFS entries, 6 PROPERTY_DEFS entries
- SlotList.tsx wiring
- Verify: `tsc --noEmit && vite build`

### Batch 2 — Layout blocks (flowLayout, gridLayout)
- 2 value interfaces + SlotValueMap entries
- 2 builder functions (Container with layouts property)
- 2 editors in AdvancedBlockEditors.tsx
- 2 BLOCK_DEFS + 2 PROPERTY_DEFS entries
- Verify: `tsc --noEmit && vite build`

### Batch 3 — Chart blocks (7 chart types)
- 7 value interfaces + shared ChartDataPoint/ChartSeriesData types + SlotValueMap entries
- Shared `buildChartNode` helper + 7 thin builder wrappers
- Create `ChartDataEditor.tsx` shared component
- 7 chart editors in AdvancedBlockEditors.tsx
- 7 BLOCK_DEFS + 7 PROPERTY_DEFS entries
- Verify: `tsc --noEmit && vite build`

### Batch 4 — Cleanup + final verification
- Ensure advanced-mode gate on new blocks
- Final type-check + production build
- Verify JSON output against AC capability reference doc
