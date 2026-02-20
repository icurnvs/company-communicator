# Author Dashboard Redesign — Session Handoff

**Date:** 2026-02-19 (updated after session 5 — ALL 19 TASKS COMPLETE)
**Purpose:** Context handoff for continuing implementation in a fresh context window.

---

## What's Done (19 of 19 tasks complete + code review fixes)

### Backend (Tasks 1-4) — ALL DONE + CODE REVIEWED

| Commit | Task | What |
|--------|------|------|
| `441beee` | 1 | Added 5 new Notification columns (KeyDetails, SecondaryText, CustomVariables, AdvancedBlocks, CardPreference) + Template entity + EF migration `20260220015259_AddCardBuilderFields` |
| `bd69c6c` | 2 | Updated all DTOs (Create/Update request, NotificationDto, SummaryDto), added Template DTOs, updated NotificationMappingExtensions, updated InputValidator with JSON validation |
| `116dd67` | 3 | Created TemplatesController with full CRUD (GET list/detail, POST, PUT, DELETE) with ownership checks and Author policy |
| `a76f758` | 4 | Updated AdaptiveCardService: FactSet from KeyDetails, SecondaryText rendering, AdvancedBlocks conversion, ResolveCustomVariables + ResolveRecipientVariables methods |
| `6b5d8af` | Review fixes | C1: JsonDocument dispose in TemplatesController. C3: JSON-escape variable values in ReplaceVariables. M1: Template Description 500-char limit. M2: ImageLink/ButtonLink 1000-char limit. M4: JSON field size limits (50K/100K). M6: HTTPS-only URL validation in advanced blocks. |

### Frontend Foundation (Tasks 5, 6, 17) — ALL DONE

| Commit | Task | What |
|--------|------|------|
| `c6a2ce4` | 5 | Added all new TS types (KeyDetailPair, CustomVariable, AdvancedBlock, CardSchema, Template types), updated NotificationDto/SummaryDto, created template API hooks (useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate), redesigned Zod form schema (composeFormSchema with headline, keyDetails, secondaryText, customVariables, advancedBlocks) |
| `20a3c4e` | 6 | Created CommunicationCenter 3-zone grid layout + Sidebar with Compose button, Sent/Drafts/Scheduled nav with live count badges. Updated App.tsx routing. |
| `78c2433` | 17 | Updated adaptiveCard.ts: buildCardPayload handles keyDetails→FactSet, advancedBlocks, secondaryText. Added resolvePreviewVariables for live variable preview. |

### Frontend UI Zones (Tasks 7, 8, 9) — ALL DONE

| Commit | Task | What |
|--------|------|------|
| `a18b7b9` | 7 | MessageList: colored avatars (djb2 hash → 10 palette colors), title+snippet+relative date, status badges (green/blue-pulse/amber/gray/red), 2px animated progress bar for sending, search with 300ms debounce, pagination, keyboard accessibility |
| `03f51d2` | 8 | DetailPanel: 2x2 stats grid (Delivered/Failed/Pending/Total), ProgressBar with %, audience chips (Channel Posts vs Individual), timestamps, Cancel (with Dialog confirm), Export, Edit, Use as template actions, error message bar, live polling |
| `e5046a5` | 9 | ComposePanel slide-over shell (rAF animation, overlay, Escape key, dirty-check), ContentTab (60/40 split form+preview, progressive disclosure for Key Details and Secondary Text, useFieldArray, image thumbnail, char counts), useComposeForm hook (react-hook-form + Zod, create/edit mode, JSON field parsing, saveDraft) |
| `b9a5b98` | wiring | Replaced all CommunicationCenter placeholders with actual components, added handleCloneToCompose |

### Frontend Compose Features (Tasks 10, 11, 12) — ALL DONE

| Commit | Task | What |
|--------|------|------|
| `180e2bb` | 10 | TemplatePicker: 5 built-in templates (Announcement, Event Invite, Urgent Alert, Link Share, Survey) + custom templates from API. Grid (auto-fill, minmax 140px), Blank card first, divider before custom, delete on custom, confirm-before-overwrite, collapsible (expanded on new, collapsed on edit). Files: `lib/builtinTemplates.ts`, `ComposePanel/TemplatePicker.tsx`. ContentTab accepts `isEdit` prop. |
| `4bffd04` | 11 | AudienceTab: two-column layout (50/50). Left: "Send to everyone" Switch, Teams search Combobox + Groups search Combobox (both 300ms debounce, loading spinner). Right: Channel Posts section (team chips with "· General", "Send to members instead"), Individual Messages section (teams + groups, "Send to channel instead" for teams), Recently Used from localStorage (`cc-recent-audiences`, max 10), Summary card (audience count + estimated reach). Delivery mode mapping: Team→channel, Roster→individual, Group→individual. |
| `a764801` | 12 | ActionBar: Left = audience summary chips + reach text. Right = Save Draft (MenuButton with "Save as Template" in menu → Dialog for name/description), Send Preview (subtle, edit-mode only), Schedule (Popover with DatePicker), Review (primary). Auto-save added to useComposeForm: 30s interval, dirty + headline check, lastAutoSaved timestamp with 3s fade indicator. useComposeForm now returns `lastAutoSaved` and `notificationId`. |

