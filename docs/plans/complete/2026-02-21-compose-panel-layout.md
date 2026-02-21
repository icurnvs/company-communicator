# Compose Panel: Wider Layout + Preview Showcase + Template Auto-Collapse

## Context

The "New Message" compose panel feels cramped at its current 900px max-width. The preview pane (42% of 900px ≈ 378px) leaves the 3 stacked Adaptive Card previews squeezed together with minimal breathing room. The user wants a more polished, showcase feel — more space between and around the preview cards, clear labels, and visible framing. Additionally, the templates section should auto-collapse once a template is selected to reclaim vertical space for the composition area.

## Design Direction

**Tone**: Refined gallery — the preview area should feel like cards displayed on a curated surface, not crammed into a sidebar. Think art-on-a-mat: each card preview sits inside its own framed tile with generous padding and clear separation. The form side stays functional and dense; the preview side breathes.

## Changes

### 1. Widen the panel — `ComposePanel.tsx`
**File**: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`

- Change `maxWidth: '900px'` → `maxWidth: '1120px'` in the `panel` style
- This gives ~500px to preview (45%) and ~616px to the form (55%)

### 2. Adjust content split and preview styling — `ContentTab.tsx`
**File**: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`

- Change form/preview split from `58%`/`42%` → `55%`/`45%`
- Increase preview area horizontal padding: `spacingHorizontalM` → `spacingHorizontalL`
- Give preview area a distinct subtle background (`colorNeutralBackground3`) to visually separate it from the form area — creates the "showcase surface" feel

### 3. Showcase the preview cards — `CardPreviewPanel.tsx`
**File**: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/CardPreviewPanel.tsx`

Each of the 3 theme previews becomes a **framed showcase tile**:

- **Outer frame**: `colorNeutralBackground1` background, `borderRadiusLarge` corners, `spacingHorizontalM` padding all around, subtle `shadow2` drop shadow — each tile feels like a discrete card sitting on the surface
- **Label**: Semibold, uppercase, letter-spaced (0.04em), `fontSizeBase200`, `colorNeutralForeground3` — positioned inside the frame above the preview. Consistent with the section label pattern already used in ContentTab
- **Inner preview container**: Keeps existing background colors (#FFF / #1F1F1F / #000), `borderRadiusMedium` corners, `1px solid colorNeutralStroke2` border, increase padding from `spacingHorizontalM` → `spacingHorizontalL`
- **Spacing**: Gap between the 3 frames increases from `spacingVerticalM` (12px) → `spacingVerticalL` (16px)
- **Empty state**: Stays centered but with a more refined caption

### 4. Auto-collapse templates on selection — `TemplatePicker.tsx`
**File**: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx`

- After `doApply()` in both `handleSelectBuiltin` and `handleSelectCustom`, call `setExpanded(false)`
- When collapsed with an active non-blank template, show a compact indicator next to "Templates": a small colored dot (template's `accentColor`) + the template name in `fontSizeBase200` — tells the user what's loaded without taking space
- The toggle chevron still works — user can re-expand any time
- Requires passing the active template name/color into TemplatePicker (via new optional props or by reading `templateId` from the form and resolving it)

## Files Modified

| File | Change |
|------|--------|
| `ComposePanel.tsx` | `maxWidth` 900 → 1120 |
| `ContentTab.tsx` | Split 58/42 → 55/45, preview background + padding |
| `CardPreviewPanel.tsx` | Showcase tile frames, spacing, refined labels |
| `TemplatePicker.tsx` | Auto-collapse on select + active template indicator |

## Verification

1. `npm run dev` from `src/CompanyCommunicator.Api/ClientApp/`
2. Open the app → click "New Message"
3. Verify: panel is wider, preview area has distinct background, cards are framed with labels
4. Select a template → templates section collapses, shows colored dot + template name
5. Click "Templates" toggle → re-expands to full grid
6. Resize browser narrower → panel shrinks gracefully (`calc(100% - 48px)`)
7. `npm run typecheck` — no TS errors
