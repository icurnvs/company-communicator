# Author Dashboard Redesign -- Code Review (Tasks 5-19)

**Reviewer:** Claude Opus 4.6 (Senior Code Reviewer)
**Date:** 2026-02-19
**Scope:** All frontend and backend changes from Tasks 5-19 of the Author Dashboard Redesign

---

## Executive Summary

The implementation is well-executed overall. The code follows established patterns consistently, uses Fluent UI v9 tokens correctly throughout (no hardcoded colors), and the architecture decisions from the plan are implemented faithfully. The backend variable resolution (Task 19) is clean and handles failures gracefully. The form/API field mapping (`headline` to `title`, `body` to `summary`) works correctly.

Key concerns are concentrated in a few areas: a missing `key` prop on React fragments in TableBlock, a potential XSS vector in the ImageThumbnail component, incomplete cleanup of the auto-save timer in `useComposeForm`, and the `estimateReach` function being duplicated across two files with magic numbers. No critical data-loss or security-breaking issues were found, but there are several "should fix" items.

---

## 1. Critical Issues (Must Fix Before Deploy)

### C1. Missing `key` on React Fragment in TableBlock

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/blocks/TableBlock.tsx`, lines 121-145

The `rows.map(...)` renders a bare `<>...</>` (React fragment) without a `key` prop. React requires a `key` on each child in a list for reconciliation. Using `index` as key on the outer fragment is technically acceptable here, but the fragment itself must have a key.

```tsx
{rows.map((row, ri) => (
  <>
    {row.map((cell, ci) => (
      ...
    ))}
  </>
))}
```

**Impact:** React will emit a console warning. More importantly, without keys, React may misidentify which row to update when rows are added/removed, causing data to appear in the wrong row cells during editing.

**Suggested fix:** Replace `<>` with `<React.Fragment key={ri}>`:

```tsx
import { Fragment } from 'react';
// ...
{rows.map((row, ri) => (
  <Fragment key={`row-${ri}`}>
    {row.map((cell, ci) => (
      ...
    ))}
  </Fragment>
))}
```

### C2. ImageThumbnail Renders User-Supplied URL as `src` Without Sanitization

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`, lines 183-204

The `ImageThumbnail` component validates that `url` starts with `https://` and passes `new URL(url)` parsing, then renders it directly as `<img src={url} />`. While the `https://` check mitigates `javascript:` and `data:` scheme attacks, the URL could still point to a tracking pixel or contain query parameters that exfiltrate data from the author's browser context (e.g., via referrer headers).

However, this is the author's own URL for their own card -- they are already in a trusted context. The `https://` check is appropriate for this use case.

**Verdict:** This is acceptable given the author-only context. The backend `IsValidHttpsUrl()` check in `AdaptiveCardService.cs` (line 623) provides an additional safety net for the actual card rendering. No change needed, but documenting this decision is recommended.

**Downgraded to Observation** -- see section 4.

---

## 2. Major Issues (Should Fix)

### M1. Auto-Save Timer Not Cleaned Up When `saveDraft` Changes

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/useComposeForm.ts`, lines 236-254

The auto-save `useEffect` has `[form, saveDraft]` as dependencies. Since `saveDraft` is a `useCallback` that depends on `[form, createMutation, updateMutation, onSaved]`, every time one of those changes (e.g., mutation state transitions), the `saveDraft` reference changes, which causes the interval to be torn down and re-created. This resets the 30-second timer. In practice, after each manual save, the mutation's `isPending` transitions from `true` to `false`, changing `createMutation`/`updateMutation` references, which recreates `saveDraft`, which restarts the interval.

**Impact:** The auto-save timer effectively resets after every save operation, meaning the 30s interval never fires if the user saves manually more frequently. This is arguably a feature (avoid auto-saving right after a manual save), but it is not intentional.

**Suggested fix:** Extract the save logic into a ref-based function so the interval closure always calls the latest version without needing to restart:

```typescript
const saveDraftRef = useRef(saveDraft);
useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);

