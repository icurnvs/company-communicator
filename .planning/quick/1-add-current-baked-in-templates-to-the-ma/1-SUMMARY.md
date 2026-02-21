---
phase: quick-1
plan: "01"
subsystem: frontend-template-editor
tags: [templates, TemplateListView, useTemplateEditor, built-in-templates]
dependency_graph:
  requires: []
  provides: [built-in-templates-in-manage-view, built-in-clone-to-custom-workflow]
  affects: [TemplateListView, useTemplateEditor]
tech_stack:
  added: []
  patterns: [in-memory-lookup-before-api, clone-id-clear-on-builtin-edit]
key_files:
  created: []
  modified:
    - src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx
    - src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts
decisions:
  - "Built-in templates rendered from in-memory BUILTIN_TEMPLATE_DEFINITIONS rather than API fetch; no backend changes needed"
  - "isEdit=false for built-in clones so save always uses POST; clone id cleared to '' so backend generates new GUID"
  - "Pre-existing ESLint warnings in original file (lines 66, 68, 197, 283) left untouched per deviation scope rules"
metrics:
  duration_seconds: 192
  completed_date: "2026-02-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Quick Task 1: Add Built-in Templates to Manage Templates Screen — Summary

**One-liner:** Surfaced 8 built-in templates (Announcement, Event Invite, Urgent Alert, Link Share, Survey, Welcome, Policy Update, Celebration) in the Manage Templates grid with visual badges and clone-to-custom edit flow.

## Objective

Built-in templates were invisible in the Manage Templates screen; users had no way to adapt them. This change renders them in the grid ahead of custom templates, lets users click Edit to clone a built-in into a new custom template, and visually distinguishes built-ins from user-created templates.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Show built-in templates in TemplateListView grid | `daeab7c` | TemplateListView.tsx |
| 2 | Support initializing template editor from built-in template | `7ce7172` | useTemplateEditor.ts |

## Changes Made

### Task 1 — TemplateListView.tsx

- Added imports: `BUILTIN_TEMPLATE_DEFINITIONS`, `BLANK_TEMPLATE_ID` from `@/lib/templateDefinitions`
- `builtinTemplates` memo filters out the Blank template (id `builtin-blank`) — 8 templates remain
- Built-in cards render before the custom section: accent bar, icon (via `resolveTemplateIcon`), slot count badge, and a "Built-in" (subtle) badge
- Each built-in card has only an Edit button; no Delete button
- Added a "Custom Templates" full-width divider between the two sections using `gridColumn: '1 / -1'`
- Replaced the full-page empty state with an inline message rendered directly in the grid after the divider when `templates.length === 0`

### Task 2 — useTemplateEditor.ts

- Added import: `getTemplateById` from `@/lib/templateDefinitions`
- `isBuiltinClone` derived boolean: `!!editId && editId.startsWith('builtin-')`
- `existingTemplate` useMemo: if `isBuiltinClone`, calls `getTemplateById(editId)` synchronously; otherwise searches API templates as before
- `isLoading`: `false` when `isBuiltinClone` (data is in-memory, never needs to wait)
- `isEdit`: `!!editId && !isBuiltinClone` — built-in clones use POST path, not PUT
- `useEffect` sync: when built-in clone, spreads template with `id: ''` and `isBuiltIn: false` so backend assigns a new GUID and the record is not flagged as built-in
- `save` callback: branched on `isEdit && editId` for PUT; all other cases (new + built-in clone) use POST

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] New ESLint error from non-null assertion `editId!` on save path**
- **Found during:** Task 2 ESLint verification
- **Issue:** Introduced `editId!` non-null assertion inside the `if (isEdit)` branch; ESLint flagged it as `@typescript-eslint/no-non-null-assertion`
- **Fix:** Changed condition to `if (isEdit && editId)` — TypeScript now narrows `editId` to `string` inside the block, eliminating the need for `!`
- **Files modified:** useTemplateEditor.ts
- **Commit:** `7ce7172` (same commit as task)

### Pre-existing Out-of-Scope Issues

The following pre-existing ESLint warnings were present in the original `useTemplateEditor.ts` before this task and were not introduced by these changes. They are logged here for awareness but not fixed per scope boundary rules:

| Line | Rule | Description |
|------|------|-------------|
| 66 | `no-unnecessary-condition` | `crypto?.randomUUID` optional chain on non-nullish |
| 68 | `restrict-template-expressions` | `Math.random().toString(36).slice(2,8)` number in template |
| 197 | `no-non-null-assertion` | `moved!` after array splice in `reorderSlots` |
| 283 | `no-unnecessary-condition` | `SLOT_TYPE_LABELS[type] ?? type` — Record always has value |

## Verification Results

1. `npx tsc --noEmit` — PASSED (0 errors)
2. `npx eslint ... --no-error-on-unmatched-pattern` — 4 pre-existing errors only (0 new errors introduced)
3. Built-in templates render with correct icons, accent colors, slot counts, and "Built-in" badges
4. Edit on built-in opens editor pre-populated; saves as new custom template via POST
5. Existing custom template edit/delete workflow unchanged

## Self-Check: PASSED

| Item | Status |
|------|--------|
| TemplateListView.tsx exists | FOUND |
| useTemplateEditor.ts exists | FOUND |
| 1-SUMMARY.md exists | FOUND |
| Commit daeab7c (Task 1) | FOUND |
| Commit 7ce7172 (Task 2) | FOUND |
