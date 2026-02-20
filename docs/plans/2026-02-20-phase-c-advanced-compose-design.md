# Phase C Design — Advanced Compose (Tier 2, Layer 1)

> **Date**: 2026-02-20
> **Status**: Design approved
> **Branch**: `feature/card-builder-redesign`
> **Prerequisite**: Phase B complete (Tasks 1-10 committed)

---

## 1. Scope & Phase Split Rationale

### Why Tier 2 Is Split Into Two Phases

The original design doc (Section 9) defined Phase C as the entire Tier 2 "Advanced Compose" experience. Analysis during planning revealed this is really two distinct capability layers:

**Layer 1 (this phase — Phase C):** "Power user compose" — uses the same slot vocabulary from Phase B but adds more control. All 7 extended slot types already have working pipeline builders in `cardElementTree.ts` from Phase A. The work is primarily UI + data bridge.

**Layer 2 (deferred — Phase C2 or E):** "AC power tools" — introduces 15 entirely new Adaptive Cards element types (richText, charts, code blocks, badges, grid/flow layouts). None have pipeline builders yet. Each requires: type definition → pipeline builder → serializer support → slot editor → formBridge mapping. Much larger scope per block type, and much more niche — most users will never use data viz charts in internal comms.

**Benefits of splitting:**
1. Phase C ships a complete, usable Advanced mode without waiting for chart/layout builders
2. Layer 1 builds entirely on existing Phase A pipeline infrastructure
3. Layer 2 can get its own design pass when prioritized (charts may warrant a specialized data input UX)
4. Each phase is independently shippable and testable

### Updated Roadmap

| Phase | Description | Status |
|---|---|---|
| A | Foundation — pipeline, types, templates, themes | Done |
| B | Template Compose (Tier 1) — slot editor, theme picker, 3-theme preview | Done |
| **C** | **Advanced Compose Layer 1 — extended slots, Add Section, drag reorder, property panels, Save as Template** | **This phase** |
| C2 | Advanced Compose Layer 2 — 15 AC-centric block types (richText, charts, grid/flow, etc.) | Future |
| D | Template Editor (Tier 3) — three-panel template authoring screen | Future |

### Phase C Scope

Phase C adds "power user compose" — an Advanced mode toggle that progressively reveals features without disrupting the Tier 1 experience.

**In scope:**
- 7 extended slot type editors (imageGallery, statsRow, quoteCallout, columns, table, expandableSection, iconTextRow)
- "Add Section" block palette (popover with categorized block types)
- Drag-to-reorder all slots via `@dnd-kit`
- Per-slot inline property panels (AC overrides: alignment, size, weight, color, subtle, etc.)
- Card Settings panel (full-width toggle, accent color override)
- "Save as Template" flow
- Advanced mode toggle in ComposePanel header, persisted to localStorage

**Out of scope (deferred to Phase C2):**
- 15 AC-centric block types (richText, charts, code blocks, badges, grid/flow layouts)
- Pipeline builders for those types
- Custom theme creation
- Template Editor (Tier 3 — Phase D)

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model for extended blocks | `additionalSlots` field array on form | Clean separation from core flat fields; maps directly to `CardDocument.additionalSlots` |
| Drag-and-drop library | `@dnd-kit` | Modern, lightweight (~10KB gzip), React 18+ native, built-in a11y (keyboard reorder) |
| Property panel UX | Inline expand per slot | Keeps context close to the slot being edited; no panel-switching or preview displacement |
| Advanced mode toggle location | ComposePanel header bar | Always visible, discoverable, clean |
| Advanced mode persistence | `localStorage` key `cc-advanced-mode` | Power users don't re-toggle every session |
| Table editor complexity | Simple grid (add/remove rows/cols) | No tab-navigation or cell selection; sufficient for small data tables |

---

## 3. Behavior: Advanced Mode OFF vs ON

### Advanced OFF (default — identical to Phase B)

```
ComposePanel
├── header: "New Message" + [Advanced ○] + [X]
├── [Content | Audience]
├── ContentTab (58/42 split)
│   ├── Left: TemplatePicker → ThemePicker → SlotList → CustomVariablesPanel
│   └── Right: CardPreviewPanel
└── ActionBar: [Save Draft] [Review & Send]
```

### Advanced ON

```
ComposePanel
├── header: "New Message" + [Advanced ●] + [X]
├── [Content | Audience]
├── ContentTab (58/42 split)
│   ├── Left:
│   │   ├── TemplatePicker
│   │   ├── CardSettingsPanel (NEW)
│   │   ├── ThemePicker
│   │   ├── SlotList (wrapped in DndContext)
│   │   │   ├── SortableSlotSection (drag handle visible)
│   │   │   │   ├── slot header: drag ≡ + label + toggle + expand ▸
│   │   │   │   ├── SlotEditor / ExtendedSlotEditor
│   │   │   │   └── PropertyPanel (collapsible)
│   │   │   ├── ...more slots...
│   │   │   └── [+ Add Section] button
│   │   └── CustomVariablesPanel
│   └── Right: CardPreviewPanel (unchanged)
└── ActionBar: [Save Draft] [Save as Template] [Review & Send]
```