useEffect(() => {
  const interval = setInterval(() => {
    const { isDirty } = form.formState;
    const headline = form.getValues('headline');
    const hasTitle = Boolean(headline?.trim());
    if (!isDirty || !hasTitle || isSavingRef.current) return;
    isSavingRef.current = true;
    void saveDraftRef.current().then((savedId) => {
      isSavingRef.current = false;
      if (savedId !== undefined) {
        setLastAutoSaved(new Date());
      }
    });
  }, 30_000);
  return () => clearInterval(interval);
}, [form]); // Only depends on form, which is stable
```

### M2. `estimateReach` Duplicated With Hardcoded Magic Numbers

**Files:**
- `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx`, lines 162-171
- `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`, lines 128-137

Two identical `estimateReach` functions exist with hardcoded estimates: Team=50, Group=30, Roster=20. These magic numbers are not documented and the duplication means they could diverge.

**Suggested fix:** Extract into a shared utility function in `src/CompanyCommunicator.Api/ClientApp/src/lib/validators.ts` or a new `lib/audienceUtils.ts`, with named constants explaining the estimates.

### M3. AudienceTab Initialization Guard Does Not Handle Edit-Mode Properly

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/AudienceTab.tsx`, lines 565-581

The `initializedRef` guard prevents re-initialization, but there is a subtle issue: when `formAudiences` initially arrives as `[]` (empty array from default values), the `existing.length > 0` check fails, so `initializedRef.current` never gets set to `true`. Later, when the form resets with actual audience data (from editing a draft), the effect runs again and correctly initializes. This works, but the guard logic is fragile.

Additionally, the audience names are lost because `AudienceDto` only stores `audienceId`, not a display name. The fallback `name: a.audienceId` means edited drafts show raw GUIDs instead of team/group names in the chips.

**Impact:** When editing a draft, audience chips show raw UUIDs/GUIDs instead of friendly team/group names. This is a UX issue, not a data issue.

**Suggested fix:** Consider storing a `displayName` alongside `audienceId` in the form state or fetching team/group names when loading an existing notification.

### M4. `form.watch()` Called Every Render in ComposePanel

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`, line 164

```typescript
const formValues = form.watch();
```

`form.watch()` with no arguments causes the component to re-render on every field change across the entire form. This is intentional (the ActionBar needs current values), but it means the entire ComposePanel re-renders on every keystroke.

**Impact:** Performance impact is moderate. The ContentTab and AudienceTab are child components that receive the `form` object (stable reference), so they do not re-render unless their own watched values change. However, the ComposePanel's overlay, header, tab bar, and action bar all re-render on every keystroke.

**Suggested fix:** Consider using `form.watch()` only inside the ActionBar component (which already receives `formValues` as a prop). Alternatively, use `useWatch` for specific fields the ComposePanel needs (like `headline` for the title).

### M5. Sidebar Makes 3 API Calls for Badge Counts

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/Sidebar/Sidebar.tsx`, lines 82-85

Each `NavItem` calls `useTabCount`, which issues a `useNotifications` query with `pageSize: 1`. This means the Sidebar makes 3 separate API calls (`?status=Sent&page=1&pageSize=1`, `?status=Draft&page=1&pageSize=1`, `?status=Scheduled&page=1&pageSize=1`) just to get total counts.

**Impact:** 3 extra API round-trips on every page load. The Sent tab's count query also duplicates the main MessageList query when `activeTab === 'Sent'`.

**Suggested fix (future):** Add a dedicated `/api/notifications/counts` endpoint that returns all three counts in one response. For now, this is acceptable but should be noted as a performance optimization opportunity.

