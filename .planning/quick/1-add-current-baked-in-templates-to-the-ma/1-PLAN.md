---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx
  - src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "Built-in templates appear in the Manage Templates grid alongside custom templates"
    - "User can click Edit on a built-in template and it opens in the template editor"
    - "Editing a built-in template saves it as a new custom template in the database"
    - "Built-in templates are visually distinguished from custom templates with a Built-in badge"
    - "Custom templates that already exist continue to work as before (edit and delete)"
  artifacts:
    - path: "src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx"
      provides: "Built-in template cards in the Manage Templates grid"
      contains: "BUILTIN_TEMPLATE_DEFINITIONS"
    - path: "src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts"
      provides: "Support for initializing editor from a built-in template definition"
      contains: "getTemplateById"
  key_links:
    - from: "TemplateListView.tsx"
      to: "BUILTIN_TEMPLATE_DEFINITIONS"
      via: "import from templateDefinitions"
      pattern: "BUILTIN_TEMPLATE_DEFINITIONS"
    - from: "TemplateListView.tsx"
      to: "onEdit callback"
      via: "passes builtin template ID prefixed with builtin marker"
      pattern: "onEdit.*builtin"
    - from: "useTemplateEditor.ts"
      to: "BUILTIN_TEMPLATE_DEFINITIONS"
      via: "initializes from builtin when editId is a builtin ID"
      pattern: "getTemplateById|BUILTIN_TEMPLATE_DEFINITIONS"
---

<objective>
Add the 9 built-in templates (Blank, Announcement, Event Invite, Urgent Alert, Link Share, Survey, Welcome, Policy Update, Celebration) to the Manage Templates screen so users can see, edit (clone to custom), and manage them alongside their custom templates.

Purpose: Currently the Manage Templates screen only shows user-created custom templates from the database. The built-in templates are invisible there, meaning users cannot customize or adapt them. This change surfaces built-ins in the management grid so users can clone-and-edit any built-in to create a personalized version.

Output: Updated TemplateListView showing built-in templates with visual distinction, and updated useTemplateEditor supporting initialization from a built-in template definition for "edit as new" workflow.
</objective>

<execution_context>
@C:/Users/icurn/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/icurn/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx
@src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts
@src/CompanyCommunicator.Api/ClientApp/src/lib/templateDefinitions.ts
@src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/IconPicker.tsx
@src/CompanyCommunicator.Api/ClientApp/src/api/templates.ts
@src/CompanyCommunicator.Api/ClientApp/src/types/cardBuilder.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Show built-in templates in the TemplateListView grid</name>
  <files>src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx</files>
  <action>
Import `BUILTIN_TEMPLATE_DEFINITIONS` and `BLANK_TEMPLATE_ID` from `@/lib/templateDefinitions`, and `resolveTemplateIcon` is already imported. Also import `Badge` (already imported).

Add a "Built-in Templates" section to the grid that renders BEFORE the custom templates section. Filter out the Blank template (id === BLANK_TEMPLATE_ID) since it is not useful in the manage view.

For each built-in template, render a card using the same card styling as custom templates, but:
1. Use `resolveTemplateIcon(t.iconName)` for the icon.
2. Use `t.accentColor` for the accent bar color.
3. Show a `Badge` with text "Built-in" (appearance="outline", size="small", color="subtle") in the card body alongside the slot count badge.
4. Show only an "Edit" button in the card footer (no "Delete" button for built-ins). The Edit button should call `onEdit(t.id)` — the built-in template IDs like `'builtin-announcement'` will be handled by the editor hook.
5. Show the slot count derived from `t.slots.length`.

Add a visual divider between the built-in templates section and the custom templates section. Use a simple styled divider similar to what TemplatePicker uses:
```
<div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase100 }}>
  <span style={{ flex: 1, height: '1px', backgroundColor: tokens.colorNeutralStroke2 }} />
  <span>Custom Templates</span>
  <span style={{ flex: 1, height: '1px', backgroundColor: tokens.colorNeutralStroke2 }} />
</div>
```

The rendering order in the grid should be:
1. "Create Template" dashed card (already exists)
2. Built-in template cards (filtered, no Blank)
3. Divider labeled "Custom Templates"
4. Custom template cards from API (already exists)

Update the empty state: only show "No custom templates yet" message when there are no custom templates (the built-in section always has content). Move the empty state check to only apply to the custom section, not the whole view. The empty state text should remain but be shown inline after the divider rather than as a centered full-page message.
  </action>
  <verify>