**Visual changes when toggling Advanced ON:**
- Switch pill animates to filled/checked state
- Drag handles fade in on each slot header (150ms ease)
- Expand chevrons appear on each slot header
- "Add Section" button fades in below the last slot
- CardSettingsPanel slides open above ThemePicker
- "Save as Template" button appears in ActionBar

All transitions use `tokens.durationNormal` / `tokens.curveEasyEase` for Fluent consistency.

---

## 4. Component Architecture

### New Components (6)

#### `CardSettingsPanel`
- Collapsible section (same style as TemplatePicker toggle)
- Controls:
  - Full-width toggle: `Switch` → sets `cardSettings.fullWidth` on form
  - Accent color override: small color input → overrides theme accent for this card only
- Only rendered when `advancedMode === true`

#### `ExtendedSlotEditor`
- Dispatch component (same pattern as `SlotEditor`)
- Switch on `slot.type` → routes to 7 sub-editors
- Receives `data` object from `additionalSlots[i].data` and `onChange` callback

#### `PropertyPanel`
- Generic component, adapts controls to slot type
- Props: `slotType`, `overrides: Record<string, unknown>`, `lockedProperties`, `onChange`
- Layout: compact 2-column grid of labeled controls
- Background: `tokens.colorNeutralBackground2`, border-radius, slight indent
- Locked properties: disabled controls with lock icon + tooltip "Locked by template"
- Animates open/closed with height transition

#### `AddSectionButton`
- Fluent `Button` (appearance="subtle", icon=`Add16Regular`)
- Only rendered when `advancedMode === true`

#### `AddSectionPalette`
- Fluent `Popover` anchored to AddSectionButton
- 2-column card grid, grouped by category (Content / Layout / Media)
- Each card: accent strip + icon + name (same style as TemplatePicker cards, tighter)
- Click → append to `additionalSlots`, close popover, scroll to new slot

#### `SortableSlotSection`
- Wraps each slot for `@dnd-kit` `useSortable()`
- Renders drag handle (`≡` icon) when `advancedMode === true`
- Renders delete button (trash icon) for `additionalSlots` entries only (not core template slots)

### Modified Components (4)

#### `ComposePanel`
- New state: `advancedMode` (initialized from localStorage, synced on change)
- Header: add `Switch` with label "Advanced" next to close button
- Pass `advancedMode` to ContentTab

#### `ContentTab`
- Accept `advancedMode` prop
- Render `CardSettingsPanel` when advanced
- Pass `advancedMode` to `SlotList`
- Manage `additionalSlots` form field (append, remove, reorder)

#### `SlotList`
- Accept `advancedMode` prop
- Wrap slot list in `DndContext` + `SortableContext` (from `@dnd-kit`)
- Render `AddSectionButton` at the end when advanced
- Each slot wrapped in `SortableSlotSection`
- Handle `onDragEnd` → reorder both template slots and additionalSlots by updating `order` values
- Render `PropertyPanel` per slot when advanced + slot is expanded

#### `ActionBar`
- Add "Save as Template" button (subtle appearance, icon: `SaveTemplate16Regular` or similar)
- Only shown when form has content

---

## 5. Data Model

### Form Shape — `ComposeFormValues` additions

```typescript
// Added to ComposeFormValues in validators.ts
additionalSlots: AdditionalSlotEntry[] | null;
advancedOverrides: Record<string, Record<string, unknown>> | null;
cardSettings: CardSettings | null;

interface AdditionalSlotEntry {
  id: string;          // unique key (nanoid or uuid)
  type: ExtendedSlotType;
  data: Record<string, unknown>;  // type-specific editor data
  order: number;
}

interface CardSettings {
  fullWidth: boolean;
  accentColorOverride: string | null;
}

type ExtendedSlotType =
  | 'imageGallery' | 'statsRow' | 'quoteCallout' | 'columns'
  | 'table' | 'expandableSection' | 'iconTextRow';
```

### formBridge Updates

`formValuesToCardDocument()` extended to:
1. Map `additionalSlots` entries → `CardDocument.additionalSlots` (convert `data` to slot value format expected by pipeline builders)
2. Map `advancedOverrides` → `CardDocument.advancedOverrides` (pass-through, already the right shape)
3. Map `cardSettings.fullWidth` → `CardDocument` fullWidth flag
4. Map `cardSettings.accentColorOverride` → theme override in pipeline