### M6. `handleCancel` in DetailPanel Has `cancelMutation` in Dependencies

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/DetailPanel/DetailPanel.tsx`, line 359

```typescript
const handleCancel = useCallback(async () => {
  // ...
  await cancelMutation.mutateAsync(notificationId);
  // ...
}, [notificationId, cancelMutation, t]);
```

`cancelMutation` is the return value of `useCancelNotification()`, which changes reference on every render. This means `handleCancel` is recreated on every render, defeating the purpose of `useCallback`.

**Impact:** Minor -- the Dialog's `onClick` handlers get new references each render. In practice, this is not a visible performance issue.

**Suggested fix:** Use `cancelMutation.mutateAsync` directly or store the `mutateAsync` function in a ref.

### M7. ActionButton URL Not Validated as HTTPS in Frontend

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/blocks/ActionButtonBlock.tsx`, lines 25-55

The ActionButton block accepts any URL without validating it as HTTPS. While the backend `AdaptiveCardService.BuildActionButton()` (line 582) correctly rejects non-HTTPS URLs, the frontend allows the user to type `http://` or other scheme URLs without any visual indication that they will be silently dropped during card rendering.

**Impact:** User confusion -- an author could add an `http://` button link and not understand why it does not appear in the rendered card.

**Suggested fix:** Add a visual validation hint (e.g., Fluent UI Field `validationMessage`) when the URL does not start with `https://`, similar to the main buttonLink validation in the Zod schema.

### M8. `formValuesToCreateRequest` and `formValuesToUpdateRequest` Are Nearly Identical

**File:** `src/CompanyCommunicator.Api/ClientApp/src/lib/validators.ts`, lines 139-197

These two functions have identical logic with different return types. The only difference is the TypeScript type annotation.

**Impact:** Code duplication. If one is updated without the other, they will diverge.

**Suggested fix:** Create a single shared helper and cast the result:

```typescript
function formToApiRequest(values: ComposeFormValues) {
  return {
    title: values.headline,
    // ... all fields ...
  };
}

export function formValuesToCreateRequest(values: ComposeFormValues): CreateNotificationRequest {
  return formToApiRequest(values);
}

export function formValuesToUpdateRequest(values: ComposeFormValues): UpdateNotificationRequest {
  return formToApiRequest(values);
}
```

---

## 3. Minor Issues (Nice to Fix)

### m1. Hardcoded Strings in Components (i18n Not Wired)

Multiple components use hardcoded English strings instead of `useTranslation()`, despite the i18n file (`en-US.json`) having all the necessary keys. The handoff document acknowledges this as a "stretch goal" for Task 18, but it is worth noting:

- `DetailPanel.tsx`: "Delivery", "Delivered", "Failed", "Pending", "Total", "Audience", "Channel Posts", "Individual Messages", "Dates", "Actions", "Use as template" (lines 484-777)
- `ComposePanel.tsx`: "New Message", "Edit Message", "Saving...", "Close compose panel", "Content", "Audience", "Loading message..." (lines 228-299)
- `ContentTab.tsx`: "Headline", "Body", "Hero Image", "Add details", "Key Details", "Button Label", "Button URL", "Add footnote", "Footnote", "Remove footnote", "Advanced mode", "Add row" (throughout)
- `AudienceTab.tsx`: "Send to everyone", "Channel Posts", "Individual Messages", etc. (throughout)
- `ActionBar.tsx`: "Save Draft", "Send Preview", "Schedule", "Review", "Save as Template", "Auto-saved" (throughout)
- `ConfirmSendDialog.tsx`: "Review & Send", "Audience", "Confirm & Send", "Cancel" (throughout)
- `DeliveryTracker.tsx`: "Delivered", "Failed", "Remaining", "Done" (throughout)
- `BlockEditor.tsx`: "No advanced blocks added yet", "Add Block" (throughout)
- All block components (column, table, etc.)

**Impact:** The app will work correctly in English but cannot be localized without touching every component.

### m2. `AdvancedBlock.data` Uses `Record<string, unknown>` Instead of Discriminated Union