### Frontend Variables, Advanced Mode, Confirm+Tracker (Tasks 13, 14, 15, 16) — ALL DONE

| Commit | Task | What |
|--------|------|------|
| `b8bb4f6` | 13 | Dynamic Variables: `lib/variables.ts` (5 recipient vars with samples, `insertVariableAtCursor`, `allAudiencesAreChannelPosts`), `VariableInsert.tsx` (dropdown menu: recipient section + custom section + inline add, disabled for channel-only audiences), `CustomVariablesPanel.tsx` (collapsible, name+value rows, useFieldArray). Integrated into ContentTab Body toolbar. |
| `6a18ee7` | 14 | Advanced Mode: `BlockEditor.tsx` (6 block types, native drag-and-drop reorder, Add Block menu), `blocks/` directory (ColumnBlock, ImageSetBlock, TextBlockBlock, TableBlock, ActionButtonBlock, DividerBlock, index barrel). Standard/Advanced Switch in ContentTab with localStorage persistence (`cc-card-preference`). Integrated below standard fields when Advanced mode is on. |
| `93152bb` | 15+16 | ConfirmSendDialog: review phase (card preview, audience chips by type, estimated reach box, Confirm & Send button). DeliveryTracker: SVG progress ring with percentage, 3 counters (Delivered/Failed/Remaining), status label transitions (Queued→Syncing→Installing→Sending→Delivered/Failed), 10s polling via `useDeliveryStatus`, Done button. ComposePanel manages `showConfirmDialog` state, `onReview` prop on ActionBar. CommunicationCenter passes `onDeliveryDone` to navigate to Sent tab. |

### Task 18: Frontend — Polish, Integration, and Cleanup — DONE

| Commit | What |
|--------|------|
| `18245ad` | Wire handleCloneToCompose with initialValues, delete old components (NotificationList, NotificationForm, AudiencePicker, AppLayout), minor cleanup |
| `676ec59` | Code review fixes: i18n key corrections, auto-save timer fix, shared audienceUtils, perf optimization, deduped helpers |

### Task 19: Backend — Dynamic Variable Resolution — DONE

| Commit | What |
|--------|------|
| `1382431` | Custom vars resolved in StoreCardActivity, recipient vars resolved per-user in SendMessageFunction via Graph profile |

---

## Key Architecture Decisions Already Made

1. **CommunicationCenter** manages all state (selectedTab, selectedMessageId, composeOpen, composeEditId) and passes actions to children
2. **Sidebar** uses `useNotifications({page:1, pageSize:1})` per tab to get counts
3. **Compose is state-driven** (not route-driven) — slide-over inside CommunicationCenter
4. **All styling uses Fluent UI v9 tokens** — no hardcoded colors (supports light/dark/high-contrast via FluentProvider)
5. **Form schema renamed**: `title` → `headline`, `summary` → `body` in the compose form. The API still uses `title`/`summary` — `formValuesToCreateRequest` maps between them.
6. **JSON fields** (keyDetails, customVariables, advancedBlocks) are stored as JSON strings in the API but as typed objects in the form state
7. **Auto-save**: 30s interval in useComposeForm, checks dirty + headline present, first save creates draft (POST), subsequent saves update (PUT)
8. **ConfirmSendDialog** manages `'review' | 'sending'` phase internally. ComposePanel owns the `showConfirmDialog` boolean. DeliveryTracker polls via `useDeliveryStatus`.
9. **ActionBar** receives `onReview` callback from ComposePanel to open the confirm dialog.
10. **ComposePanel** accepts optional `onDeliveryDone` callback; CommunicationCenter uses it to close compose + navigate to Sent tab.

## Wired Component Props (current)

