# UI Audit Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues identified by the 5-agent UX/UI audit (visual design, accessibility, usability, React patterns, frontend architecture).

**Architecture:** 21 tasks across 4 phases. Each task is independent unless noted. No backend changes except Task 4 (AudienceDto displayName). All changes are in `src/CompanyCommunicator.Api/ClientApp/src/`.

**Tech Stack:** React 19, Fluent UI v9, react-hook-form, TanStack Query, Vite

**Build command:** `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

---

## Phase 1: Functional Breakage (Tasks 1-5)

### Task 1: Replace window.confirm() in TemplatePicker

`window.confirm()` silently returns `false` inside Teams iframes. Three calls need Fluent Dialog replacements.

**Files:**
- Modify: `components/ComposePanel/TemplatePicker.tsx`

**Step 1: Add confirmation dialog state and Dialog imports**

At the top of `TemplatePicker.tsx`, add Dialog imports to the existing Fluent import:

```tsx
// Add to existing @fluentui/react-components import:
import {
  // ... existing imports ...
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
```

Inside `TemplatePicker` component, add state for a pending confirmation:

```tsx
const [pendingAction, setPendingAction] = useState<{
  message: string;
  onConfirm: () => void;
} | null>(null);
```

**Step 2: Replace the three window.confirm() calls**

Replace `handleSelect` (lines 275-297):

```tsx
const handleSelect = (schema: CardSchema, templateId: string) => {
  const values = form.getValues();
  const hasContent = formHasContent(values);

  if (templateId === BLANK_TEMPLATE_ID && !hasContent) {
    return;
  }

  if (hasContent && templateId !== BLANK_TEMPLATE_ID) {
    setPendingAction({
      message: 'Replace current content with this template?',
      onConfirm: () => { applySchema(form, schema); },
    });
    return;
  }

  if (hasContent && templateId === BLANK_TEMPLATE_ID) {
    setPendingAction({
      message: 'Clear current content and start with a blank card?',
      onConfirm: () => { applySchema(form, schema); },
    });
    return;
  }

  applySchema(form, schema);
};
```

Replace `handleDelete` (lines 303-310):

```tsx
const handleDelete = (id: string) => {
  setPendingAction({
    message: 'Delete this custom template?',
    onConfirm: () => {
      setDeletingId(id);
      deleteTemplateMutation.mutate(id, {
        onSettled: () => { setDeletingId(null); },
      });
    },
  });
};
```

**Step 3: Add Dialog at the end of the component JSX**

Right before the closing `</div>` of the root element:

```tsx
<Dialog
  open={pendingAction !== null}
  onOpenChange={(_e, data) => { if (!data.open) setPendingAction(null); }}
>
  <DialogSurface>
    <DialogBody>
      <DialogTitle>Confirm</DialogTitle>
      <DialogContent>{pendingAction?.message}</DialogContent>
      <DialogActions>
        <Button
          appearance="secondary"
          onClick={() => { setPendingAction(null); }}
        >
          Cancel
        </Button>
        <Button
          appearance="primary"
          onClick={() => {
            pendingAction?.onConfirm();
            setPendingAction(null);
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </DialogBody>
  </DialogSurface>
</Dialog>
```

**Step 4: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`
Expected: Clean build, no errors.

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx
git commit -m "fix(ui): replace window.confirm with Fluent Dialog in TemplatePicker"
```

---

### Task 2: Delete dead useAuth.ts hook

`useAuth.ts` is never imported anywhere. It has its own independent token cache that doesn't coordinate with `client.ts`. Remove it.

**Files:**
- Delete: `hooks/useAuth.ts`

**Step 1: Verify it's truly unused**

Search for any import of `useAuth`:

```bash
grep -r "useAuth" src/CompanyCommunicator.Api/ClientApp/src/ --include="*.ts" --include="*.tsx"
```

Expected: Only the file itself and no imports from other files.

**Step 2: Delete the file**

```bash
rm src/CompanyCommunicator.Api/ClientApp/src/hooks/useAuth.ts
```

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead useAuth.ts hook (unused, separate token cache)"
```

---

### Task 3: Move TeamsTheme type and delete dead useTeamsContext.ts

`useTeamsContext.ts` is never imported as a hook. Only the `TeamsTheme` type export is used (by `AdaptiveCardPreview.tsx`). Move the type, then delete the dead hook.

**Files:**
- Modify: `hooks/useTeamsContext.ts` (delete)
- Modify: `components/AdaptiveCardPreview/AdaptiveCardPreview.tsx` (update import)

**Step 1: Move TeamsTheme type to types/index.ts**

Add at the bottom of `types/index.ts`:

```ts
export type TeamsTheme = 'default' | 'dark' | 'contrast';
```

**Step 2: Update the import in AdaptiveCardPreview.tsx**

Change line 6 from:
```tsx
import type { TeamsTheme } from '@/hooks/useTeamsContext';
```
to:
```tsx
import type { TeamsTheme } from '@/types';
```

**Step 3: Add locale sync to main.tsx**

The dead hook had locale sync (`i18n.changeLanguage(locale)`) that never fired. Add it to the bootstrap in `main.tsx`. Inside the `bootstrap()` function, after `setTheme(mapTheme(context.app.theme));`, add:

```tsx
// Sync i18n locale with Teams context
const locale = context.app.locale;
if (locale) {
  void import('./i18n').then((mod) => {
    void mod.default.changeLanguage(locale);
  });
}
```

**Step 4: Delete the hook file**

```bash
rm src/CompanyCommunicator.Api/ClientApp/src/hooks/useTeamsContext.ts
```

**Step 5: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: move TeamsTheme type to types/, add locale sync to main.tsx, delete dead useTeamsContext.ts"
```

---

### Task 4: Add displayName to AudienceDto

Audiences currently show raw GUIDs because `AudienceDto` has no `displayName` field. The AudienceTab already tracks names internally (`SelectedAudience.name`), but that name is lost when synced to the form because `toAudienceDtos()` drops it.

**Files:**
- Modify: `types/index.ts` (add displayName to AudienceDto)
- Modify: `components/ComposePanel/AudienceTab.tsx` (include name in DTO conversion)
- Modify: `components/ComposePanel/ConfirmSendDialog.tsx` (show name instead of GUID)
- Modify: `components/DetailPanel/DetailPanel.tsx` (show name instead of GUID)

**Step 1: Add displayName to AudienceDto**

In `types/index.ts`, change lines 112-115:

```ts
export interface AudienceDto {
  audienceType: 'Team' | 'Roster' | 'Group';
  audienceId: string;
  displayName?: string;
}
```

**Step 2: Include name in toAudienceDtos()**

In `AudienceTab.tsx`, update `toAudienceDtos` (lines 58-69):

```ts
function toAudienceDtos(selected: SelectedAudience[]): AudienceDto[] {
  return selected.map((s) => {
    if (s.type === 'team' && s.deliveryMode === 'channel') {
      return { audienceType: 'Team', audienceId: s.id, displayName: s.name };
    }
    if (s.type === 'team' && s.deliveryMode === 'individual') {
      return { audienceType: 'Roster', audienceId: s.id, displayName: s.name };
    }
    return { audienceType: 'Group', audienceId: s.id, displayName: s.name };
  });
}
```

**Step 3: Show displayName in ConfirmSendDialog**

In `ConfirmSendDialog.tsx`, update the audience Badge elements:

For channel posts (line 264-266):
```tsx
<Badge key={a.audienceId} appearance="tint" color="brand" size="small">
  {a.displayName ?? a.audienceId}
</Badge>
```

For individuals (line 277-279):
```tsx
<Badge key={a.audienceId} appearance="tint" color="subtle" size="small">
  {a.displayName ?? a.audienceId} ({a.audienceType})
</Badge>
```

**Step 4: Show displayName in DetailPanel**

In `DetailPanel.tsx`, update the `AudienceChip` component (lines 256-276). Change `truncateId` call:

```tsx
function AudienceChip({ audience }: AudienceChipProps) {
  const isTeam = audience.audienceType === 'Team';
  const color = isTeam ? 'informative' : 'important';
  const label = audience.displayName ?? truncateId(audience.audienceId);

  return (
    <Badge
      appearance="tint"
      color={color}
      title={audience.displayName ?? audience.audienceId}
      aria-label={`${audience.audienceType}: ${audience.displayName ?? audience.audienceId}`}
    >
      {isTeam ? (
        <PeopleTeam20Regular style={{ fontSize: '12px', marginRight: '2px' }} />
      ) : (
        <People20Regular style={{ fontSize: '12px', marginRight: '2px' }} />
      )}
      {label}
    </Badge>
  );
}
```

**Step 5: Also use name when reconstructing from existing form data**

In `AudienceTab.tsx`, update the reconstruction in the `useEffect` (line 574). Note the comment on line 574: `name: a.audienceId, // Name not stored in AudienceDto; use ID as fallback` — now change to:

```ts
name: a.displayName ?? a.audienceId,
```

**Step 6: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 7: Commit**

```bash
git add -A
git commit -m "fix(ui): show audience display names instead of GUIDs"
```

> **Note:** The backend `AudienceDto` C# class and create/update request models should also include `DisplayName`. This is a backend-only change that can be done separately. The frontend will gracefully fall back to `audienceId` if `displayName` is null.

---

### Task 5: Add 401 token cache clear in client.ts

When the server invalidates a token (e.g., revoked consent), the frontend continues using the stale cached token for up to 50 minutes. Add 401 detection to `request()` that clears the cache and retries once.

**Files:**
- Modify: `api/client.ts`

**Step 1: Add 401 retry logic**

In `client.ts`, modify the `request` function. After the `if (!response.ok)` block (line 89), add a 401 retry before throwing:

Replace lines 89-113 with:

```ts
  if (!response.ok) {
    // On 401, clear the token cache and retry once with a fresh token
    if (response.status === 401 && cachedToken !== null) {
      clearTokenCache();
      const freshToken = await getTeamsToken();
      const retryHeaders = { ...headers, Authorization: `Bearer ${freshToken}` };

      const retryResponse = await fetch(path, {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      if (retryResponse.ok) {
        if (retryResponse.status === 204 || retryResponse.headers.get('content-length') === '0') {
          return undefined as unknown as T;
        }
        return retryResponse.json() as Promise<T>;
      }

      // Retry also failed — fall through to error handling with retryResponse
      return handleErrorResponse<T>(retryResponse);
    }

    return handleErrorResponse<T>(response);
  }
```

**Step 2: Extract error handling into a helper**

Add above the `request` function:

```ts
async function handleErrorResponse<T>(response: Response): Promise<T> {
  let message = `HTTP ${String(response.status)}: ${response.statusText}`;
  let detail: string | undefined;

  try {
    const errorJson = (await response.json()) as {
      message?: string;
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
    message = errorJson.message ?? errorJson.title ?? message;
    detail = errorJson.detail;
    if (errorJson.errors) {
      const fieldErrors = Object.entries(errorJson.errors)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
        .join('; ');
      detail = fieldErrors;
    }
  } catch {
    // ignore JSON parse error; use status text
  }

  throw new ApiResponseError({ status: response.status, message, detail });
}
```

**Step 3: Update the original error handling in `request`**

Remove the old error parsing code that was at lines 89-113 (now replaced in Step 1).

**Step 4: Also fix requestWithHeaders**

Add the same 401 retry logic to `requestWithHeaders`. Or better: refactor to share the inner fetch logic. For simplicity, add the same pattern:

After `if (!response.ok)` in `requestWithHeaders`, add:

```ts
  if (!response.ok) {
    if (response.status === 401 && cachedToken !== null) {
      clearTokenCache();
      const freshToken = await getTeamsToken();
      const retryHeaders = { ...headers, Authorization: `Bearer ${freshToken}` };

      const retryResponse = await fetch(path, {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      if (retryResponse.ok) {
        const data = (await retryResponse.json()) as T;
        return { data, headers: retryResponse.headers };
      }

      return handleErrorResponse(retryResponse) as never;
    }

    return handleErrorResponse(response) as never;
  }
```

**Step 5: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 6: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/api/client.ts
git commit -m "fix: clear token cache and retry on 401 responses"
```

---

## Phase 2: Accessibility (Tasks 6-10)

### Task 6: Add focus trap to ComposePanel and ConfirmSendDialog

Both modal dialogs currently allow Tab to escape into content behind the overlay.

**Files:**
- Modify: `components/ComposePanel/ComposePanel.tsx`
- Modify: `components/ComposePanel/ConfirmSendDialog.tsx`

**Step 1: Create a reusable focus-trap hook**

Create `hooks/useFocusTrap.ts`:

```ts
import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => { container.removeEventListener('keydown', handleKeyDown); };
  }, [containerRef, active]);
}
```

**Step 2: Apply to ComposePanel**

In `ComposePanel.tsx`, import and use:

```tsx
import { useFocusTrap } from '@/hooks/useFocusTrap';
```

After the `panelRef` declaration (line 165), add:

```tsx
useFocusTrap(panelRef, true);
```

**Step 3: Apply to ConfirmSendDialog**

In `ConfirmSendDialog.tsx`, add a ref to the dialog div and use the focus trap:

```tsx
import { useFocusTrap } from '@/hooks/useFocusTrap';
```

Inside the component, add:

```tsx
const dialogRef = useRef<HTMLDivElement>(null);
useFocusTrap(dialogRef, true);
```

Add `ref={dialogRef}` to the dialog div (the one with `className={styles.dialog}`).

Also add auto-focus: after the `useFocusTrap` call:

```tsx
useEffect(() => {
  dialogRef.current?.focus();
}, []);
```

Add `tabIndex={-1}` to the dialog div.

**Step 4: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 5: Commit**

```bash
git add -A
git commit -m "a11y: add focus trap to ComposePanel and ConfirmSendDialog"
```

---

### Task 7: Add ARIA progressbar to DeliveryTracker SVG ring

The SVG progress ring has no ARIA semantics. Screen readers can't convey progress.

**Files:**
- Modify: `components/ComposePanel/DeliveryTracker.tsx`

**Step 1: Add ARIA attributes to the progress ring container**

In `DeliveryTracker.tsx`, update the progress ring div (line 148):

```tsx
<div
  className={styles.progressRing}
  role="progressbar"
  aria-valuenow={percentage}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Delivery progress: ${percentage}%`}
>
```