**File:** `src/CompanyCommunicator.Api/ClientApp/src/types/index.ts`, lines 26-30

```typescript
export interface AdvancedBlock {
  id: string;
  type: AdvancedBlockType;
  data: Record<string, unknown>;
}
```

All block component code uses `as` casts to extract typed data (e.g., `block.data['columns'] as { text?: string }[]`). This loses type safety.

**Impact:** Runtime errors if data shape does not match expectations. The `as` casts suppress TypeScript errors.

**Suggested fix (future):** Define discriminated union types for block data:

```typescript
type AdvancedBlockData =
  | { type: 'ColumnLayout'; data: { columns: { text?: string }[] } }
  | { type: 'TextBlock'; data: { text: string; size?: string; weight?: string } }
  | // ...
```

### m3. ImageSetBlock URLs Not Validated as HTTPS

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/blocks/ImageSetBlock.tsx`, lines 58-91

Same as M7 -- image URLs accept any scheme. The backend rejects non-HTTPS URLs in `BuildImageSet()` (line 414-416), but the frontend gives no feedback.

### m4. `handleClose` in ComposePanel Uses `window.confirm`

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`, lines 174-182

And similarly in `TemplatePicker.tsx` (lines 285, 289, 304). Using `window.confirm()` and `window.prompt()` is inconsistent with the rest of the UI, which uses Fluent UI Dialogs (e.g., the Cancel confirmation in DetailPanel uses `<Dialog>`).

**Impact:** Visual inconsistency. The browser's native confirm dialog does not match the Fluent UI theme and cannot be customized or localized.

### m5. `AutoSavedIndicator` Cleanup Function Has Subtle Ordering Issue

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx`, lines 187-198

The `useEffect` returns a cleanup function, but this cleanup runs on every effect execution (including when `lastAutoSaved` changes). The cleanup clears the timeout, which is correct, but the effect also sets a new timer each time, which means the indicator resets its 3-second window on every auto-save. This is actually correct behavior -- showing "Auto-saved" for 3 seconds after the most recent save.

**Verdict:** This is fine -- downgraded to observation.

### m6. `CardData` Interface in `adaptiveCard.ts` Does Not Include `author` in Preview

**File:** `src/CompanyCommunicator.Api/ClientApp/src/lib/adaptiveCard.ts`, lines 4-15

The `CardData` interface includes an optional `author` field, but the `ContentTab` never passes the author when building `cardData` (line 285-295). This means the live preview never shows the author line, even though the backend card does include it.

**Impact:** Minor preview fidelity issue. The actual sent card will include the author line, but the preview does not.

### m7. `notificationId` Race Condition in ConfirmSendDialog

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`, lines 189-213

When `notificationId` is null (new unsaved message), `handleConfirmSend` calls `onSaveDraft()` to create the draft, then passes the returned `id` to `onConfirmSend(id)`. If the save succeeds but the send fails, the notification is now saved as a draft but the dialog shows an error. The user might click "Confirm & Send" again, which would try to save again (creating a duplicate) because `notificationId` in the parent ComposePanel still reflects the state at the time the dialog was opened.

However, looking at the code flow: `onSaveDraft` calls the hook's `saveDraft()` which updates `notificationIdRef.current` and calls `setNotificationId(savedId)`. The `notificationId` prop comes from `useComposeForm`'s state, so after the save, subsequent renders will pass the correct `notificationId` to the dialog. But the dialog's `notificationId` prop does not update mid-render because the dialog is already mounted.

**Impact:** Edge case. If send fails after a save, clicking "Confirm & Send" again calls `onSaveDraft` again, which checks `notificationIdRef.current` (now set to the saved ID) and does an update instead of a create. So no duplicate is created. This is actually handled correctly.

**Verdict:** No issue -- downgraded to observation.