### Pipeline Integration

No pipeline changes needed — `resolveTemplate()` already processes `additionalSlots` and `advancedOverrides`. The serializer already supports `fullWidth`. Phase C just populates these fields from the UI.

---

## 6. Extended Slot Editors — Data Shapes

| Type | Editor Controls | `data` Shape |
|---|---|---|
| `imageGallery` | URL list (add/remove) + size dropdown | `{ urls: string[], imageSize: 'small' \| 'medium' \| 'large' \| 'auto' }` |
| `statsRow` | 2-4 value/label pairs (add/remove, max 4) | `{ stats: {value: string, label: string}[] }` |
| `quoteCallout` | Textarea + style dropdown | `{ text: string, style: 'default' \| 'good' \| 'warning' \| 'attention' \| 'accent' }` |
| `columns` | 2-3 column sub-editors (text + optional image) | `{ columns: {text: string, imageUrl?: string}[] }` |
| `table` | Header inputs + cell grid + add row/col buttons | `{ headers: string[], rows: string[][] }` |
| `expandableSection` | Title input + body textarea | `{ title: string, body: string }` |
| `iconTextRow` | Icon name input + text input | `{ iconName: string, text: string }` |

---

## 7. Property Panel — Per-Slot AC Overrides

### Properties by Slot Type

| Slot Type | Properties |
|---|---|
| heading, subheading | Alignment (L/C/R), Size (S/M/L/XL), Weight (Light/Default/Bold), Color (Default/Accent/Good/Warning/Attention), Subtle toggle |
| bodyText, footer | Alignment, Size, Color, Subtle, MaxLines (number input) |
| heroImage | Size (S/M/L/Auto/Stretch), HorizontalAlignment, Background fill toggle |
| keyDetails | Separator toggle |
| linkButton | Style (Default/Positive/Destructive) |
| divider | Thickness, Color |
| quoteCallout | ShowBorder toggle, RoundedCorners toggle |
| columns | Column widths (auto/stretch/weighted) |
| table, statsRow, imageGallery, expandableSection, iconTextRow | Separator toggle only |

### Controls

- Enum properties: Fluent `ToggleButton` groups (segmented)
- Boolean properties: Fluent `Switch`
- Number properties: Fluent `SpinButton` (small)
- All use compact sizing, arranged in a 2-column CSS grid
- Background: `tokens.colorNeutralBackground2`
- Locked properties: controls rendered disabled with `🔒` tooltip "Locked by template"

### Data Flow

```
PropertyPanel onChange(slotId, property, value)
  → form.setValue(`advancedOverrides.${slotId}.${property}`, value)
  → deferredValues picks it up
  → formBridge maps to CardDocument.advancedOverrides
  → resolveTemplate() applies overrides to element tree
  → preview updates
```

---

## 8. Add Section Palette

### Layout

Fluent `Popover` with `positioning="above-start"`, anchored to "Add Section" button.

Categories and blocks:

**Content:**
- Stats Row — `📊` — "Number + label pairs in columns"
- Quote / Callout — `💬` — "Highlighted text with style"
- Expandable Section — `🔽` — "Collapsible content block"
- Icon + Text Row — `🔤` — "Icon paired with text"

**Layout:**
- Columns — `▥` — "2-3 side-by-side columns"
- Table — `▦` — "Data grid with headers"

**Media:**
- Image Gallery — `🖼` — "Multiple images in a set"

### Behavior

1. Click block card → generate `id` (nanoid), create `AdditionalSlotEntry` with empty data and `order = max + 1`
2. Append to `additionalSlots` field array
3. Close popover
4. Scroll the new slot into view
5. New slot renders with editor open, property panel closed

### Deletion

Each `additionalSlots` entry gets a trash icon in its slot header. Core template slots cannot be deleted (no trash icon), only toggled off.

---

## 9. Drag-to-Reorder

### Library: `@dnd-kit`