Run `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit` to verify no TypeScript errors. Visually inspect that the file imports are correct and the JSX structure is valid.
  </verify>
  <done>
The Manage Templates grid shows 8 built-in templates (all except Blank) with accent colors, icons, slot counts, and "Built-in" badges. Each has an Edit button but no Delete button. A "Custom Templates" divider separates them from user-created templates. The "Create Template" card remains first in the grid.
  </done>
</task>

<task type="auto">
  <name>Task 2: Support initializing the template editor from a built-in template</name>
  <files>src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts</files>
  <action>
When the user clicks "Edit" on a built-in template, `onEdit(builtinId)` is called with an ID like `'builtin-announcement'`. The current `useTemplateEditor` hook tries to find this ID among API-fetched templates, which will fail since built-ins are not in the database.

Modify `useTemplateEditor` to handle built-in template IDs:

1. Import `getTemplateById` from `@/lib/templateDefinitions`.

2. In the `existingTemplate` useMemo, add a check: if `editId` starts with `'builtin-'`, look it up via `getTemplateById(editId)` instead of searching `allTemplates`. When found from built-in:
   - Return the TemplateDefinition directly (it already has the right shape).
   - This avoids needing to parse JSON since the built-in is already a TemplateDefinition object.

3. When a built-in is loaded for editing, the `isEdit` flag should be `false` (since we are creating a new template, not updating an existing one). Add a derived boolean `isBuiltinClone`:
   - `const isBuiltinClone = !!editId && editId.startsWith('builtin-');`
   - Change `isEdit` to: `!!editId && !isBuiltinClone` (so saving creates a new template via POST, not PUT).

4. In the `useEffect` that syncs `existingTemplate` into state, when the source is a built-in, clear the `id` field on the cloned template (set it to `''`) so the backend generates a new GUID. Also set `isBuiltIn: false` on the clone.

5. The `isLoading` computation should account for built-ins: if `editId` starts with `'builtin-'`, loading is synchronous (the data is in-memory), so `isLoading` should be `false` regardless of query state. Update:
   ```
   const isLoading = !!editId && !isBuiltinClone && !existingTemplate && isQueryLoading;
   ```

6. In the `save` callback, the existing logic already branches on `editId` for create vs update. Since `isEdit` is now `false` for built-in clones, the `if (editId)` check needs updating. Change the save branch condition from `if (editId)` to `if (isEdit)`:
   - `if (editId && !isBuiltinClone)` uses `updateMutation` (PUT).
   - `else` uses `createMutation` (POST) — this covers both new templates AND built-in clones.

No changes needed to the save payload itself — `serializeTemplateDefinition` already handles the conversion.
  </action>
  <verify>
Run `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit` to verify no TypeScript errors. Verify the hook logic: passing `editId='builtin-announcement'` should result in `isEdit=false`, `isLoading=false`, and the template state populated from the built-in definition with `id=''` and `isBuiltIn=false`.
  </verify>
  <done>
Clicking "Edit" on a built-in template in the Manage Templates screen opens the template editor pre-populated with all the built-in's slots, metadata, colors, and icon. Saving creates a new custom template in the database (POST /api/templates). The original built-in remains unchanged in the list. The new custom template appears in the "Custom Templates" section after save.
  </done>
</task>

</tasks>

<verification>
1. `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit` passes with no errors.
2. `cd src/CompanyCommunicator.Api/ClientApp && npx eslint src/components/TemplateEditor/TemplateListView.tsx src/components/TemplateEditor/useTemplateEditor.ts --no-error-on-unmatched-pattern` passes.
3. Built-in templates render in the Manage Templates grid with correct icons, colors, slot badges, and "Built-in" badges.
4. Clicking Edit on a built-in opens the editor with all fields pre-populated.
5. Saving from a built-in edit creates a new custom template (visible in "Custom Templates" section).
6. Existing custom template edit/delete functionality is unaffected.
</verification>

<success_criteria>
- 8 built-in templates (excluding Blank) visible in Manage Templates grid
- Visual distinction via "Built-in" badge on each built-in card
- Edit on built-in opens editor pre-populated, saves as new custom template
- No Delete button on built-in template cards
- TypeScript compilation passes with no errors
- Existing custom template CRUD workflow unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-current-baked-in-templates-to-the-ma/1-SUMMARY.md`
</output>