### m8. `useComposeForm` Does Not Reset `lastAutoSaved` When `editId` Changes

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/useComposeForm.ts`, lines 109, 113-115

When switching from one notification to another (parent changes `editId`), the `lastAutoSaved` state retains the timestamp from the previous notification. This could briefly show "Auto-saved" from the previous session.

**Suggested fix:** Reset `lastAutoSaved` when `editId` changes:

```typescript
useEffect(() => {
  setNotificationId(editId ?? null);
  setLastAutoSaved(null);
}, [editId]);
```

### m9. Unused Imports

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`, line 16

`Send16Regular` is imported but not used directly -- the send icon is only used conditionally via the `Spinner` / `Send16Regular` toggle in the button. This is actually used. No issue.

**Retracted.**

### m10. `Sidebar.tsx` Uses Old Translation Keys

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/Sidebar/Sidebar.tsx`, lines 110-127

The NAV_ITEMS use `labelKey: 'notificationList.tabs.sent'` etc., which reference the old i18n structure. The new i18n file (`en-US.json`) does not have `notificationList.tabs.*` keys -- it has `sidebar.sent`, `sidebar.drafts`, `sidebar.scheduled`. The Compose button also uses `notificationList.newButton` which maps correctly to `messageList.newButton` in the new schema.

However, looking at the i18n file, neither `notificationList.tabs.sent` nor `sidebar.sent` is defined under a `notificationList.tabs` path. The file has:
- `sidebar.compose`, `sidebar.sent`, `sidebar.drafts`, `sidebar.scheduled`
- `messageList.title`, `messageList.newButton`

But the Sidebar code references `notificationList.tabs.sent`, `notificationList.tabs.draft`, `notificationList.tabs.scheduled`, and `notificationList.newButton` -- none of which exist in the current i18n file.

**Impact:** The i18n `t()` calls return the key itself as a fallback (e.g., `"notificationList.tabs.sent"` would display as the literal key string). However, the i18n file does have `messageList.newButton: "New Message"` -- but Sidebar references `notificationList.newButton`. These are mismatched.

Wait -- looking more carefully at the i18n file, there is no `notificationList` top-level key. There is `messageList` with `newButton`, and `sidebar` with `sent`/`drafts`/`scheduled`. But the Sidebar code uses `notificationList.tabs.*` and `notificationList.newButton`.

Given that `react-i18next` returns the key path as fallback when a key is missing, the nav items would display as `"notificationList.tabs.sent"` etc., which is wrong.

**BUT** -- looking at the old i18n structure that may still exist from before the redesign... let me check if there was a `notificationList` section. Yes, looking at the current `en-US.json`, there is no `notificationList.tabs` section. The `messageList` section has `empty.draft`, `empty.sent`, `empty.scheduled` but no `tabs`.

This means the Sidebar labels likely display as the raw key strings at runtime, OR there is an older version of the i18n file that was merged.

Actually, re-reading the i18n file at lines 159-171, I see `messageList` with `title: "Messages"`, `newButton: "New Message"`, `empty.*`, and `pagination.*`. There is no `notificationList` section at all.

**This is a real bug.** The Sidebar nav items will display their i18n key paths as literal text instead of translated labels.

**Suggested fix:** Update `Sidebar.tsx` to use the correct i18n keys:

```typescript
const NAV_ITEMS: NavItemDef[] = [
  { tab: 'Sent', labelKey: 'sidebar.sent', ... },
  { tab: 'Draft', labelKey: 'sidebar.drafts', ... },
  { tab: 'Scheduled', labelKey: 'sidebar.scheduled', ... },
];
```

And for the Compose button, use `sidebar.compose` instead of `notificationList.newButton`.

Also update `nav.notifications` reference on line 185 to a valid key.

### m11. `notificationList.empty.*` Keys Used by MessageList Reference Old Keys

**File:** `src/CompanyCommunicator.Api/ClientApp/src/components/MessageList/MessageList.tsx`, lines 517-521

```typescript
const emptyMessages: Record<NotificationTab, string> = {
  Draft: t('notificationList.empty.draft'),
  Sent: t('notificationList.empty.sent'),
  Scheduled: t('notificationList.empty.scheduled'),
};
```

The i18n file has these under `messageList.empty.*`, not `notificationList.empty.*`. Similar to m10.

**Suggested fix:** Update to `messageList.empty.draft`, `messageList.empty.sent`, `messageList.empty.scheduled`.

**Also:** Line 585 uses `t('notificationList.title')` which should be `t('messageList.title')`, and line 593 uses `t('notificationList.pagination.showing')` which should be `t('messageList.pagination.showing')`.

### m12. `SendQueueMessage` Does Not Include RecipientType

**File:** `src/CompanyCommunicator.Core/Models/SendQueueMessage.cs`

The `SendQueueMessage` record does not include `RecipientType`, but `SendMessageFunction.cs` (line 219) checks `sentNotification.RecipientType`. This means the function must load the `SentNotification` entity from the database to determine recipient type, which it already does (line 114). This is fine -- but worth noting that the recipient type check relies on the DB entity, not the queue message.

**Impact:** No functional issue. The DB lookup is already happening.

---

## 4. Observations (No Action Needed)

### O1. Plan Alignment -- All Architecture Decisions Correctly Implemented

The implementation correctly follows all 10 architecture decisions listed in the handoff document:

1. **CommunicationCenter manages all state** -- Confirmed. All state (`selectedTab`, `selectedMessageId`, `composeOpen`, `composeEditId`, `cloneValues`) lives in CommunicationCenter.
2. **Sidebar uses `useNotifications({page:1, pageSize:1})`** -- Confirmed via `useTabCount`.
3. **Compose is state-driven** -- Confirmed. No route for compose; it is toggled via `composeOpen` state.
4. **All styling uses Fluent UI v9 tokens** -- Confirmed. Reviewed all `makeStyles` blocks; no hardcoded colors found except `#ffffff`/`#000000`/etc. in the `adaptiveCard.ts` host config, which is appropriate for the Adaptive Card renderer.
5. **Form schema renamed `title` to `headline`, `summary` to `body`** -- Confirmed. `formValuesToCreateRequest` maps `headline` to `title`.
6. **JSON fields stored as strings in API, typed in form** -- Confirmed. `parseKeyDetails`, `parseCustomVariables`, `parseAdvancedBlocks` handle parsing; `JSON.stringify()` handles serialization.
7. **Auto-save: 30s interval** -- Confirmed in `useComposeForm.ts`.
8. **ConfirmSendDialog manages `'review' | 'sending'` phases** -- Confirmed.
9. **ActionBar receives `onReview` callback** -- Confirmed.
10. **ComposePanel accepts `onDeliveryDone`** -- Confirmed.

