# Frontend Architecture Review - Company Communicator Clean-Room Rebuild

**Reviewer:** React Specialist
**Date:** 2026-02-17
**Scope:** Proposed React 19 + Vite + TanStack Query + Fluent UI v9 frontend for the clean-room rebuild

---

## Executive Summary

The proposed frontend stack is a large improvement over the original in every measurable dimension. The state management simplification from Redux to TanStack Query is the correct call. The component decomposition plan is sensible but requires one structural clarification before implementation begins. There are four concerns that need resolution before Phase 5 starts, one of which (the MSAL/Teams SDK auth boundary) is rated HIGH and must be designed explicitly before any code is written.

---

## 1. Approved Decisions

### Redux Elimination - Fully Justified

The original Redux implementation was not managing application state in any meaningful sense. Examining `messagesSlice.ts` reveals every slice key wraps its value in `{ action: string; payload: T }`, a pattern that makes RTK fight itself: the `action` string inside the payload mirrors what the action type already encodes, and every consumer must reach through `.payload` twice (e.g., `state.messages.sentMessages.payload`). The `actions.ts` file is effectively a hand-written fetch layer that dispatches results back to slices - a verbose reimplementation of what TanStack Query provides as a first-class feature.

Auditing what the store actually holds confirms there is no genuine client-side state that requires Redux:

| Slice key | What it actually is |
|-----------|---------------------|
| `draftMessages` | Server fetch result |
| `sentMessages` | Server fetch result with polling |
| `scheduledMessages` | Server fetch result |
| `teamsData` | Reference data fetch result |
| `groups` / `queryGroups` | Search results |
| `verifyGroup` | Auth check result |
| `isDraftMessagesFetchOn` | Loading flag (TanStack replaces with `isLoading`) |
| `hostClientType` | Teams SDK context value - genuinely client-side |

The only value that is not server-derived is `hostClientType`, which belongs in a `useTeamsContext` hook's return value, not a Redux store. Dropping Redux and its associated boilerplate is the right call. TanStack Query 5.x handles every case this app needs: background refetch, polling, optimistic updates, stale-while-revalidate, and cache invalidation on mutation.

### React 19 + Vite 6 + TypeScript 5.x

The original stack (CRA + TypeScript 3.9.7) had no viable incremental upgrade path. TypeScript 3.9 predates template literal types, `infer` in conditional types, and satisfies. Vite 6 is the right build tool: sub-second HMR for a project of this scope, native ESM, and no webpack configuration debt. React 19 is stable (released December 2024) and the app's feature set does not require any patterns that have changed from React 18 in ways that break libraries.

### TanStack Query 5.x Patterns Chosen

Polling via `refetchInterval` for sent notification status is appropriate. The status lifecycle (Queued -> Sending -> Sent/Failed/Canceled) means a notification only needs active polling while its status is not terminal. TanStack Query's `refetchInterval` as a function that receives the current data makes this clean:

```typescript
// api/notifications.ts
export function useNotificationStatus(id: string) {
  return useQuery({
    queryKey: ['notifications', id, 'status'],
    queryFn: () => fetchNotificationStatus(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const terminal = ['Sent', 'Failed', 'Canceled'];
      return terminal.includes(status ?? '') ? false : 5000;
    },
  });
}
```

This is far cleaner than the original `useInterval` hook with a fixed 60-second delay that fires regardless of whether the notification has completed.

### Fluent UI v9 as the Sole UI Library

Eliminating the dual v8/v9 installation is a clear win. The original `newMessage.tsx` imports both `@fluentui/react` (v8) for `DatePicker` and `TimePicker` and `@fluentui/react-components` (v9) for everything else, making `initializeIcons()` a required side effect call and doubling the bundle's Fluent UI footprint. Fluent UI v9 has a native `DatePicker` in `@fluentui/react-datepicker-compat` and a `TimePicker` equivalent. For the date/time scheduling field specifically, the rebuild should use `@fluentui/react-datepicker-compat` (which is a v9-compatible wrapper) until v9 ships a fully native DateTimePicker, then migrate. This is preferable to pulling v8 back in.