**Step 2: Add aria-live to the status row**

Update the status row div (line 200):

```tsx
<div className={styles.statusRow} aria-live="polite">
```

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/DeliveryTracker.tsx
git commit -m "a11y: add role=progressbar and aria-live to DeliveryTracker"
```

---

### Task 8: Add prefers-reduced-motion to global.css

All CSS animations (pulsing dots, progress bars, slide transitions) should respect user motion preferences.

**Files:**
- Modify: `global.css`

**Step 1: Add reduced-motion media query**

Append to the end of `global.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 2: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/global.css
git commit -m "a11y: respect prefers-reduced-motion for all animations"
```

---

### Task 9: Add aria-live to delivery status regions

The DetailPanel auto-refresh indicator already has `aria-live="polite"` (line 473), but the delivery stats grid (counts that update during sending) does not.

**Files:**
- Modify: `components/DetailPanel/DetailPanel.tsx`

**Step 1: Add aria-live to the stats grid section**

In `DetailPanel.tsx`, update the showStats section wrapper (line 483):

```tsx
<div className={styles.section} aria-live="polite" aria-atomic="true">
```

**Step 2: Add aria-live to the progress section**

Update the showProgress section (line 548):

```tsx
{showProgress && totalCount > 0 && (
  <div className={styles.section} aria-live="polite">
```

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/DetailPanel/DetailPanel.tsx
git commit -m "a11y: add aria-live to DetailPanel delivery stats and progress"
```

---

### Task 10: Fix heading hierarchy in DetailPanel

The notification title uses `<Text as="h2">` but there's no `<h1>` on the page. Fix by removing the heading semantics (the panel is a region with an aria-label, not a document section).

**Files:**
- Modify: `components/DetailPanel/DetailPanel.tsx`

**Step 1: Remove `as="h2"` from the title**

In `DetailPanel.tsx`, line 433, change:

```tsx
as="h2"
```

to remove it entirely. The `<Text>` already has `size={400}` and `weight="semibold"` for visual hierarchy.

**Step 2: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/DetailPanel/DetailPanel.tsx
git commit -m "a11y: remove orphan h2 heading from DetailPanel title"
```

---

## Phase 3: Performance (Tasks 11-15)

### Task 11: Narrow ActionBar.watch() to specific fields

`form.watch()` with no arguments (line 388) subscribes to ALL form fields, causing ActionBar to re-render on every keystroke in every field. Only a few fields are actually needed.

**Files:**
- Modify: `components/ComposePanel/ActionBar.tsx`

**Step 1: Replace watch() with targeted watches**

In `ActionBar.tsx`, replace line 388:

```tsx
const formValues = form.watch();
```

with:

```tsx
const allUsers = form.watch('allUsers');
const audiences = form.watch('audiences');
const headline = form.watch('headline');
```

**Step 2: Update all references to formValues**

Replace `formValues.allUsers` with `allUsers`, `formValues.audiences` with `audiences`, `formValues.headline` with `headline`.

Specifically:
- Line 391: `buildAudienceSummary(formValues.allUsers, formValues.audiences)` → `buildAudienceSummary(allUsers, audiences)`
- Line 392: `estimateReach(formValues.allUsers, formValues.audiences)` → `estimateReach(allUsers, audiences)`
- Line 393: `formValues.allUsers || (formValues.audiences ?? []).length > 0` → `allUsers || (audiences ?? []).length > 0`
- Line 414: `formValues.allUsers` → `allUsers`
- Line 494: `!formValues.headline?.trim()` → `!headline?.trim()`

**Step 3: Fix SaveTemplateDialog — it needs all form values**

The `SaveTemplateDialog` component (line 502-506) passes `formValues`. Since we no longer have a full `formValues`, change:

```tsx
<SaveTemplateDialog
  open={templateDialogOpen}
  onClose={() => { setTemplateDialogOpen(false); }}
  formValues={form.getValues()}
/>
```

Use `form.getValues()` (snapshot) instead. This is only called when the dialog is already open, so no performance concern.

**Step 4: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx
git commit -m "perf: narrow ActionBar.watch() to only allUsers, audiences, headline"
```

---

### Task 12: Stabilize CommunicationCenter callbacks with useCallback

The `actions` object is recreated every render, causing unstable callback references for all child components.

**Files:**
- Modify: `components/CommunicationCenter/CommunicationCenter.tsx`

**Step 1: Wrap callbacks in useCallback**

Replace the `actions` object (lines 83-102) with individual `useCallback` hooks:

```tsx
const handleTabChange = useCallback((tab: NotificationTab) => {
  setSelectedTab(tab);
  setSelectedMessageId(null);
}, []);

const handleSelectMessage = useCallback((id: string | null) => {
  setSelectedMessageId(id);
}, []);

const handleOpenCompose = useCallback((editId: string | null = null) => {
  setComposeEditId(editId);
  setCloneValues(null);
  setComposeOpen(true);
}, []);

const handleCloseCompose = useCallback(() => {
  setComposeOpen(false);
  setComposeEditId(null);
  setCloneValues(null);
}, []);
```

**Step 2: Update JSX to use new callback names**

Replace:
- `actions.onTabChange` → `handleTabChange`
- `actions.onSelectMessage` → `handleSelectMessage`
- `actions.onOpenCompose` → `handleOpenCompose`
- `actions.onCloseCompose` → `handleCloseCompose`

Replace inline arrow functions with stable references:
- Line 147: `onComposeClick={() => actions.onOpenCompose()}` → `onComposeClick={handleOpenCompose}`

Note: `handleOpenCompose` has a default parameter (`editId = null`), so calling it with no args works.

- Line 165: `onClose={() => actions.onSelectMessage(null)}` → use a dedicated callback:

```tsx
const handleCloseDetail = useCallback(() => {
  setSelectedMessageId(null);
}, []);
```

Then: `onClose={handleCloseDetail}`

- Line 166: `onEdit={(id) => actions.onOpenCompose(id)}` → `onEdit={handleOpenCompose}`

- Line 180-183: `onDeliveryDone` inline → extract:

```tsx
const handleDeliveryDone = useCallback(() => {
  setComposeOpen(false);
  setComposeEditId(null);
  setCloneValues(null);
  setSelectedTab('Sent');
}, []);
```

**Step 3: Remove the `actions` object and `CommunicationCenterActions` interface**

Delete the `actions` variable and the `CommunicationCenterActions` interface (lines 62-67) since nothing external uses it.

**Step 4: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx
git commit -m "perf: stabilize CommunicationCenter callbacks with useCallback"
```

---

### Task 13: Remove double useDeferredValue in AdaptiveCardPreview

`ContentTab.tsx` already defers values (`useDeferredValue(watchedValues)` at line 256). `AdaptiveCardPreview` then defers them again (`useDeferredValue(data)` at line 62). This double-deferral adds latency with no benefit.

**Files:**
- Modify: `components/AdaptiveCardPreview/AdaptiveCardPreview.tsx`

**Step 1: Remove the inner useDeferredValue**

Replace lines 62-63:

```tsx
const deferredData = useDeferredValue(data);
const deferredTheme = useDeferredValue(theme);
```

with direct usage:

Remove those two lines entirely and replace `deferredData` with `data` and `deferredTheme` with `theme` in the `useEffect` (lines 69-78).

Also remove `useDeferredValue` from the import on line 1.

**Step 2: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/AdaptiveCardPreview/AdaptiveCardPreview.tsx
git commit -m "perf: remove redundant useDeferredValue from AdaptiveCardPreview"
```

---

### Task 14: Lazy-load ComposePanel

ComposePanel is heavy (imports TemplatePicker, BlockEditor, AdaptiveCardPreview, etc.) but only renders when the user clicks "Compose". Lazy-loading it reduces the initial bundle.

**Files:**
- Modify: `components/CommunicationCenter/CommunicationCenter.tsx`

**Step 1: Replace static import with lazy**

In `CommunicationCenter.tsx`, replace line 7:

```tsx
import { ComposePanel } from '@/components/ComposePanel/ComposePanel';
```

with:

```tsx
import { lazy, Suspense } from 'react';
```

(Add `lazy` and `Suspense` to the existing import from `react` on line 1.)

Then add:

```tsx
const ComposePanel = lazy(() =>
  import('@/components/ComposePanel/ComposePanel').then((m) => ({
    default: m.ComposePanel,
  })),
);
```

**Step 2: Wrap the ComposePanel render in Suspense**

Replace the ComposePanel render (lines 175-185):

```tsx
{composeOpen && (
  <Suspense fallback={null}>
    <ComposePanel
      editId={composeEditId}
      initialValues={cloneValues}
      onClose={handleCloseCompose}
      onDeliveryDone={handleDeliveryDone}
    />
  </Suspense>
)}
```

Using `fallback={null}` because the overlay appears instantly — there's no visible loading gap.

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`
Expected: A new chunk file in the build output for ComposePanel.

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx
git commit -m "perf: lazy-load ComposePanel to reduce initial bundle"
```

---

### Task 15: Wrap MessageRow in React.memo

MessageRow receives `notification`, `tab`, `isSelected`, `onSelect`, `styles`, and `t`. When the list re-renders (e.g., search changes), every row re-renders even if its props haven't changed.

**Files:**
- Modify: `components/MessageList/MessageList.tsx`

**Step 1: Add memo import**

Add `memo` to the React import on line 1:

```tsx
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
```

**Step 2: Wrap MessageRow with memo**

Change line 378:

```tsx
function MessageRow({
```

to:

```tsx
const MessageRow = memo(function MessageRow({
```

And close with `});` after the component's closing brace (after line 448):

```tsx
});
```

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/MessageList/MessageList.tsx
git commit -m "perf: wrap MessageRow in React.memo to prevent unnecessary re-renders"
```

---

## Phase 4: UX Polish (Tasks 16-21)

### Task 16: Add time picker to SchedulePopover

Currently the schedule popover only has a DatePicker — no way to set time. Users can only schedule to a date, not a specific time.

**Files:**
- Modify: `components/ComposePanel/ActionBar.tsx`

**Step 1: Add a time input field**

In the `SchedulePopover` component, add a time state:

```tsx
const [selectedTime, setSelectedTime] = useState('09:00');
```

After the `DatePicker` (line 226-230), add:

```tsx
<Field label="Time">
  <Input
    type="time"
    value={selectedTime}
    onChange={(_e, data) => { setSelectedTime(data.value); }}
  />
</Field>
```

**Step 2: Combine date and time in handleSchedule**

Update `handleSchedule` to merge date + time:

```tsx
const handleSchedule = useCallback(async () => {
  if (!selectedDate) return;

  // Combine date + time
  const [hours, minutes] = selectedTime.split(':').map(Number);
  const combined = new Date(selectedDate);
  combined.setHours(hours ?? 9, minutes ?? 0, 0, 0);

  let id = notificationId;
  if (!id) {
    id = await onSaveDraft() ?? null;
  }
  if (!id) return;

  await scheduleMutation.mutateAsync({
    id,
    body: { scheduledDate: combined.toISOString() },
  });
  setOpen(false);
  setSelectedDate(null);
  setSelectedTime('09:00');
}, [selectedDate, selectedTime, notificationId, onSaveDraft, scheduleMutation]);
```

**Step 3: Add error handling with try/catch**

Wrap the body of `handleSchedule` in try/catch:

```tsx
try {
  // ... existing logic ...
} catch {
  // Error is surfaced via scheduleMutation.error
}
```

**Step 4: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 5: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx
git commit -m "feat(ui): add time picker to schedule popover"
```

---

### Task 17: Stop auto-launching compose on draft click

Currently in `MessageList.tsx` line 510-511, clicking a Draft row automatically opens ComposePanel in addition to the detail panel. This is confusing because the detail panel shows draft info, then immediately gets covered by ComposePanel.

**Files:**
- Modify: `components/MessageList/MessageList.tsx`

**Step 1: Remove auto-compose launch from handleSelect**

Change the `handleSelect` callback (lines 507-515):

```tsx
const handleSelect = useCallback(
  (notification: NotificationSummaryDto) => {
    onSelectMessage(notification.id);
  },
  [onSelectMessage],
);
```

Remove the `onOpenCompose` from the dependency array and the conditional call. The DetailPanel already has an "Edit" button for drafts.

**Step 2: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/MessageList/MessageList.tsx
git commit -m "fix(ui): stop auto-launching compose when clicking draft rows"
```

---

### Task 18: Surface auto-save errors

In `useComposeForm.ts`, auto-save failures are silently swallowed (line 251). If auto-save fails (e.g., network error), the user has no idea their work isn't being saved.

**Files:**
- Modify: `components/ComposePanel/useComposeForm.ts`
- Modify: `components/ComposePanel/ComposePanel.tsx`

**Step 1: Add autoSaveError state to useComposeForm**

In `useComposeForm.ts`, add state:

```tsx
const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
```

Update the auto-save interval (lines 250-256):

```tsx
void saveDraftRef.current().then((savedId) => {
  isSavingRef.current = false;
  if (savedId !== undefined) {
    setLastAutoSaved(new Date());
    setAutoSaveError(null);
  } else {
    setAutoSaveError('Auto-save failed. Check your connection.');
  }
});
```

Add `autoSaveError` to the return object:

```tsx
return {
  form,
  isLoading: isEdit ? isLoading : false,
  isSaving,
  saveDraft,
  isDirty: form.formState.isDirty,
  isEdit,
  notificationId,
  lastAutoSaved,
  autoSaveError,
};
```

Update `UseComposeFormReturn` interface:

```tsx
export interface UseComposeFormReturn {
  form: UseFormReturn<ComposeFormValues>;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: () => Promise<string | undefined>;
  isDirty: boolean;
  isEdit: boolean;
  notificationId: string | null;
  lastAutoSaved: Date | null;
  autoSaveError: string | null;
}
```

**Step 2: Show the error in ComposePanel**

In `ComposePanel.tsx`, destructure `autoSaveError` from `useComposeForm`:

```tsx
const { form, isLoading, isSaving, saveDraft, isDirty, isEdit, notificationId, lastAutoSaved, autoSaveError } =
  useComposeForm({ editId, onSaved: undefined, initialValues });
```

Add a MessageBar above the ActionBar (before line 287):

```tsx
{autoSaveError && (
  <MessageBar intent="warning" style={{ flexShrink: 0 }}>
    <MessageBarBody>{autoSaveError}</MessageBarBody>
  </MessageBar>
)}
```

Add `MessageBar` and `MessageBarBody` to the Fluent import.

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(ui): surface auto-save errors in ComposePanel"
```

---

### Task 19: Swap discard dialog button hierarchy

In `ComposePanel.tsx`, the discard-changes dialog has "Discard" as `appearance="primary"` (blue) — this makes the destructive action visually dominant. Fix: make "Keep editing" primary and "Discard" secondary.

**Files:**
- Modify: `components/ComposePanel/ComposePanel.tsx`

**Step 1: Swap button appearances**

Change lines 322-336:

```tsx
<DialogActions>
  <Button
    appearance="primary"
    onClick={() => { setShowDiscardDialog(false); }}
  >
    Keep editing
  </Button>
  <Button
    appearance="secondary"
    onClick={() => {
      setShowDiscardDialog(false);
      onClose();
    }}
  >
    Discard
  </Button>
</DialogActions>
```

**Step 2: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx
git commit -m "fix(ui): make Keep Editing primary, Discard secondary in dialog"
```

---

### Task 20: Add tooltip to disabled Review button

When the Review button is disabled (no audience or no headline), there's no visible explanation why.

**Files:**
- Modify: `components/ComposePanel/ActionBar.tsx`

**Step 1: Add Tooltip import**

Add `Tooltip` to the Fluent import:

```tsx
import { ..., Tooltip } from '@fluentui/react-components';
```

**Step 2: Wrap the Review button in a Tooltip**

Replace the Review button (lines 489-498):

```tsx
<Tooltip
  content={
    !headline?.trim()
      ? 'Add a headline to continue'
      : !hasAudience
        ? 'Select an audience to continue'
        : ''
  }
  relationship="description"
  visible={(!headline?.trim() || !hasAudience) ? undefined : false}
>
  <Button
    appearance="primary"
    size="small"
    icon={<ChevronRightRegular />}
    iconPosition="after"
    disabled={!hasAudience || !headline?.trim()}
    onClick={onReview}
  >
    Review
  </Button>
</Tooltip>
```

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx
git commit -m "fix(ui): add tooltip explaining why Review button is disabled"
```

---

### Task 21: Fix mergeClasses in Sidebar and BlockEditor

Both `Sidebar.tsx` (line 152) and `BlockEditor.tsx` (line 282) concatenate CSS class names using template literals instead of Fluent's `mergeClasses()`. With Griffel's atomic CSS, string concatenation can cause style ordering issues.

**Files:**
- Modify: `components/Sidebar/Sidebar.tsx`
- Modify: `components/ComposePanel/BlockEditor.tsx`

**Step 1: Fix Sidebar NavItem**

In `Sidebar.tsx`, add `mergeClasses` to the Fluent import:

```tsx
import { makeStyles, tokens, Button, CounterBadge, Text, mergeClasses } from '@fluentui/react-components';
```

Replace line 152:

```tsx
className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
```

with:

```tsx
className={mergeClasses(styles.navItem, isActive ? styles.navItemActive : undefined)}
```

Replace line 160:

```tsx
className={isActive ? `${styles.navItemLabel} ${styles.navItemLabelActive}` : styles.navItemLabel}
```

with:

```tsx
className={mergeClasses(styles.navItemLabel, isActive ? styles.navItemLabelActive : undefined)}
```

**Step 2: Fix BlockEditor block card**

In `BlockEditor.tsx`, add `mergeClasses` to the Fluent import (it may already be imported — check first).

Replace line 282:

```tsx
className={`${styles.blockCard}${isDragging ? ` ${styles.blockCardDragging}` : ''}${isDragOver ? ` ${styles.blockCardDragOver}` : ''}`}
```

with:

```tsx
className={mergeClasses(
  styles.blockCard,
  isDragging ? styles.blockCardDragging : undefined,
  isDragOver ? styles.blockCardDragOver : undefined,
)}
```

Add `mergeClasses` to the Fluent import if not already present.

**Step 3: Build and verify**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(ui): use mergeClasses instead of string concatenation for Griffel styles"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-5 | Functional breakage (window.confirm, dead code, GUIDs, 401s) |
| 2 | 6-10 | Accessibility (focus trap, ARIA, reduced motion, headings) |
| 3 | 11-15 | Performance (watch(), useCallback, memo, lazy-load, deferred) |
| 4 | 16-21 | UX polish (time picker, auto-save errors, tooltips, button swap) |

**Total: 21 tasks, ~21 commits**

Build command for all verification: `cd src/CompanyCommunicator.Api/ClientApp && npx vite build`