### O2. Clone-to-Compose Implementation Is Well Done

The `handleCloneToCompose` function in `CommunicationCenter.tsx` (lines 101-134) correctly:
- Parses all JSON fields from the notification
- Converts custom variables from `Record<string, string>` to `{ name, value }[]` format
- Opens compose with `editId: null` (new draft, not editing original)
- `useComposeForm` accepts `initialValues` and uses them as defaults

### O3. Backend Variable Resolution Is Correct

The Task 19 implementation correctly follows the planned architecture:

- **Custom variables** resolved once in `StoreCardActivity.cs` (line 65) after `BuildNotificationCard` -- correct, same values for all recipients.
- **Recipient variables** resolved per-user in `SendMessageFunction.cs` (lines 218-257) -- correct, only for User recipients, skipped for Team recipients.
- **Graph failures** logged as warnings, card sent with unresolved tokens (line 252) -- correct per plan.
- **Optimization** applied: only fetches Graph profile if card contains `{{` tokens (line 218) -- correct.

### O4. JSON Escaping in `ReplaceVariables` Is Correctly Implemented

`AdaptiveCardService.cs` line 611 uses `JsonSerializer.Serialize(value)[1..^1]` to JSON-escape variable values before substitution. This prevents JSON injection through variable values containing quotes, backslashes, or newlines. This was a code review fix from Tasks 1-4 (commit `6b5d8af` issue C3) and is correctly maintained.