### date-fns Over Moment.js

Correct. Moment.js is maintenance-only, not tree-shakeable, and adds ~72KB to the bundle. date-fns 4.x is tree-shakeable and TypeScript-native.

### Zod for Validation

Correct. The original `newMessage.tsx` does validation inline with a mix of `validator` library calls and manual string checks scattered across 15+ event handlers. Centralizing validation in Zod schemas defined in `lib/validators.ts` is the right pattern, especially when paired with a form library.

### react-router-dom v7

Correct. v7 is the current stable release and a natural continuation of the v6 API surface the original app already uses (`useParams`, `useNavigate`).

---

## 2. Concerns

### CONCERN 1 - HIGH: The MSAL + Teams JS SDK Auth Boundary is Not Defined

**This is the most important issue in the proposed architecture and must be resolved before writing any auth code.**

The original app uses Teams SDK `authentication.authenticate()` to open a consent popup that redirects through `signInSimpleStart` and `signInSimpleEnd` pages. This works because the app was registered as multi-tenant with OAuth2 implicit flow. The rebuild switches to MSAL + auth code flow + PKCE, which is the correct long-term approach. However, the MSAL React + Teams JS SDK interaction has a specific initialization ordering constraint that is not addressed in the proposed structure.

**The problem:** `@azure/msal-browser`'s `PublicClientApplication` attempts to process the authorization code response from the URL hash/query string during initialization. In a Teams tab, the app loads inside an iframe. MSAL's redirect flow does not work inside an iframe because the browser blocks cross-origin navigation in iframes for redirect URIs. The `acquireTokenSilent` path using the hidden iframe also fails in Teams because Teams suppresses the hidden iframe mechanism.

**The correct pattern for Teams + MSAL is:**

1. Use `@azure/msal-browser`'s `acquireTokenSilent` with the Teams SSO token as a bootstrap via `ssoSilent` / `loginHint` approach, or
2. Use Teams JS SDK's `authentication.getAuthToken()` (which invokes SSO via the Teams-managed token exchange) and then use that token as an OBO (On-Behalf-Of) flow credential on the backend, bypassing MSAL React on the frontend entirely for the primary token acquisition path.

The two approaches are not equivalent and the choice affects every layer:

**Option A - Teams SSO + OBO (Recommended for this app):**
- Frontend calls `app.authentication.getAuthToken()` from Teams JS SDK
- Sends that token to the backend API as `Authorization: Bearer <teams-sso-token>`
- Backend validates it and exchanges it for a Graph token via OBO grant
- Frontend never does interactive login - Teams SSO covers it
- MSAL is not needed on the frontend at all; remove `@azure/msal-browser` and `@azure/msal-react`
- Simpler, fewer moving parts, no redirect URI configuration edge cases

**Option B - MSAL React with popup (not redirect):**
- Use `msalInstance.acquireTokenPopup()` instead of redirect flow
- Teams allows popups when `isExternal: true` is set via `dialog.url.open()`
- `acquireTokenSilent` works when refresh token is cached in `sessionStorage`
- MSAL handles the full OIDC flow independently of Teams SDK
- Risk: silent renewal still needs the hidden iframe or refresh token; in some Teams clients the hidden iframe is blocked

**The proposed architecture says "MSAL React wraps the app, acquires token silently, injects into API calls" without specifying which of these paths is taken.** The `useAuth.ts` hook and `client.ts` API client are the two most critical files in the project, and they cannot be written until this boundary is defined.

**Recommendation:** For a Teams-exclusive tab app (which this is), Option A is the correct choice. The Teams client guarantees SSO when the app registration's Application ID URI is set as an authorized scope in the Teams manifest. This eliminates all redirect/popup complexity, removes two npm packages, and gives a zero-login-prompt experience. The `useAuth.ts` hook becomes a thin wrapper around `app.authentication.getAuthToken()`.

If Graph access is needed directly from the frontend (it is not - all Graph calls go through the backend in this architecture), then revisit. For an app where all data flows through a backend REST API, Teams SSO + backend OBO is strictly simpler.

