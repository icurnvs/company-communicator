# Phase C2 Handoff — Advanced Compose Layer 2

> **Date**: 2026-02-20
> **Branch**: `main` at `780dbaf`
> **Working dir**: `C:\Users\icurn\Nextcloud\GitHubRepos\company-communicator\`
> **ClientApp src**: `src/CompanyCommunicator.Api/ClientApp/src/`

---

## What's Been Done (Phases A → C)

### Phase A — Foundation
Pipeline infrastructure: `CardElementTree` intermediate representation, typed slot definitions, 6 built-in themes, 8 built-in templates as `TemplateDefinition` objects, serializer to Adaptive Card JSON, theme engine, variable resolver.

### Phase B — Template Compose (Tier 1)
Slot-based compose editor with live preview, template picker grid, theme picker strip, three-theme preview toggle (light/dark/high-contrast). Replaces old compose entirely.

### Phase C — Advanced Compose Layer 1
Advanced mode toggle (localStorage-persisted), 7 extended slot editors (imageGallery, statsRow, quoteCallout, columns, table, expandableSection, iconTextRow), drag-to-reorder via @dnd-kit, per-slot property panels, CardSettingsPanel (full-width + accent override), Add Section palette, Save as Template.

**All of the above is merged to `main`, type-checks clean, and `vite build` passes.**

---

## What Phase C2 Adds

**"AC Power Tools"** — 15 entirely new Adaptive Cards element types that don't have pipeline builders yet. Each requires the full vertical: type definition → pipeline builder → serializer support → slot editor → formBridge mapping.

### The 15 Block Types (from `types/cardBuilder.ts` `AdvancedBlockType`)

**Content (6):**
| Type | AC Element | User-Facing Name |
|------|-----------|-----------------|
| `richText` | RichTextBlock with TextRun segments | Rich Text |
| `icon` | Icon element (Fluent icon by name) | Icon |
| `badge` | Badge element (Teams extended) | Badge |
| `codeBlock` | CodeBlock element (Teams extended) | Code Block |
| `ratingDisplay` | Rating element (read-only stars) | Rating Display |
| `compoundButton` | CompoundButton (Teams extended) | Compound Button |

**Layout (2):**
| Type | AC Element | User-Facing Name |
|------|-----------|-----------------|
| `gridLayout` | Layout.AreaGrid (Teams extended) | Grid Layout |
| `flowLayout` | Layout.Flow (Teams extended) | Flow Layout |

**Data Viz (7):**
| Type | AC Element | User-Facing Name |
|------|-----------|-----------------|
| `donutChart` | Chart.Donut (Teams extended) | Donut / Pie Chart |
| `verticalBar` | Chart.VerticalBar | Vertical Bar Chart |
| `groupedBar` | Chart.VerticalBar (grouped) | Grouped Bar Chart |
| `horizontalBar` | Chart.HorizontalBar | Horizontal Bar Chart |
| `stackedBar` | Chart.VerticalBar (stacked) | Stacked Bar Chart |
| `lineChart` | Chart.Line | Line Chart |
| `gauge` | Chart.Gauge | Gauge |

### Deferred Type Rename
Phase C design doc noted: rename `AdvancedBlockType` in `cardBuilder.ts` to something clearer (e.g. `Tier2BlockType`). This is optional but was deferred.

---

## Architecture — How to Add a New Block Type

Each new type follows the same vertical pattern. Here's the pipeline:

```
User fills editor → form.additionalSlots[i].data
  → formBridge maps to CardDocument.additionalSlots[i]
  → cardElementTree.resolveTemplate() calls builder function
  → builder returns CardElement nodes
  → serializer converts CardElement → AC JSON
  → preview renders