### O5. Error Boundary Usage Is Appropriate

`CommunicationCenter.tsx` wraps `MessageList` and `DetailPanel` in `<ErrorBoundary>` components (lines 149, 162). The ComposePanel is not wrapped but has its own error handling through the mutation hooks. This is a reasonable approach.

### O6. Deferred Values for Live Preview

`ContentTab.tsx` uses `useDeferredValue(watchedValues)` (line 256) for the live preview, which is a good React 19 pattern that prevents preview re-rendering from blocking form input. Well done.

### O7. DI Registration in Send Function Is Complete

`SendMessageFunction` requires `IAdaptiveCardService` and `GraphServiceClient`. Both are registered in `Program.cs`:
- `IAdaptiveCardService` is registered via `services.AddCoreServices()` (line 88)
- `GraphServiceClient` is explicitly registered (line 83)

The comment on line 77 ("The Send Function never calls Graph") is now outdated since Task 19 added Graph calls for recipient variable resolution. The comment should be updated but is not a functional issue.

### O8. `allAudiencesAreChannelPosts` Logic Is Correct

`variables.ts` line 83: Returns `false` when `allUsers` is true (correct -- "all users" means individual DMs, not channel posts). Returns `false` when no audiences are selected (correct -- cannot determine). Returns `true` only when all audiences are type `'Team'` (correct -- Team type = channel post).

### O9. Template Button Links Default to `https://`

`builtinTemplates.ts` uses `buttonLink: 'https://'` as placeholder values. This passes the Zod URL validation (`z.string().url()`) because `https://` is a valid URL according to the URL constructor. When the user does not replace it, the card will have a button linking to `https://` which does nothing useful. This is acceptable as a placeholder hint.

---

## Summary of Required Actions

| Priority | ID | File | Issue |
|----------|-----|------|-------|
| **Critical** | C1 | `blocks/TableBlock.tsx` | Missing `key` on React Fragment in `rows.map()` |
| **Major** | M1 | `useComposeForm.ts` | Auto-save interval resets on every save due to dependency array |
| **Major** | M2 | `ActionBar.tsx` + `ConfirmSendDialog.tsx` | Duplicated `estimateReach` with magic numbers |
| **Major** | M3 | `AudienceTab.tsx` | Edited drafts show GUIDs instead of team/group names |
| **Major** | M4 | `ComposePanel.tsx` | `form.watch()` causes full re-render on every keystroke |
| **Major** | M7 | `blocks/ActionButtonBlock.tsx` | No HTTPS validation feedback on action button URLs |
| **Major** | M8 | `validators.ts` | Duplicated `formValuesToCreateRequest`/`formValuesToUpdateRequest` |
| **Minor** | m1 | Multiple files | Hardcoded English strings not wired to i18n |
| **Minor** | m2 | `types/index.ts` | `AdvancedBlock.data` uses `Record<string, unknown>` |
| **Minor** | m4 | `ComposePanel.tsx`, `TemplatePicker.tsx` | `window.confirm()` inconsistent with Fluent UI Dialogs |
| **Minor** | m8 | `useComposeForm.ts` | `lastAutoSaved` not reset when `editId` changes |
| **Minor** | m10 | `Sidebar.tsx` | i18n keys reference nonexistent `notificationList.tabs.*` paths |
| **Minor** | m11 | `MessageList.tsx` | i18n keys reference `notificationList.*` instead of `messageList.*` |

**Recommended priority:** Fix C1 immediately (trivial one-line fix). Fix m10 and m11 next (i18n key mismatches cause visible bugs). Then address M1-M8 as part of the next polish pass.