---

### CONCERN 2 - HIGH: No Form State Management Strategy Defined

The original `newMessage.tsx` is 1,199 lines because it is doing three things simultaneously: form state management (20+ `useState` calls), Adaptive Card preview rendering (direct DOM manipulation), and audience selection logic. The proposed decomposition separates these into `NotificationForm/` and `AudiencePicker/` components, which is correct. But the proposed stack does not include a form library, and the form in this app is non-trivial.

The notification form has:
- 7 text/URL fields with different validation rules
- A 2-step wizard flow (content step, then audience step)
- File upload with resize/validation logic
- Date + time picker combination for scheduling
- Conditional rendering based on audience type selection
- Zod validation that must run both on field blur and on submit
- Draft auto-save behavior (implied by the "Save as Draft" action)

Managing all of this with raw `useState` + Zod will reproduce the original's 20+ state variables. The proposed architecture lists Zod but not React Hook Form. React Hook Form (RHF) with Zod resolver handles this entire surface area with minimal re-renders (uncontrolled inputs by default), integrates directly with Fluent UI v9's controlled components via `Controller`, and keeps validation co-located with field definitions rather than spread across event handlers.

**Recommended addition:**
```json
"@hookform/resolvers": "^3.x",
"react-hook-form": "^7.x"
```

This is not optional for a form this complex. Without it, `NotificationForm/` will re-implement RHF poorly.

The Zod schema in `lib/validators.ts` for the notification form should be defined early and used as the single source of truth for both TypeScript types and validation rules:

```typescript
// lib/validators.ts
export const notificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  summary: z.string().max(5000).optional(),
  imageLink: z.string().url().optional().or(z.literal('')),
  author: z.string().max(200).optional(),
  buttonTitle: z.string().max(200).optional(),
  buttonLink: z.string().url({ message: 'Must be a valid HTTPS URL' }).optional().or(z.literal('')),
  audience: z.discriminatedUnion('type', [
    z.object({ type: z.literal('Teams'), teamIds: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('Rosters'), teamIds: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('Groups'), groupIds: z.array(z.string()).min(1) }),
    z.object({ type: z.literal('AllUsers') }),
  ]),
  schedule: z.object({
    enabled: z.boolean(),
    scheduledDate: z.string().datetime().optional(),
  }).refine(
    (s) => !s.enabled || (s.scheduledDate && new Date(s.scheduledDate) > new Date()),
    { message: 'Scheduled date must be in the future', path: ['scheduledDate'] }
  ),
});

export type NotificationFormData = z.infer<typeof notificationSchema>;
```

The `audience` field using `z.discriminatedUnion` eliminates the original's implicit coupling between `selectedRadioButton` and which array field is populated.

---

### CONCERN 3 - MEDIUM: Adaptive Card Preview Uses Direct DOM Manipulation - Needs Isolation

The original `newMessage.tsx` and `viewStatusTask.tsx` both render the Adaptive Card by calling `document.getElementsByClassName('card-area-1')[0].innerHTML = ''` followed by `appendChild(renderCard)`. This is a direct DOM write outside React's control. In React 18 this worked but was fragile. In React 19, where the renderer has stricter hydration guarantees and concurrent rendering can interrupt work mid-render, this pattern is actively dangerous: the DOM node can be mutated while React has a pending update referencing its fiber.

The correct pattern in React 19 is to isolate the Adaptive Card render in a `useEffect` with a stable ref:

```typescript
// components/AdaptiveCardPreview/AdaptiveCardPreview.tsx
import { useEffect, useRef } from 'react';
import * as AdaptiveCards from 'adaptivecards';

interface AdaptiveCardPreviewProps {
  cardPayload: object;
  onAction?: (url: string) => void;
}

export function AdaptiveCardPreview({ cardPayload, onAction }: AdaptiveCardPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.parse(cardPayload);

    if (onAction) {
      adaptiveCard.onExecuteAction = (action) => {
        if (action instanceof AdaptiveCards.OpenUrlAction) {
          onAction(action.url);
        }
      };
    }

    const rendered = adaptiveCard.render();
    const container = containerRef.current;
    container.innerHTML = '';
    if (rendered) container.appendChild(rendered);

    return () => {
      container.innerHTML = '';
    };
  }, [cardPayload, onAction]);

  return <div ref={containerRef} className="adaptive-card-container" />;
}
```