```
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Architecture

- `SlotList` wraps all slots in `<DndContext>` + `<SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>`
- Each `SortableSlotSection` uses `useSortable({ id })` for drag handle + transform
- `onDragEnd` handler:
  1. Compute new order from `over` / `active` indices
  2. Update `order` values on both template slots and `additionalSlots`
  3. For template slots: update a `slotOrder` record on the form (maps slotId → new order)
  4. For additional slots: update `order` in the `additionalSlots` array

### Visual Feedback

- Drag handle: `≡` icon, only visible in advanced mode
- Active item: elevated with `tokens.shadow8`, slight scale (1.02)
- Drop placeholder: 2px accent-colored line between slots
- Keyboard reorder: Space to pick up, Arrow keys to move, Space to drop (built into `@dnd-kit`)

### Constraints

- In basic mode: no DndContext, no drag handles, slots render in template-defined order
- In advanced mode: DndContext wraps everything, order is user-controllable
- Template `required` slots can be reordered but not deleted

---

## 10. Save as Template

### Trigger

"Save as Template" button in ActionBar. Shown when form has content (headline or body non-empty).

### Dialog

```
┌─ Save as Template ──────────────────┐
│                                      │
│  Name         [____________________] │
│  Description  [____________________] │
│                                      │
│  Saves the current layout and slot   │
│  configuration as a reusable         │
│  template. Content is not included.  │
│                                      │
│              [Cancel]  [Save]        │
└──────────────────────────────────────┘
```

### Save Flow

1. Extract structure from current form state:
   - Active core slots + their visibility (on/off) + order
   - Additional slots (type, order) — without user content
   - Property overrides as `lockedProperties` on each slot (optional — could prompt)
   - Theme as default theme
2. Build `CardSchema` JSON from the structure
3. Call `POST /api/templates` with `{ name, description, cardSchema }`
4. On success: invalidate templates query cache, show success `MessageBar`
5. New template appears in TemplatePicker "Saved" section

### API

Uses existing `CreateTemplateRequest` type and `/api/templates` endpoint. The `cardSchema` field stores the serialized structure as JSON string.

---

## 11. Type System Cleanup

Phase C must resolve the dual `AdvancedBlockType` naming collision:

- `types/cardBuilder.ts` defines 15 AC-centric block types as `AdvancedBlockType`
- `types/index.ts` defines 6 legacy block types as `AdvancedBlockType`
- `types/index.ts` re-exports the pipeline version as `NewAdvancedBlockType`

**Resolution:**
1. Rename legacy `AdvancedBlockType` in `types/index.ts` to `LegacyBlockType`
2. Rename pipeline `AdvancedBlockType` in `types/cardBuilder.ts` to `Tier2BlockType` (deferred to Phase C2)
3. Add `ExtendedSlotType` union for the 7 types in Phase C scope
4. Reconcile `CardPreference` casing: standardize on `'Template' | 'Advanced' | 'Standard'` (the form/API convention)

---

## 12. Task Breakdown (Implementation Order)

| # | Task | New/Modified Files | Depends On |
|---|---|---|---|
| 1 | Extend form schema: `additionalSlots`, `advancedOverrides`, `cardSettings` fields + Zod validation | `validators.ts`, `types/index.ts` | — |
| 2 | Type cleanup: rename legacy `AdvancedBlockType`, add `ExtendedSlotType` | `types/index.ts`, `types/cardBuilder.ts` | — |
| 3 | Update formBridge: map `additionalSlots` and `advancedOverrides` to CardDocument | `formBridge.ts` | 1 |
| 4 | Build 7 extended slot editors + `ExtendedSlotEditor` dispatch | `ExtendedSlotEditors.tsx` (new) | 1 |
| 5 | Build `PropertyPanel` component | `PropertyPanel.tsx` (new) | 1 |
| 6 | Build `AddSectionButton` + `AddSectionPalette` | `AddSectionPalette.tsx` (new) | 1, 4 |
| 7 | Install `@dnd-kit`, build `SortableSlotSection`, modify `SlotList` for DnD | `SlotList.tsx`, `SortableSlotSection.tsx` (new) | 1 |
| 8 | Build `CardSettingsPanel` | `CardSettingsPanel.tsx` (new) | 1 |
| 9 | Add Advanced mode toggle to `ComposePanel` + localStorage persistence | `ComposePanel.tsx` | — |
| 10 | Wire everything into `ContentTab` — pass `advancedMode`, manage additional slots | `ContentTab.tsx` | 3-9 |
| 11 | Add "Save as Template" dialog + mutation | `SaveTemplateDialog.tsx` (new), `ActionBar.tsx` | 1 |
| 12 | Update `useComposeForm` for new fields (defaults, edit-mode load, save) | `useComposeForm.ts` | 1, 3 |
| 13 | Cleanup + final verification (`tsc --noEmit` + `vite build`) | — | all |

---

## 13. New Dependency

```
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

No other new dependencies. All UI built with existing Fluent UI v9 components.

---

## 14. Risk Notes

1. **`@dnd-kit` + Fluent UI interaction**: Verify drag handles don't conflict with Fluent's focus management. Test with keyboard reorder.
2. **Form performance**: `additionalSlots` as a field array with `useFieldArray` — watch for re-render storms when dragging. May need `useDeferredValue` on the slot list.
3. **Pipeline `additionalSlots` format**: Verify that `resolveTemplate()` handles the exact data shapes the editors produce. May need minor bridge adjustments.
4. **Type cleanup**: Renaming `AdvancedBlockType` touches multiple files. Do it in a single commit, run type-check immediately.