- **MessageList:** `activeTab, selectedMessageId, onSelectMessage, onOpenCompose`
- **DetailPanel:** `notificationId, onClose, onEdit, onCloneToCompose`
- **ComposePanel:** `editId, onClose, onDeliveryDone`
- **ContentTab:** `form` (UseFormReturn<ComposeFormValues>), `isEdit?: boolean`
- **TemplatePicker:** `form, defaultCollapsed?: boolean`
- **AudienceTab:** `form` (UseFormReturn<ComposeFormValues>)
- **ActionBar:** `formValues, isSaving, isEdit, notificationId, lastAutoSaved, onSaveDraft, onReview`
- **ConfirmSendDialog:** `formValues, notificationId, onSaveDraft, onConfirmSend, onClose, onDeliveryDone`
- **DeliveryTracker:** `notificationId, onDone`
- **VariableInsert:** `textareaRef, allUsers, audiences, customVariables, onAddCustomVariable`
- **CustomVariablesPanel:** `form`
- **BlockEditor:** `form`
- **useComposeForm:** `{ editId, onSaved }` → returns `{ form, isLoading, isSaving, saveDraft, isDirty, isEdit, notificationId, lastAutoSaved }`

---

## Key Files Reference

### Backend
- Entity: `src/CompanyCommunicator.Core/Data/Entities/Notification.cs` (5 new fields)
- Entity: `src/CompanyCommunicator.Core/Data/Entities/Template.cs`
- DTOs: `src/CompanyCommunicator.Core/Models/` (all updated)
- Controller: `src/CompanyCommunicator.Api/Controllers/TemplatesController.cs`
- Controller: `src/CompanyCommunicator.Api/Controllers/NotificationsController.cs` (updated)
- Card service: `src/CompanyCommunicator.Core/Services/Cards/AdaptiveCardService.cs` (has ResolveCustomVariables + ResolveRecipientVariables)
- Card interface: `src/CompanyCommunicator.Core/Services/Cards/IAdaptiveCardService.cs`
- Mapping: `src/CompanyCommunicator.Api/Extensions/NotificationMappingExtensions.cs` (updated)
- Validation: `src/CompanyCommunicator.Api/Validation/InputValidator.cs` (updated)
- Prep: `src/CompanyCommunicator.Functions.Prep/Activities/StoreCardActivity.cs` (Task 19 target)
- Send: `src/CompanyCommunicator.Functions.Send/SendMessageFunction.cs` (Task 19 target)

### Frontend
- Types: `src/CompanyCommunicator.Api/ClientApp/src/types/index.ts`
- API hooks: `src/CompanyCommunicator.Api/ClientApp/src/api/notifications.ts`, `templates.ts`, `teams.ts`, `groups.ts`
- Query keys: `src/CompanyCommunicator.Api/ClientApp/src/api/queryKeys.ts`
- Validators: `src/CompanyCommunicator.Api/ClientApp/src/lib/validators.ts` (composeFormSchema)
- Card builder: `src/CompanyCommunicator.Api/ClientApp/src/lib/adaptiveCard.ts`
- Variables: `src/CompanyCommunicator.Api/ClientApp/src/lib/variables.ts`
- Built-in templates: `src/CompanyCommunicator.Api/ClientApp/src/lib/builtinTemplates.ts`
- Layout: `src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx`
- Sidebar: `src/CompanyCommunicator.Api/ClientApp/src/components/Sidebar/Sidebar.tsx`
- MessageList: `src/CompanyCommunicator.Api/ClientApp/src/components/MessageList/MessageList.tsx`
- DetailPanel: `src/CompanyCommunicator.Api/ClientApp/src/components/DetailPanel/DetailPanel.tsx`
- ComposePanel: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`
- ContentTab: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`
- TemplatePicker: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx`
- AudienceTab: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/AudienceTab.tsx`
- ActionBar: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx`
- ConfirmSendDialog: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`
- DeliveryTracker: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/DeliveryTracker.tsx`
- VariableInsert: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/VariableInsert.tsx`
- CustomVariablesPanel: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/CustomVariablesPanel.tsx`
- BlockEditor: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/BlockEditor.tsx`
- Block components: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/blocks/` (6 files + index.ts)
- useComposeForm: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/useComposeForm.ts`
- Routing: `src/CompanyCommunicator.Api/ClientApp/src/App.tsx`
- i18n: `src/CompanyCommunicator.Api/ClientApp/src/i18n/en-US.json` (NOT YET UPDATED — Task 18)

### Design Reference
- Implementation plan: `docs/plans/2026-02-19-author-dashboard-impl-plan.md`
- Visual prototype: `docs/designs/unified-prototype.html` (open in browser)

---

## Build Verification

Both backend and frontend compile cleanly as of latest commits:
- `cd src/CompanyCommunicator.Api && dotnet build` — 0 errors, 0 warnings
- `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit` — 0 errors