The `AdaptiveCardPreview` component listed in the proposed structure needs this implementation pattern documented as a constraint. It should not be implemented by direct DOM query.

Additionally, the live preview as the user types is an expensive operation. The Adaptive Card SDK parses and renders on every keystroke if wired directly to form `onChange`. Use `useDeferredValue` to keep the form input responsive while the card preview updates at lower priority:

```typescript
// Inside NotificationForm
const deferredCardPayload = useDeferredValue(cardPayload);
// Pass deferredCardPayload to <AdaptiveCardPreview /> not cardPayload
```

---

### CONCERN 4 - MEDIUM: TanStack Query Key Structure and Cache Invalidation Strategy Not Defined

The proposed `api/` directory lists hooks but does not define the query key factory pattern. Without a defined key structure, cache invalidation after mutations becomes inconsistent as the codebase grows. The original app's equivalent of cache invalidation was dispatching `GetDraftMessagesSilentAction` after every save/delete - manually wiring the refetch in each action function. TanStack replaces this, but only if the keys are consistent.

**Recommended query key factory to establish upfront:**

```typescript
// api/queryKeys.ts
export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: { status?: NotificationStatus }) =>
      [...queryKeys.notifications.lists(), filters] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notifications.details(), id] as const,
    status: (id: string) =>
      [...queryKeys.notifications.detail(id), 'status'] as const,
  },
  teams: {
    all: ['teams'] as const,
    list: () => [...queryKeys.teams.all, 'list'] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: () => [...queryKeys.groups.all, 'list'] as const,
    search: (query: string) => [...queryKeys.groups.all, 'search', query] as const,
  },
  exports: {
    all: ['exports'] as const,
    detail: (notificationId: string) =>
      [...queryKeys.exports.all, notificationId] as const,
  },
} as const;
```

With this factory, invalidating all notification lists after a draft is saved is `queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })`, which correctly targets drafts, sent, and scheduled lists without knowing their individual filters.

**Missing pattern - optimistic updates for draft save:**

The proposed architecture mentions optimistic updates as a TanStack feature but does not describe where they apply. The notification form's "Save as Draft" action is the natural candidate. The user clicks save, sees the draft appear immediately in the list, and the mutation runs in the background. If it fails, the UI reverts. This is straightforward with TanStack's `onMutate`/`onError`/`onSettled` pattern and should be planned for `useCreateDraft` and `useUpdateDraft`.

**Missing pattern - export polling:**

The `ExportManager` component needs to poll export job status after an export is triggered. The export job goes through Queued -> InProgress -> Completed/Failed on the backend (via a Durable Function). The `refetchInterval` as function pattern described for notification status applies here too. The `useExports` hook in `api/exports.ts` needs an `exportJobStatus` query with a terminating refetch interval, not just a one-shot mutation.

---

### CONCERN 5 - LOW: Teams Dialog vs. Route-Based Navigation

The original app opens `NewMessage`, `SendConfirmationTask`, `ViewStatusTask`, and `DeleteConfirmationTask` as Teams task module dialogs using `dialog.url.open()` with separate routes. This means each dialog is a full page render with its own route, its own Teams SDK initialization, and its own auth check. The submit handler (`dialog.url.submit()`) signals the parent frame to refresh.

The proposed structure has `NotificationForm/` and `StatusView/` as components under `components/`, and the `App.tsx` route list is not shown. The question is whether these continue to be separate routed pages opened as Teams dialogs, or whether they become in-page panels/dialogs managed within the SPA.

**Recommendation:** Keep the Teams dialog pattern for `NotificationForm` (new/edit) and `StatusView`. Opening them as Teams dialogs gives the user the correct "task module" UX that matches Teams design patterns, and the dialog opener/submitHandler model provides clean cross-frame communication. Making them in-page panels would require a custom drawer/panel component (Fluent UI v9 has `Drawer`) and manual state management for what is currently handled by `dialog.url.submit()`.