```

### Files to Touch Per Block Type

1. **`types/cardBuilder.ts`** — Add slot value interface (e.g. `RichTextSlotValue`)
2. **`lib/cardElementTree.ts`** — Add builder function in `buildAdditionalSlot()` switch
3. **`lib/serializer.ts`** — Add serialization case if the AC element type isn't already handled
4. **`components/ComposePanel/ExtendedSlotEditors.tsx`** — Add sub-editor component + case in dispatch switch
5. **`components/ComposePanel/AddSectionPalette.tsx`** — Add to `BLOCK_DEFS` array with category, icon, default data
6. **`components/ComposePanel/PropertyPanel.tsx`** — Add to `PROPERTY_DEFS` if the type has configurable AC properties
7. **`types/cardBuilder.ts`** — Move type from `AdvancedBlockType` to `ExtendedSlotType` union (or create a new union)

### Existing Pattern to Follow

Look at how `statsRow` is implemented end-to-end:
- Value type: `StatsRowSlotValue` in `cardBuilder.ts`
- Builder: `buildStatsRow()` in `cardElementTree.ts`
- Serializer: handled by existing `ColumnSet` serialization
- Editor: `StatsRowEditor` in `ExtendedSlotEditors.tsx`
- Palette entry: in `AddSectionPalette.tsx` BLOCK_DEFS
- Properties: `PROPERTY_DEFS.statsRow` in `PropertyPanel.tsx`

---

## Key Reference Documents

Read these IN ORDER before writing code:

1. **`docs/plans/2026-02-20-card-builder-redesign.md`** — Master design doc, Section 3 "Advanced-Only Blocks" lists all 15 types
2. **`docs/adaptive-cards-capability-reference.md`** — Complete AC element reference with Teams-extended schema (charts, badges, icons, layouts). **This is critical** — it documents the exact JSON structure each element needs
3. **`docs/plans/2026-02-20-phase-c-advanced-compose-design.md`** — Phase C design, Section 1 explains the C/C2 split rationale

---

## Key Source Files

### Types
- `src/.../types/cardBuilder.ts` — `AdvancedBlockType` (15 types), `ExtendedSlotType` (7 types), `SlotType`, all slot value interfaces
- `src/.../types/index.ts` — Re-exports, `LegacyBlockType` (old 6-type union)

### Pipeline
- `src/.../lib/cardElementTree.ts` — `resolveTemplate()`, `buildAdditionalSlot()` dispatch, all builder functions
- `src/.../lib/serializer.ts` — `serializeToAdaptiveCard()`, converts `CardElement` tree to AC JSON
- `src/.../lib/cardPipeline.ts` — `buildCardFromDocument()` orchestrator
- `src/.../lib/themeEngine.ts` — Theme application to element tree

### UI Components
- `src/.../components/ComposePanel/ExtendedSlotEditors.tsx` — 7 sub-editors + dispatch (add new editors here)
- `src/.../components/ComposePanel/AddSectionPalette.tsx` — Block palette with `BLOCK_DEFS` array (add new blocks here)
- `src/.../components/ComposePanel/PropertyPanel.tsx` — `PROPERTY_DEFS` per slot type (add new property sets here)
- `src/.../components/ComposePanel/SlotList.tsx` — DnD-enabled slot list (no changes needed)

### Form
- `src/.../lib/validators.ts` — Zod schema, `ComposeFormValues`, `formToApiFields`
- `src/.../lib/formBridge.ts` — `formValuesToCardDocument()` (no changes needed — already maps `additionalSlots` generically)

---

## Suggested Approach

Phase C2 is 15 block types × 5 files each = ~75 touch points. Consider:

1. **Start with brainstorming** — Use `/brainstorming` to decide: do all 15 types at once, or prioritize a subset? Charts are niche; richText/icon/badge are broadly useful.
2. **Batch by category** — Content blocks first (richText, icon, badge, codeBlock, ratingDisplay, compoundButton), then layout (gridLayout, flowLayout), then charts last.
3. **Each block is independent** — Once the pattern is established with the first block, the rest are parallelizable.
4. **Charts need special data input UX** — The design doc specifically notes "charts may warrant a specialized data input UX." A chart data editor (labels + values) is different from text inputs.
5. **Test with AC reference** — Cross-reference each block's JSON output against `docs/adaptive-cards-capability-reference.md` to ensure correctness.

---

## Tech Stack

- React 19, TypeScript 5.6, Fluent UI v9, react-hook-form + Zod
- Vite 6, @dnd-kit/core + sortable + modifiers + utilities
- No backend changes needed — all block types serialize to JSON stored in existing fields

## Commands

```bash
cd src/CompanyCommunicator.Api/ClientApp
npx tsc --noEmit          # type-check
npx vite build            # production build
npm run dev               # dev server (if configured)
```
