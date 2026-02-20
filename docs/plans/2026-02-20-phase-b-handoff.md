# Phase B Handoff — Card Builder Template Compose UI

**Date:** 2026-02-20
**Branch:** `feature/card-builder-redesign`
**Worktree:** `.worktrees/card-builder-redesign/`
**Plan:** `docs/plans/2026-02-20-card-builder-redesign.md`

## Status: 3 of 10 tasks complete

| Task | Status | Commit |
|------|--------|--------|
| 1: Extend Form Schema + CardPreference Type | DONE | `cfec51b` |
| 2: Form ↔ CardDocument Bridge | DONE | `9a14781` |
| 3: Slot Editor Components | DONE | `9d39b93` |
| 4: SlotList Container | TODO | |
| 5: ThemePicker Component | TODO | |
| 6: CardPreviewPanel (Three-Theme Preview) | TODO | |
| 7: TemplatePicker Rewrite | TODO | |
| 8: ContentTab Rewrite | TODO | |
| 9: useComposeForm + ConfirmSendDialog Updates | TODO | |
| 10: Cleanup + Final Verification | TODO | |

## What Was Done

### Task 1 — `types/index.ts` + `lib/validators.ts`
- `CardPreference` now includes `'Template'`
- Schema has `templateId`, `themeId`, `slotVisibility` fields
- `formToApiFields()` serializes template metadata as JSON into `cardPreference` when mode is `'Template'`
- Added `parseTemplateMetadata()` to deserialize on load

### Task 2 — `lib/formBridge.ts` (new)
- `formValuesToCardDocument(values, template, themeId?, slotVisibility?)` → `CardDocument`
- `templateToFormDefaults(template)` → `Partial<ComposeFormValues>`
- Maps all 7 slot types (heading, bodyText, heroImage, keyDetails, linkButton, footer, divider)

### Task 3 — `components/ComposePanel/SlotEditors.tsx` (new)
- Dispatch `SlotEditor` component routes by `slot.type`
- 7 sub-editors: HeadingEditor, BodyTextEditor, HeroImageEditor, KeyDetailsEditor, LinkButtonEditor, FooterEditor, DividerEditor
- Reuses same Fluent UI controls + patterns from existing ContentTab
- BodyTextEditor includes VariableInsert toolbar

## What Remains (Tasks 4-10)

### Task 4: SlotList Container — `components/ComposePanel/SlotList.tsx` (new)
- Iterates `template.slots` sorted by order
- Required slots: always show SlotEditor
- Optional slots: Switch toggle + collapsible SlotEditor
- Shows slot label + helpText
- Include `CustomVariablesPanel` at bottom

### Task 5: ThemePicker — `components/ComposePanel/ThemePicker.tsx` (new)
- Horizontal row of 6 circular color swatches from `BUILTIN_THEMES`
- Selected theme shows checkmark overlay
- Theme name below each swatch
- Props: `selectedThemeId`, `onSelectTheme`

### Task 6: CardPreviewPanel — `components/ComposePanel/CardPreviewPanel.tsx` (new)
- Three toggle buttons: Light | Dark | High Contrast
- Selected toggle stored in localStorage (`cc-preview-theme`)
- Uses `renderCard()` from `adaptiveCard.ts` with AC JSON + HostConfig from pipeline
- Props: `cardPayload: object | null`, `cardTheme: ThemeDefinition`

### Task 7: TemplatePicker Rewrite — modify existing `TemplatePicker.tsx`
- Import from `@/lib/templateDefinitions` instead of `@/lib/builtinTemplates`
- Use `TemplateDefinition.iconName` → resolve to Fluent icon via lookup map
- On select: call `templateToFormDefaults()` from formBridge
- Custom templates (API) still use old `applySchema` for backward compat
- Set `templateId` on form on selection

### Task 8: ContentTab Rewrite — modify existing `ContentTab.tsx`
- Two-panel layout: editor (60%) / preview (40%)
- Left: TemplatePicker (collapsed when editing) → ThemePicker → SlotList → CustomVariablesPanel
- Right: CardPreviewPanel with three-theme toggle
- Data flow: form values → `useDeferredValue` → `formValuesToCardDocument()` → `buildCard()` → CardPreviewPanel
- When template changes → `templateToFormDefaults()` populates form

### Task 9: useComposeForm + ConfirmSendDialog Updates
- **useComposeForm**: Add `templateId`, `themeId`, `slotVisibility` to defaults. Use `parseTemplateMetadata()` on load.
- **ConfirmSendDialog**: Use `formValuesToCardDocument()` + `buildCard()` for preview instead of old `CardData` + `buildCardPayload()`

### Task 10: Cleanup + Final Verification
- Delete `BlockEditor.tsx` and `blocks/` directory
- Verify no broken imports to deleted files or `@/lib/builtinTemplates`
- `npx tsc --noEmit` + `npx vite build`

## Key Files to Read First

All in `.worktrees/card-builder-redesign/src/CompanyCommunicator.Api/ClientApp/src/`:

**Completed (new/modified):**
- `types/index.ts` — CardPreference type
- `lib/validators.ts` — extended schema + `parseTemplateMetadata()`
- `lib/formBridge.ts` — form ↔ CardDocument bridge
- `components/ComposePanel/SlotEditors.tsx` — per-type slot editors

**Phase A pipeline (unchanged, reference):**
- `lib/cardPipeline.ts` — `buildCard()`, `buildCardFromDocument()`
- `lib/themeEngine.ts` — `applyTheme()`, `buildThemedHostConfig()`
- `lib/templateDefinitions.ts` — 9 `TemplateDefinition` objects
- `lib/builtinThemes.ts` — 6 `ThemeDefinition` objects
- `lib/useCardPreview.ts` — React hook for pipeline
- `lib/cardBuilder.ts` — barrel export
- `types/cardBuilder.ts` — all type definitions

**Existing (to be modified in Tasks 7-9):**
- `components/ComposePanel/ContentTab.tsx` — current compose UI (full rewrite)
- `components/ComposePanel/TemplatePicker.tsx` — current picker (rewrite)
- `components/ComposePanel/useComposeForm.ts` — form hook (extend)
- `components/ComposePanel/ConfirmSendDialog.tsx` — send dialog (update preview)

**Existing (reused as-is):**
- `lib/adaptiveCard.ts` — `renderCard()`, `buildCardPayload()` (old pipeline)
- `components/ComposePanel/CustomVariablesPanel.tsx`
- `components/ComposePanel/VariableInsert.tsx`

## How to Continue

```
cd C:\Users\icurn\Nextcloud\GitHubRepos\company-communicator\.worktrees\card-builder-redesign
```

1. Read this handoff + the plan (`docs/plans/2026-02-20-card-builder-redesign.md`)
2. Resume at Task 4 (SlotList Container)
3. After each task: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
4. After Task 10: `npx vite build`
5. Consider code review after all 10 tasks compile and build
