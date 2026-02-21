# Card Builder Redesign — Design Document

> **Date**: 2026-02-20
> **Status**: Design approved
> **Scope**: Content-only card builder (no inputs, no backend actions)

---

## 1. Design Principles

1. **Template-first**: Users always start from a template. No blank canvas paralysis.
2. **Simple tools, beautiful output**: The builder hides Adaptive Cards complexity. Users never see "TextBlock" or "ColumnSet."
3. **Progressive complexity**: Three tiers of power, all accessible to all users, defaulting to the simplest.
4. **Constrained viewport**: Designed for Teams tab on 1080p monitors (~960-1100px wide). Max-width containers, no full-width sprawl. Must also look good on larger displays (centered, not stretched).
5. **Content-only**: No input elements, no Action.Submit/Execute, no backend-triggered interactions. Cards are for reading.

---

## 2. Three-Tier Builder Model

### Tier 1 — Template Compose (default)

The everyday experience for HR, internal comms, and leadership.

- User clicks "New Message" → lands on a **template picker** (visual card grid)
- Picks a template → composer opens with **slot-based editor + live preview**
- Each slot has a friendly label, simple controls, and can be toggled on/off
- Users can add optional sections from a curated "Add Section" menu
- A **theme picker** strip lets them choose the color palette
- **Three-theme preview** (Light / Dark / High Contrast) shows how recipients will see it

**No Adaptive Cards terminology is ever visible in Tier 1.**

### Tier 2 — Advanced Compose (toggle)

For IT comms, developer announcements, or anyone who wants full control.

- A switch in the composer header toggles advanced mode
- Each section gains an **expand arrow** revealing full AC property panels (color, alignment, font type, maxLines, subtle, etc.)
- The "Add Section" menu expands to show **all block types** grouped by category:
  - **Content**: Text, Rich Text, Image, Icon, Badge, Code Block, Rating Display
  - **Layout**: Columns, Grid Layout (AreaGrid), Flow Layout, Table
  - **Data Viz**: Donut Chart, Bar Chart, Line Chart, Gauge
  - **Interactive**: Expandable Section, Button Link
- Blocks can be freely reordered via drag-and-drop
- A **"Card Settings"** panel appears: full-width toggle, responsive breakpoints, accent color override
- **"Save as Template"** captures the current structure as a reusable template

### Tier 3 — Template Editor (separate screen)

For creating and managing reusable template definitions.

- Accessed from "Manage Templates" on the home dashboard or template picker
- **Three-panel layout**:
  - **Left**: Ordered slot list with drag-to-reorder. Shows type, label, visibility state.
  - **Center**: Slot configuration — label, visibility (required / optional-on / optional-off), help text, default values, locked properties
  - **Right**: Live preview with sample content
- Template metadata: name, description, icon, category, default accent color
- All users can create templates — no role gating

---

## 3. Section Types (Slot Vocabulary)

### Core Sections (available in all templates)

| User-Facing Name | Simple Controls (Tier 1) | AC Elements Under the Hood |
|---|---|---|
| **Heading** | Text input, alignment toggle (left/center) | TextBlock (Large, Bolder) |
| **Subheading** | Text input | TextBlock (Medium, isSubtle) |
| **Body Text** | Textarea, variable insert toolbar | TextBlock (wrap: true, markdown) |
| **Hero Image** | URL input, thumbnail preview, alt text input | Image (bleed, Stageview) |
| **Key Details** | Label/value pair list (add/remove rows) | FactSet in emphasis Container |
| **Link Button** | Label + URL inputs | Action.OpenUrl (positive style) |
| **Footer** | Textarea | TextBlock (Small, isSubtle, separator) |
| **Divider** | No controls | Separator |

### Extended Sections (via "Add Section" menu)

| User-Facing Name | Simple Controls (Tier 1) | AC Elements |
|---|---|---|
| **Image Gallery** | URL list + image size picker | ImageSet |
| **Stats Row** | 2-4 number + label pairs | ColumnSet with styled TextBlocks |
| **Quote / Callout** | Textarea, style picker (info/success/warning/urgent) | Container (styled, showBorder, roundedCorners) |
| **Columns** | 2-3 columns, each holds text or image | ColumnSet with rich content |
| **Table** | Editable grid with header row | Table element |
| **Expandable Section** | Title + collapsible body content | Action.ToggleVisibility + Container |
| **Icon + Text Row** | Fluent icon picker + text | ColumnSet (Icon + TextBlock) |

### Advanced-Only Blocks (Tier 2, grouped in Add menu)

| Category | Block Types |
|---|---|
| **Content** | Rich Text (TextRun segments), Icon, Badge, Code Block, Rating Display, Compound Button |
| **Layout** | Grid Layout (AreaGrid), Flow Layout |
| **Data Viz** | Donut/Pie Chart, Vertical Bar, Grouped Bar, Horizontal Bar, Stacked Bar, Line Chart, Gauge |

---

## 4. Theme System

### What a Theme Controls

The color palette applied to a card — not structure, spacing, or layout.