The routes list in `App.tsx` should explicitly include:
- `/messages` - HomePage (main tab frame)
- `/new-message` - NotificationForm (dialog frame, create mode)
- `/new-message/:id` - NotificationForm (dialog frame, edit mode)
- `/send-confirm/:id` - SendConfirmationDialog (dialog frame)
- `/view-status/:id` - StatusView (dialog frame)
- `/config` - Teams tab configuration page

Each dialog-frame route should detect whether it is running inside a dialog context and not render the main navigation shell.

---

## 3. Recommended Changes

### R1 - Define the Auth Pattern Before Writing Any Code (addresses CONCERN 1)

Add a `hooks/useTeamsAuth.ts` hook as the single auth entry point. For the Teams-SSO-via-backend-OBO approach:

```typescript
// hooks/useTeamsAuth.ts
import { useCallback, useEffect, useState } from 'react';
import { app, authentication } from '@microsoft/teams-js';

interface AuthState {
  token: string | null;
  error: string | null;
  isReady: boolean;
}

export function useTeamsAuth(): AuthState & { refreshToken: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    token: null,
    error: null,
    isReady: false,
  });

  const acquireToken = useCallback(async () => {
    try {
      const token = await authentication.getAuthToken();
      setState({ token, error: null, isReady: true });
    } catch (err) {
      setState({ token: null, error: String(err), isReady: true });
    }
  }, []);

  useEffect(() => {
    void acquireToken();
  }, [acquireToken]);

  return { ...state, refreshToken: acquireToken };
}
```

The `api/client.ts` then uses this token:

```typescript
// api/client.ts
export function createApiClient(getToken: () => string | null) {
  const client = axios.create({ baseURL: '/api' });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Intercept 401 to refresh token and retry once
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401 && !error.config?._retried) {
        error.config._retried = true;
        // signal hook to refresh, then retry
      }
      return Promise.reject(error);
    }
  );

  return client;
}
```

Remove `@azure/msal-browser` and `@azure/msal-react` from the package list entirely if going with Teams SSO. If the decision is made to keep MSAL (for future non-Teams usage), document that `acquireTokenPopup` is used and that `MsalProvider` wraps the app before `FluentProvider`.

---

### R2 - Add React Hook Form to the Stack (addresses CONCERN 2)

Add to the stack table:

| Component | Package | Version |
|-----------|---------|---------|
| Form management | react-hook-form | 7.x |
| Form + Zod bridge | @hookform/resolvers | 3.x |

Decompose `NotificationForm/` into:

```
components/NotificationForm/
├── NotificationForm.tsx          # RHF FormProvider, wizard state, submit handler
├── ContentStep.tsx               # Title, summary, image, author, button fields
├── AudienceStep.tsx              # Radio group + conditional pickers (delegates to AudiencePicker)
├── ScheduleStep.tsx              # Checkbox + DatePicker + TimePicker
├── NotificationFormFooter.tsx    # Back/Next/Save/Schedule buttons with loading state
└── index.ts
```

`AudiencePicker/` remains a separate component directory since it is independently testable and reusable (also needed in any "edit draft" flow initiated from the list view).

---

### R3 - Add Query Key Factory to api/ (addresses CONCERN 4)

Add `api/queryKeys.ts` as defined above. All hooks in `api/notifications.ts`, `api/teams.ts`, etc., import from this factory. No query key string literals appear outside `queryKeys.ts`.

---

### R4 - Constrain AdaptiveCardPreview to ref-based Rendering (addresses CONCERN 3)

Add a note in the component design that `AdaptiveCardPreview` owns a single `ref` and manages the Adaptive Card SDK instance within a `useEffect`. No other component ever writes to a `.card-area-*` class by querying the DOM. The card payload passed as a prop should be a stable object (memoized at the call site with `useMemo`) to avoid re-rendering the card on every keystroke.

---

### R5 - Add Error Boundary Placement to the Component Map