| Token | Purpose |
|---|---|
| `accentColor` | Primary brand color — accent containers, button backgrounds, header strips |
| `accentForeground` | Text color on accent backgrounds |
| `emphasisBackground` | Background tint for emphasis containers (Key Details, Callout) |
| `borderColor` | Container border color when `showBorder` is used |
| Semantic overrides (optional) | Custom colors for good / warning / attention states |

### Built-in Themes

| Theme | Accent | Feel |
|---|---|---|
| **Default** | Teams Indigo (#5B5FC7) | Standard Teams look |
| **Corporate** | Dark Navy (#1B2A4A) | Formal, executive comms |
| **Warm** | Terracotta (#C4652A) | Friendly, HR/culture |
| **Fresh** | Teal (#0E8A7B) | Clean, modern |
| **Bold** | Deep Purple (#7C3AED) | High energy, events |
| **Subtle** | Slate Gray (#64748B) | Understated, minimal |

Custom themes: Users can create their own via a simple color picker for accent + emphasis. Saved per-user or org-wide.

### Templates + Themes Interaction

- **Templates own structure and default styling** (layout, spacing, visual weight, default accent color)
- **Themes provide a color palette overlay** that replaces the template's default colors
- A "Bold Announcement" template still *feels* bold whether rendered in Corporate or Warm — the theme changes the colors, not the personality

---

## 5. Three-Theme Preview

The preview panel renders all three themes simultaneously — **Light**, **Dark**, and **High Contrast** — stacked vertically with caption labels.

- Each container calls `buildThemedHostConfig(recipientTheme, cardTheme)` with its respective theme
- Card JSON stays identical — only the rendering context changes
- No toggle buttons or localStorage persistence needed — all three are always visible
- Shows users exactly how recipients in each Teams theme will see their card

---

## 6. Data Model

### TemplateDefinition

```typescript
interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;                    // Fluent icon name
  category: string;                // "announcement" | "event" | "alert" | "general" | ...
  accentColor: string;             // Default accent (theme overrides this)
  isBuiltIn: boolean;
  slots: SlotDefinition[];
}

interface SlotDefinition {
  id: string;
  type: SlotType;                  // "heading" | "subheading" | "bodyText" | "heroImage" | ...
  label: string;                   // User-facing name
  helpText?: string;               // Placeholder / guidance
  defaultValue?: unknown;          // Pre-filled content
  visibility: "required" | "optionalOn" | "optionalOff";
  order: number;
  lockedProperties?: Record<string, unknown>;  // AC props fixed by template
}

type SlotType =
  | "heading" | "subheading" | "bodyText" | "heroImage"
  | "keyDetails" | "linkButton" | "footer" | "divider"
  | "imageGallery" | "statsRow" | "quoteCallout" | "columns"
  | "table" | "expandableSection" | "iconTextRow";
```

### ThemeDefinition

```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  accentColor: string;
  accentForeground: string;
  emphasisBackground: string;
  borderColor: string;
  semanticOverrides?: {
    good?: string;
    warning?: string;
    attention?: string;
  };
  isBuiltIn: boolean;
}
```

### CardDocument (per notification)

```typescript
interface CardDocument {
  templateId: string | null;       // null = advanced freeform
  themeId: string;
  slotValues: Record<string, unknown>;   // slotId → user-entered content
  additionalBlocks?: AdvancedBlock[];    // sections added beyond template
  advancedOverrides?: Record<string, Record<string, unknown>>;  // slotId → property overrides
  cardPreference: "template" | "advanced";
}
```

### AdvancedBlock (Tier 2 freeform blocks)

```typescript
interface AdvancedBlock {
  id: string;
  type: AdvancedBlockType;
  data: Record<string, unknown>;
  order: number;
}

type AdvancedBlockType =
  | SlotType                           // all Tier 1 types available in Tier 2
  | "richText" | "icon" | "badge" | "codeBlock" | "ratingDisplay" | "compoundButton"
  | "gridLayout" | "flowLayout"
  | "donutChart" | "verticalBar" | "groupedBar" | "horizontalBar"
  | "stackedBar" | "lineChart" | "gauge";
```

---

## 7. Card Building Pipeline

```
User input (slot values + theme + overrides)
        ↓
resolveTemplate(templateDef, slotValues, additionalBlocks)
        ↓
CardElementTree (intermediate representation)
        ↓
applyTheme(elementTree, themeDefinition)
        ↓
applyAdvancedOverrides(elementTree, overrides)    [Tier 2 only]
        ↓
resolveVariables(elementTree, recipientVars)
        ↓
serializeToAdaptiveCard()  →  AC JSON (schema 1.5)
        ↓
renderCard(container, json, recipientTheme)
```

### CardElementTree

A lightweight intermediate representation — an array of typed element objects that map 1:1 to AC elements but carry builder metadata (slot IDs, theme color tokens, override markers).

**Benefits**:
- Theme application is a simple pass replacing color tokens with resolved values
- Template editor can visualize and manipulate the tree without parsing raw JSON
- "Save as Template" extracts tree structure back into a TemplateDefinition
- Serialization happens once at the end — clean AC JSON output

### Serialization

`serializeToAdaptiveCard()` walks the tree and emits AC JSON. Also injects:
- `targetWidth` properties for responsive elements
- `msteams.width: "Full"` when full-width is enabled
- `msTeams.allowExpand: true` on images for Stageview

---

## 8. Viewport & Layout Constraints

**Target environment**: Teams tab iframe on a 1080p monitor (~960-1100px available width).

### Compose Modal / Screen

- **Max width**: ~960px, centered with comfortable side margins
- **Two-panel split**: Editor (~55%) / Preview (~45%) — both panels scroll independently
- **Preview max width**: 460px (matches Teams card rendering width)
- On narrower viewports (<768px): stack vertically (editor above, preview below) — though rare in Teams desktop

### Template Picker

- **Card grid**: 2-3 columns within the max-width container
- Cards are fixed-width (~280px) with consistent aspect ratios
- No horizontal scrolling

### Template Editor (Tier 3)

- **Three-panel layout** within the same ~960px max-width
- Left slot list: ~200px fixed
- Center config: flexible fill
- Right preview: ~320px fixed
- Panels use internal scroll, not page scroll

### General Rules

- All content areas have max-width constraints — nothing stretches to fill a 4K display
- Generous padding and whitespace within the constrained widths
- Typography and spacing optimized for 1080p readability (no tiny text to fit more in)
- Fluent UI v9 components throughout — consistent with Teams visual language

---

## 9. Phased Rollout

### Phase A — Foundation ✅ COMPLETE

New data models (`TemplateDefinition`, `ThemeDefinition`, `CardDocument`), `CardElementTree` intermediate representation, serialization pipeline, theme engine. Built-in templates rewritten as `TemplateDefinition` objects with rich sample data. Built-in themes defined. API endpoints for template and theme CRUD updated.

**Result**: Infrastructure in place, no visible UI changes yet.

### Phase B — Template Compose (Tier 1) ✅ COMPLETE

Template picker grid, slot-based compose editor, theme picker strip, triple-stacked preview (Light/Dark/High Contrast rendered simultaneously). Replaces the current compose experience entirely. Templates ship with compelling sample content. Smart template switching uses `isDirty` detection — no confirmation dialog until the user actually edits a field.

**Result**: Users get the new template-first flow. Beautiful cards from day one.

### Phase C — Advanced Compose (Tier 2) ✅ COMPLETE

Property expand panels per section (23 block types), full block palette with all content/layout/chart types (22 blocks in 4 categories), drag-and-drop reorder (MouseSensor + distance activation), Card Settings panel (full-width toggle + accent color override). Phase C1 (7 extended slot types) and Phase C2 (15 advanced block types) both implemented.

**Result**: Power users get full Adaptive Cards capability.

### Phase D — Template Editor (Tier 3) — NOT STARTED

Dedicated three-panel template authoring screen. Slot configuration, visibility controls, locked properties, sample data preview.

**Result**: Anyone can create reusable templates.

Each phase ships independently and is usable on its own.

---

## 10. Out of Scope

- All `Input.*` elements (Text, Number, Date, Time, Toggle, ChoiceSet, Rating input)
- `Action.Submit`, `Action.Execute` (backend-triggered actions)
- `@mentions` (requires backend entity resolution)
- `Persona` / `PersonaSet` (requires Graph integration at render time)
- `Refresh` / `Authentication` (dynamic card features)
- Dependent inputs, overflow action menus
- Carousel (multi-page cards) — revisit in a future pass

---

## 11. Key Files to Modify / Create

### Replace entirely
- `lib/adaptiveCard.ts` → New pipeline (CardElementTree + serialization)
- `lib/builtinTemplates.ts` → Rewrite as `TemplateDefinition` objects
- `components/ComposePanel/ContentTab.tsx` → Slot-based editor
- `components/ComposePanel/BlockEditor.tsx` → Replace with new section manager
- `components/ComposePanel/blocks/*` → Replace with new section components

### Significant changes
- `types/index.ts` → New interfaces (TemplateDefinition, ThemeDefinition, CardDocument, etc.)
- `components/ComposePanel/ComposePanel.tsx` → Updated modal structure
- `components/ComposePanel/useComposeForm.ts` → New form shape matching CardDocument
- `components/ComposePanel/TemplatePicker.tsx` → Visual grid redesign
- `components/AdaptiveCardPreview/AdaptiveCardPreview.tsx` → Three-theme toggle
- `api/templates.ts` → Updated for new TemplateDefinition schema
- `lib/validators.ts` → New Zod schemas for CardDocument

### New files
- `lib/cardElementTree.ts` → Intermediate representation types + builder
- `lib/themeEngine.ts` → Theme application logic
- `lib/serializer.ts` → CardElementTree → AC JSON serialization
- `lib/builtinThemes.ts` → Built-in theme definitions
- `components/ComposePanel/sections/*` → Individual section editor components
- `components/ComposePanel/PropertyPanel.tsx` → Advanced mode property editor
- `components/ComposePanel/ThemePicker.tsx` → Theme selection strip
- `components/ComposePanel/CardSettings.tsx` → Full-width, responsive, accent override
- `components/TemplateEditor/` → Tier 3 template authoring screen