The original app has no error boundaries (issue F-9 in the debt assessment). The rebuild's `Layout/` directory should define at minimum:

```
components/Layout/
├── AppShell.tsx                  # Main shell wrapper
├── AppErrorBoundary.tsx          # Top-level boundary - fallback to error page
├── SectionErrorBoundary.tsx      # Per-accordion-section boundary - isolates list failures
└── DialogErrorBoundary.tsx       # Per-dialog-frame boundary
```

The `SectionErrorBoundary` is important because draft, scheduled, and sent message lists load independently. A failure in the sent messages list should not crash the draft messages list. Wrapping each `AccordionPanel`'s content in its own error boundary achieves this isolation.

React 19 does not change the error boundary class component requirement (they are still class components), but React 19's `use()` hook and improved error propagation make it more important to have boundaries in the right places.

---

### R6 - Clarify the useTeamsContext Hook's Responsibility

The proposed `hooks/useTeamsContext.ts` should be the single location for all Teams SDK state. Its return contract should be defined explicitly so other hooks and components do not call `app.getContext()` directly (as the original `homePage.tsx` and `viewStatusTask.tsx` both do independently):

```typescript
// hooks/useTeamsContext.ts
export interface TeamsContext {
  isInitialized: boolean;
  theme: 'default' | 'dark' | 'contrast';
  locale: string;
  userPrincipalName: string | undefined;
  teamId: string | undefined;
  hostClientType: HostClientType | undefined;
  fluentTheme: Theme; // teamsLightTheme | teamsDarkTheme | teamsHighContrastTheme
  textDirection: 'ltr' | 'rtl';
}

export function useTeamsContext(): TeamsContext { ... }
```

The `App.tsx` calls `useTeamsContext()` and passes `fluentTheme` and `textDirection` to `FluentProvider`. No child component calls `app.getContext()` - they consume context from a `TeamsContextProvider` that wraps the router.

---

### R7 - Add React Query Devtools to Dev Build

This is a minor operational item. Add `@tanstack/react-query-devtools` as a dev dependency. In `main.tsx`, conditionally render `ReactQueryDevtools` when `import.meta.env.DEV`. This saves significant debugging time when investigating cache invalidation issues during development. The Vite config's tree-shaking will exclude it from production builds.

---

## 4. Final Stack Recommendation

Incorporating all changes above, the final recommended frontend stack is:

| Component | Package | Version | Change from Proposal |
|-----------|---------|---------|---------------------|
| React | react, react-dom | 19.x | No change |
| Build | vite | 6.x | No change |
| UI | @fluentui/react-components | 9.x | No change |
| UI date/time | @fluentui/react-datepicker-compat | latest | Added (v9-compatible DatePicker) |
| Data fetching | @tanstack/react-query | 5.x | No change |
| Query devtools | @tanstack/react-query-devtools | 5.x | Added (devDependency) |
| Routing | react-router-dom | 7.x | No change |
| Teams SDK | @microsoft/teams-js | 2.x | No change |
| Auth | ~~@azure/msal-browser, @azure/msal-react~~ | - | **Removed** - Teams SSO via `getAuthToken()` |
| Form | react-hook-form | 7.x | **Added** |
| Form + Zod | @hookform/resolvers | 3.x | **Added** |
| Adaptive Cards | adaptivecards | 3.x | No change |
| i18n | react-i18next, i18next | latest | No change |
| Validation | zod | 3.x | No change |
| Dates | date-fns | 4.x | No change |

---

## 5. Architecture Risks Not in Scope of This Review

These are noted for completeness but belong to backend or integration reviews:

- The backend must expose the OBO token exchange endpoint that accepts the Teams SSO token. This is a `NotificationsController` authorization middleware concern, not a frontend concern.
- The Teams manifest must declare the app's `webApplicationInfo` with the correct `id` and `resource` (Application ID URI) for SSO to function. This is a manifest configuration concern.
- The `adaptivecards` 3.x package serialization format must match what the backend's Adaptive Card builder produces. The card schema version should be pinned consistently in both the frontend template builder (`lib/adaptiveCard.ts`) and the backend card service.
