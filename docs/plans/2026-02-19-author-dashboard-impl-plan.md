# Author Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Company Communicator Author UI from a basic tabbed table + dialog compose into a polished Communication Center with a 3-column layout, slide-over card builder, intuitive audience picker, template system, dynamic variables, and confident send flow.

**Architecture:** The frontend is a complete UI overhaul — replacing the tab-based layout with a sidebar + message list + detail panel layout, and replacing the Teams dialog compose with a slide-over panel. The backend adds new Notification fields (KeyDetails, SecondaryText, CustomVariables, AdvancedBlocks), a Templates table, and a Templates API. The AdaptiveCardService is updated to render the richer card content.

**Tech Stack:** React 19, Fluent UI v9, TanStack Query 5, React Hook Form + Zod, Vite, .NET 8, EF Core 8, Azure SQL

**Design doc:** `docs/plans/2026-02-19-author-dashboard-redesign.md`

---

## Task 1: Backend — New Notification Fields + Template Table + EF Migration

**Goal:** Add database columns for the new card builder fields and a Templates table for custom templates.

**Files:**
- Modify: `src/CompanyCommunicator.Core/Data/Entities/Notification.cs`
- Create: `src/CompanyCommunicator.Core/Data/Entities/Template.cs`
- Modify: `src/CompanyCommunicator.Core/Data/AppDbContext.cs`
- Create: `src/CompanyCommunicator.Core/Data/Configurations/TemplateConfiguration.cs`
- Create: New EF migration (auto-generated)

**Step 1:** Add new columns to `Notification.cs`:

```csharp
/// <summary>JSON array of {Label, Value} pairs for the FactSet section.</summary>
[Column(TypeName = "nvarchar(max)")]
public string? KeyDetails { get; set; }

/// <summary>Optional fine-print / footnote text.</summary>
[MaxLength(2000)]
public string? SecondaryText { get; set; }

/// <summary>JSON dictionary of custom variable name → value (e.g. {"deadline":"March 15"}).</summary>
[Column(TypeName = "nvarchar(max)")]
public string? CustomVariables { get; set; }

/// <summary>JSON array of advanced block definitions for Advanced mode.</summary>
[Column(TypeName = "nvarchar(max)")]
public string? AdvancedBlocks { get; set; }

/// <summary>User's card builder mode preference: "Standard" or "Advanced".</summary>
[MaxLength(20)]
public string? CardPreference { get; set; }
```

**Step 2:** Create `Template.cs` entity:

```csharp
namespace CompanyCommunicator.Core.Data.Entities;

public sealed class Template
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>The structured card schema as JSON (same shape as the compose form state).</summary>
    [Required]
    [Column(TypeName = "nvarchar(max)")]
    public string CardSchema { get; set; } = "{}";

    /// <summary>AAD OID of the user who created this template.</summary>
    [Required, MaxLength(200)]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedDate { get; set; }
}
```

**Step 3:** Add `DbSet<Template>` to `AppDbContext.cs` and create `TemplateConfiguration.cs` with index on `CreatedBy`.

**Step 4:** Generate EF migration:

```bash
cd src/CompanyCommunicator.Api
dotnet ef migrations add AddCardBuilderFields --project ../CompanyCommunicator.Core
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat(db): add card builder fields to Notification + Template table"
```

---

## Task 2: Backend — Update DTOs, Request Models, Validation, Mapping

**Goal:** Expose the new Notification fields through the API and add Template DTOs.

**Files:**
- Modify: `src/CompanyCommunicator.Core/Models/CreateNotificationRequest.cs`
- Modify: `src/CompanyCommunicator.Core/Models/UpdateNotificationRequest.cs`
- Modify: `src/CompanyCommunicator.Core/Models/NotificationDto.cs`
- Modify: `src/CompanyCommunicator.Core/Models/NotificationSummaryDto.cs`
- Create: `src/CompanyCommunicator.Core/Models/TemplateDto.cs`
- Create: `src/CompanyCommunicator.Core/Models/CreateTemplateRequest.cs`
- Create: `src/CompanyCommunicator.Core/Models/UpdateTemplateRequest.cs`
- Modify: `src/CompanyCommunicator.Api/Extensions/NotificationMappingExtensions.cs`
- Modify: `src/CompanyCommunicator.Api/Validation/InputValidator.cs`

**Step 1:** Add to `CreateNotificationRequest` and `UpdateNotificationRequest`:

```csharp
string? KeyDetails,       // JSON array of {Label, Value}
string? SecondaryText,
string? CustomVariables,  // JSON dict
string? AdvancedBlocks,   // JSON array of blocks
string? CardPreference    // "Standard" or "Advanced"
```

**Step 2:** Add same fields to `NotificationDto`. Add `Summary` snippet (first 100 chars) to `NotificationSummaryDto` for the message list preview.

**Step 3:** Create Template DTOs:

```csharp
// TemplateDto.cs
public sealed record TemplateDto(
    Guid Id, string Name, string? Description,
    string CardSchema, string CreatedBy, DateTime CreatedDate);

// CreateTemplateRequest.cs
public sealed record CreateTemplateRequest(
    string Name, string? Description, string CardSchema);

// UpdateTemplateRequest.cs
public sealed record UpdateTemplateRequest(
    string Name, string? Description, string CardSchema);
```

**Step 4:** Update `NotificationMappingExtensions` to map new fields in `ToDto()`, `ToSummaryDto()`, and reverse mapping in `CreateNotification`/`UpdateNotification` controller methods.

**Step 5:** Update `InputValidator`:
- Validate `KeyDetails` is valid JSON array if present
- Validate `CustomVariables` is valid JSON object if present
- Validate `SecondaryText` max 2000 chars
- Validate `CardPreference` is null, "Standard", or "Advanced"
- Validate `AdvancedBlocks` is valid JSON array if present

**Step 6:** Update the controller's `CreateNotification` and `UpdateNotification` to map the new fields to the entity.

**Step 7:** Commit.

```bash
git commit -m "feat(api): expose card builder fields in notification DTOs and add template models"
```

---

## Task 3: Backend — Templates Controller

**Goal:** CRUD API for custom templates.

**Files:**
- Create: `src/CompanyCommunicator.Api/Controllers/TemplatesController.cs`

**Endpoints:**
- `GET /api/templates` — List templates for current user (ordered by CreatedDate desc)
- `GET /api/templates/{id}` — Get single template
- `POST /api/templates` — Create template
- `PUT /api/templates/{id}` — Update template (owner only)
- `DELETE /api/templates/{id}` — Delete template (owner only)

**Step 1:** Create `TemplatesController` following the pattern from `NotificationsController`:
- `[Authorize(Policy = PolicyNames.Author)]`
- Filter templates by `CreatedBy` == caller's OID
- Validate name required, max 200 chars
- Validate CardSchema is non-empty valid JSON

**Step 2:** Commit.

```bash
git commit -m "feat(api): add Templates CRUD controller"
```

---

## Task 4: Backend — Update AdaptiveCardService for New Fields

**Goal:** Generate richer Adaptive Cards that include KeyDetails (FactSet), SecondaryText, and AdvancedBlocks.

**Files:**
- Modify: `src/CompanyCommunicator.Core/Services/Cards/AdaptiveCardService.cs`
- Modify: `src/CompanyCommunicator.Core/Services/Cards/IAdaptiveCardService.cs`

**Step 1:** Update `BuildNotificationCard` to handle:

After the summary TextBlock:
- If `KeyDetails` JSON parses to array of `{Label, Value}`, add a FactSet element
- If `AdvancedBlocks` JSON parses to array, iterate and add appropriate Adaptive Card elements

After the author line:
- If `SecondaryText` is present, add a subtle small TextBlock

**Step 2:** Add `ResolveCustomVariables(string cardJson, string? customVariablesJson)` method:
- Parse CustomVariables JSON to a `Dictionary<string, string>`
- Replace `{{variableName}}` placeholders in the card JSON body with their values
- Used at send time and for previews

**Step 3:** Add `ResolveRecipientVariables(string cardJson, Dictionary<string, string> recipientData)` method:
- Replace `{{firstName}}`, `{{displayName}}`, `{{department}}`, `{{jobTitle}}`, `{{officeLocation}}`
- Used at send time per recipient (NOT for channel posts)

**Step 4:** Update `IAdaptiveCardService` interface with new method signatures.

**Step 5:** Commit.

```bash
git commit -m "feat(cards): support KeyDetails, SecondaryText, AdvancedBlocks, and variable resolution"
```

---

## Task 5: Frontend — Update TypeScript Types + API Hooks

**Goal:** Frontend types and hooks match the updated backend API.

**Files:**
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/types/index.ts`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/api/queryKeys.ts`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/api/notifications.ts`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/api/templates.ts`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/lib/validators.ts`

**Step 1:** Add new types to `types/index.ts`:

```typescript
export interface KeyDetailPair {
  label: string;
  value: string;
}

export interface CustomVariable {
  name: string;
  value: string;
}

export type CardPreference = 'Standard' | 'Advanced';

// Advanced block types
export type AdvancedBlockType =
  | 'ColumnLayout' | 'ImageSet' | 'TextBlock' | 'Table'
  | 'ActionButton' | 'Divider';

export interface AdvancedBlock {
  id: string;          // client-generated unique ID for key/reorder
  type: AdvancedBlockType;
  data: Record<string, unknown>; // type-specific payload
}

// Template
export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  cardSchema: string; // JSON string of CardSchema
  createdBy: string;
  createdDate: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string | null;
  cardSchema: string;
}

export interface UpdateTemplateRequest {
  name: string;
  description?: string | null;
  cardSchema: string;
}

// Card schema stored in templates
export interface CardSchema {
  headline: string;
  body?: string | null;
  imageLink?: string | null;
  keyDetails?: KeyDetailPair[];
  buttonTitle?: string | null;
  buttonLink?: string | null;
  secondaryText?: string | null;
  advancedBlocks?: AdvancedBlock[];
  cardPreference?: CardPreference;
}
```

**Step 2:** Update `NotificationDto` and `NotificationSummaryDto` with new fields:

```typescript
// Add to NotificationDto:
keyDetails: string | null;        // JSON string
secondaryText: string | null;
customVariables: string | null;   // JSON string
advancedBlocks: string | null;    // JSON string
cardPreference: string | null;

// Add to NotificationSummaryDto:
summary: string | null;  // first 100 chars for message list preview
```

**Step 3:** Update `CreateNotificationRequest` and `UpdateNotificationRequest` with same new fields.

**Step 4:** Add templates to `queryKeys.ts`:

```typescript
templates: {
  all: ['templates'] as const,
  list: () => [...queryKeys.templates.all, 'list'] as const,
  detail: (id: string) => [...queryKeys.templates.all, id] as const,
},
```

**Step 5:** Create `api/templates.ts` with hooks:
- `useTemplates()` — list user's templates
- `useCreateTemplate()` — POST
- `useUpdateTemplate()` — PUT
- `useDeleteTemplate()` — DELETE

**Step 6:** Update `lib/validators.ts` with new form schema fields for the redesigned compose form.

**Step 7:** Commit.

```bash
git commit -m "feat(frontend): update types, API hooks, and validators for card builder"
```

---

## Task 6: Frontend — Communication Center Layout + Sidebar

**Goal:** Replace the current AppLayout + tab-based list with a 3-zone Communication Center layout.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/Sidebar/Sidebar.tsx`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/App.tsx`

**Step 1:** Create `CommunicationCenter.tsx` — the root layout:

```
┌──────────┬──────────────────┬─────────────┐
│          │                  │             │
│ Sidebar  │  Message List    │  Detail     │
│ (~200px) │  (flex-1)        │  Panel      │
│          │                  │  (~320px)   │
│          │                  │             │
└──────────┴──────────────────┴─────────────┘
```

- Uses CSS grid: `grid-template-columns: 200px 1fr 320px`
- When compose slide-over is open: list + detail panel dim, slide-over covers them
- Detail panel only shows when a message is selected; otherwise the list takes full remaining width
- Full height: `height: 100vh`

**Step 2:** Create `Sidebar.tsx`:
- Prominent **"Compose"** button at top (primary appearance, full width)
- Navigation items: **Sent** (default active), **Drafts**, **Scheduled**
- Each item shows an icon + label + count badge (from API)
- Uses `useNotifications` with page=1,pageSize=1 for each status to get `totalCount` for badges (or add a dedicated count endpoint later)
- Active item highlighted with brand color
- Clicking a nav item updates the active tab in the parent

**Step 3:** Update `App.tsx`:
- Replace current routes with `CommunicationCenter` as the main route
- Remove dialog-based `/compose` and `/compose/:id` routes
- Keep `/export/:notificationId` as a dialog route
- Compose is now state-driven (slide-over inside CommunicationCenter), not route-driven

**Step 4:** Commit.

```bash
git commit -m "feat(ui): add Communication Center layout with sidebar navigation"
```

---

## Task 7: Frontend — Message List Redesign

**Goal:** Replace the plain table with a rich message list matching the design doc.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/MessageList/MessageList.tsx`
- Remove (later): `src/CompanyCommunicator.Api/ClientApp/src/components/NotificationList/NotificationList.tsx`

**Step 1:** Create `MessageList.tsx` — each row shows:
- **Colored avatar** (circle with 2-letter initials from title, deterministic color from title hash)
- **Title** (bold)
- **Preview snippet** (first ~80 chars of summary/body, subtle text)
- **Relative date** (e.g. "2h ago", "Yesterday", "Feb 14") using `date-fns/formatDistanceToNow` or similar
- **Status badge** (color-coded: Sent=green, Sending=blue animated, Scheduled=amber, Draft=gray, Failed=red)

**Step 2:** Messages currently sending show a subtle animated progress bar under the row (CSS animation, thin 2px bar).

**Step 3:** Add search bar at top:
- `Input` with search icon, placeholder "Search messages..."
- Client-side filter on title (for current page), or pass search to API if backend supports it
- 300ms debounce

**Step 4:** Clicking a row:
- Selects it (highlighted background)
- Populates the detail panel (via callback to parent)
- If Draft, also opens compose slide-over for editing

**Step 5:** Auto-refresh: when any message is in a sending state, poll at 10s interval (already handled by existing `useNotifications` refetchInterval logic).

**Step 6:** Default landing is **Sent** tab (not Drafts). The `initialTab` prop defaults to `'Sent'`.

**Step 7:** Commit.

```bash
git commit -m "feat(ui): redesign message list with avatars, snippets, and status badges"
```

---

## Task 8: Frontend — Detail Panel

**Goal:** Right-side panel showing delivery stats, progress, audience, and actions for the selected message.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/DetailPanel/DetailPanel.tsx`

**Step 1:** Create `DetailPanel.tsx` — takes a `notificationId: string` prop.
- Uses `useNotification(id)` and `useDeliveryStatus(id)` hooks

**Step 2:** Delivery stats in a 2x2 grid:
- **Delivered** (green) — succeededCount
- **Failed** (red) — failedCount
- **Pending** (amber) — totalCount - succeededCount - failedCount - canceledCount
- **Total** — totalRecipientCount

**Step 3:** Progress bar with percentage and "delivered/total" count text.

**Step 4:** Audience section:
- Show audience chips grouped into **Channel Posts** and **Individual Messages** sections (matching compose UI)
- Uses the notification's `audiences` array: Team type → Channel Posts, Roster/Group type → Individual Messages

**Step 5:** Timestamps:
- Created: formatted date
- Sent/Scheduled: formatted date
- Completed: if terminal status

**Step 6:** Actions:
- **Cancel** button (if sending/scheduled) — opens confirmation dialog
- **Export** button (if sent/failed) — opens export dialog
- **"Use as template"** button — calls `onCloneToCompose(notification)` callback to parent (opens compose pre-filled)

**Step 7:** Failed count is visually a link/button. When clicked, could show breakdown (future; for now just styled differently).

**Step 8:** Commit.

```bash
git commit -m "feat(ui): add detail panel with stats grid, progress, and actions"
```

---

## Task 9: Frontend — Compose Slide-Over Shell + Content Tab (Standard Mode)

**Goal:** The core compose experience — slide-over panel with Content tab in standard mode.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/useComposeForm.ts`

**Step 1:** Create `ComposePanel.tsx` — the slide-over shell:
- Positioned absolute, slides in from right, covers message list + detail panel
- Sidebar remains visible for orientation
- Background dims slightly (overlay with opacity)
- **Header:** Title ("New Message" or "Edit: [Title]"), Standard/Advanced toggle, close button (X)
- Close button prompts "Discard unsaved changes?" if form is dirty
- **Two tabs:** Content and Audience (using Fluent TabList)
- **Bottom action bar:** (Task 12)
- CSS: `position: absolute; right: 0; top: 0; bottom: 0; width: calc(100% - 200px);` (200px = sidebar width)
- Slide animation: CSS transition `transform: translateX(100%)` → `translateX(0)`

**Step 2:** Create `useComposeForm.ts` — custom hook managing the form:
- Uses `react-hook-form` with Zod resolver
- Form shape: `ComposeFormValues` (headline, body, imageLink, keyDetails, buttonTitle, buttonLink, secondaryText, customVariables, advancedBlocks, cardPreference, allUsers, audiences)
- Handles create vs edit mode (loads existing notification data)
- Provides `isDirty`, `save`, `send`, `schedule` functions
- Manages auto-save timer (30s interval — Task 12)

**Step 3:** Create `ContentTab.tsx` — Standard mode fields:

```
┌──────────────────────┬─────────────────┐
│  Form Fields         │  Live Preview   │
│  (flex ~60%)         │  (~40%)         │
│                      │                 │
│  [Headline]          │  ┌───────────┐  │
│  [Body w/ toolbar]   │  │ Adaptive  │  │
│  [Hero Image]        │  │ Card      │  │
│  + Add details       │  │ Preview   │  │
│  [Call to Action]    │  │           │  │
│  + Add footnote      │  └───────────┘  │
└──────────────────────┴─────────────────┘
```

Fields (all using Fluent UI `Field` + `Input`/`Textarea`):
- **Headline** — Input, placeholder "What's the main message?", required, max 200
- **Body** — Textarea with mini markdown toolbar (bold, italic, bullet, numbered, link, insert variable). Placeholder "Write your message..." Max 4000 chars
- **Hero Image** — Input for URL with thumbnail preview below when valid HTTPS URL entered. Labeled "(optional)"
- **Key Details** — Hidden by default. "+ Add details" link reveals a fact-list builder: pairs of label + value inputs, "Add row" button. Each row has a remove (X) button.
- **Call to Action** — Two side-by-side inputs: button label + URL. Labeled "(optional)". Hint: "Add a button that links to more info"
- **Secondary Text** — Hidden by default. "+ Add footnote" link reveals a small Textarea. Labeled "(optional)"

**Step 4:** Live Preview pane on the right:
- Uses existing `AdaptiveCardPreview` component
- Update `buildCardPayload` in `lib/adaptiveCard.ts` to handle the new fields (keyDetails → FactSet, secondaryText → subtle TextBlock)
- Updates in real-time as user types (debounced 300ms)
- Dynamic variable chips show sample values (e.g. `{{firstName}}` → "Sarah")

**Step 5:** Commit.

```bash
git commit -m "feat(ui): add compose slide-over panel with content tab and live preview"
```

---

## Task 10: Frontend — Template Picker + Built-in Templates

**Goal:** Template grid at the top of the Content tab with 5 built-in + custom templates.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/lib/builtinTemplates.ts`

**Step 1:** Define 5 built-in templates in `builtinTemplates.ts` as `CardSchema` objects:

1. **Announcement** — Headline, Body, Hero Image, CTA
2. **Event Invite** — Headline, Body, Hero Image, Key Details (Date/Time/Location pre-filled), CTA ("RSVP")
3. **Urgent Alert** — Headline (emphasized), Body, CTA. No image.
4. **Link Share** — Headline, short Body, CTA (emphasized). Minimal.
5. **Survey / Feedback** — Headline, Body, CTA ("Take Survey")

Each template object includes: `name`, `description`, `icon` (Fluent icon), `schema: CardSchema`.

**Step 2:** Create `TemplatePicker.tsx`:
- Grid of cards (CSS grid, auto-fill, minmax ~140px)
- Each card: icon, name, short description
- "Blank" card always first
- Custom templates appear after a divider (loaded from `useTemplates()` hook)
- Custom templates have a delete button (small X icon)
- Clicking a template: if form has content, confirm "Replace current content with this template?". If confirmed (or form empty), pre-fill the form fields from the template's `CardSchema`.

**Step 3:** The template picker is collapsible — starts expanded on new compose, collapsed on edit.

**Step 4:** Commit.

```bash
git commit -m "feat(ui): add template picker with 5 built-in templates"
```

---

## Task 11: Frontend — Audience Tab

**Goal:** Redesign audience selection with Channel Posts / Individual Messages sections.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/AudienceTab.tsx`

**Step 1:** Create `AudienceTab.tsx` with two-column layout:

```
┌──────────────────────┬─────────────────┐
│  Search & Select     │  Selection &    │
│  (left, ~50%)        │  Summary        │
│                      │  (right, ~50%)  │
│  [Send to everyone]  │  Channel Posts: │
│                      │  [Eng · General]│
│  Teams search:       │  [Mkt · General]│
│  [_______________]   │                 │
│                      │  Individual:    │
│  Groups search:      │  [Product · 42] │
│  [_______________]   │  [Design · 18]  │
│                      │                 │
│                      │  Recently used: │
│                      │  [ghost chips]  │
│                      │                 │
│                      │  ┌────────────┐ │
│                      │  │ 3 audiences│ │
│                      │  │ ~487 reach │ │
│                      │  └────────────┘ │
└──────────────────────┴─────────────────┘
```

**Step 2:** Left side — Search & Select:
- **"Send to everyone"** compact toggle (Switch + label). Sublabel: "All users in your organization." When enabled, disables specific selection below.
- **Teams search** — Combobox, 300ms debounce, loading spinner in input, results show team name + member count (if available from API). Selecting adds to right side.
- **Groups search** — Same pattern. Shows group name + member count. No "security group" label.

**Step 3:** Right side — Selection & Summary:

**Channel Posts section:**
- Teams default here when added
- Each chip: "[TeamName] · General" with blue color
- "Send to members instead" link on each chip → moves to Individual Messages
- X button to remove

**Individual Messages section:**
- Groups always land here (cannot be moved)
- Teams moved here show: "[TeamName] · 142 members"
- "Send to channel instead" link on each team chip → moves back
- Chips color-coded: blue for teams, purple for groups
- X button to remove

**Step 4:** Delivery mode mapping to `AudienceDto`:
- Channel Posts team → `{ audienceType: 'Team', audienceId }` (send to General channel)
- Individual Messages team → `{ audienceType: 'Roster', audienceId }` (send to each member)
- Individual Messages group → `{ audienceType: 'Group', audienceId }` (send to each member)

**Step 5:** **Recently used** — Below the selection, show audiences from the last few sends as ghost chips. Store in `localStorage` (key: `cc-recent-audiences`, max 10 entries). Clicking adds them.

**Step 6:** **Summary card** at bottom:
- "N audiences selected"
- Big estimated reach number: channel posts = 1 per team, individual = per member
- Updates live

**Step 7:** Commit.

```bash
git commit -m "feat(ui): redesign audience tab with channel posts and individual messages sections"
```

---

## Task 12: Frontend — Bottom Action Bar + Auto-Save

**Goal:** Always-visible bottom bar with audience summary, actions, and auto-save.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/useComposeForm.ts`

**Step 1:** Create `ActionBar.tsx`:

```
┌──────────────────────────────────────────────────────────────┐
│ [Eng, Product · ~487 people]   [Save] [Preview] [Sched] [Review →] │
└──────────────────────────────────────────────────────────────┘
```

Left side:
- Quick audience summary as chips + estimated reach text
- Shows "No audience selected" in subtle text when empty

Right side buttons:
- **Save Draft** (secondary) — saves without closing
- **Send Preview** (subtle) — sends card to yourself via bot (only in edit mode with saved draft)
- **Schedule** (secondary) — opens date/time picker popover
- **Review →** (primary) — opens pre-send confirmation (Task 15)

**Step 2:** Add auto-save to `useComposeForm.ts`:
- `useEffect` with 30-second interval
- Only saves if form is dirty AND has a title (minimum viable draft)
- Shows subtle "Auto-saved" indicator near the action bar that fades after 3 seconds
- On first auto-save of a new message, creates the draft (POST) and switches to edit mode
- Subsequent auto-saves use PUT

**Step 3:** Add "Save as Template" option — accessible from a `...` menu next to Save Draft:
- Opens a small dialog: name input + optional description input
- On save, calls `useCreateTemplate` with current form state serialized as `CardSchema` JSON

**Step 4:** Commit.

```bash
git commit -m "feat(ui): add bottom action bar with auto-save and template save"
```

---

## Task 13: Frontend — Dynamic Variables

**Goal:** Insert dynamic variables into text fields, display as styled chips, preview with sample values.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/VariableInsert.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/CustomVariablesPanel.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/lib/variables.ts`

**Step 1:** Create `lib/variables.ts` — variable definitions and helpers:

```typescript
export const RECIPIENT_VARIABLES = [
  { name: 'firstName', label: 'First Name', sampleValue: 'Sarah', icon: 'Person' },
  { name: 'displayName', label: 'Display Name', sampleValue: 'Sarah Johnson', icon: 'Person' },
  { name: 'department', label: 'Department', sampleValue: 'Engineering', icon: 'Building' },
  { name: 'jobTitle', label: 'Job Title', sampleValue: 'Software Engineer', icon: 'Briefcase' },
  { name: 'officeLocation', label: 'Office Location', sampleValue: 'Building 25', icon: 'Location' },
] as const;

export function resolveVariablesForPreview(
  text: string,
  customVariables: CustomVariable[]
): string { /* replace {{name}} with sample/custom values */ }
```

**Step 2:** Create `VariableInsert.tsx` — dropdown menu accessible from the Body toolbar's "Insert variable" button:
- Section 1: **Recipient Variables** — list of RECIPIENT_VARIABLES with person icon
- Section 2: **Custom Variables** — list of user-defined variables with different color icon
- Section 3: **"+ Add custom variable"** — inline input to name a new variable
- Clicking inserts `{{variableName}}` at cursor position in the textarea
- **Recipient variables disabled/grayed** when all audiences are Channel Posts (with tooltip explaining why)

**Step 3:** Create `CustomVariablesPanel.tsx` — collapsible panel below the form fields:
- Lists all custom variables with editable name + value pairs
- "Add variable" button
- Remove (X) button per variable
- Changes update the form state (`customVariables` field)
- Variables are shared across all text fields — update value once, updates everywhere

**Step 4:** In the Body textarea and other text inputs, `{{variableName}}` tokens should be visually rendered as styled inline chips. Since HTML textareas can't render chips, use one of:
- Option A: Keep as plain text `{{var}}` in the textarea, only render chips in the preview
- **Option A is recommended** for simplicity. The preview panel renders variables as styled chip-like elements.

**Step 5:** In the live preview, replace `{{variableName}}` with sample values in a visually distinct style (e.g. colored background chip showing "Sarah" instead of `{{firstName}}`).

**Step 6:** Commit.

```bash
git commit -m "feat(ui): add dynamic variable insertion with recipient and custom variables"
```

---

## Task 14: Frontend — Advanced Mode Toggle + Block Editor

**Goal:** Toggle between Standard and Advanced modes. Advanced adds a block editor for complex layouts.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/BlockEditor.tsx`
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/blocks/`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx`

**Step 1:** The Standard/Advanced toggle is in the compose header. State stored in form as `cardPreference`. Remembered per user via `localStorage` key `cc-card-preference`.

**Step 2:** Create `BlockEditor.tsx` — shown BELOW the standard fields when in Advanced mode:
- **"+ Add Block"** button opens a picker menu with block types:
  - Column layout (2 or 3 columns)
  - Image set (gallery of images)
  - Additional text block
  - Table (rows × columns)
  - Extra action button
  - Divider
- Each block renders as a card with:
  - Drag handle on the left (for reorder via drag-and-drop)
  - Block type label
  - Inline editing controls specific to the block type
  - Remove (X) button

**Step 3:** Create block components in `blocks/` directory:
- `ColumnBlock.tsx` — 2-3 column layout with content areas
- `ImageSetBlock.tsx` — array of image URL inputs
- `TextBlockBlock.tsx` — additional Textarea
- `TableBlock.tsx` — dynamic rows/columns grid
- `ActionButtonBlock.tsx` — label + URL inputs
- `DividerBlock.tsx` — just a visual separator, no config

**Step 4:** Blocks are stored in the form as `advancedBlocks: AdvancedBlock[]`. Each block has a unique `id` (generated with `crypto.randomUUID()`), `type`, and `data` (type-specific).

**Step 5:** Drag-and-drop reorder:
- Use native HTML drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`)
- Simple swap logic — no library dependency needed for basic reorder

**Step 6:** Update `buildCardPayload` in `lib/adaptiveCard.ts` to convert `AdvancedBlock[]` to Adaptive Card elements (ColumnSet, ImageSet, TextBlock, Table, Action.OpenUrl, separator).

**Step 7:** Commit.

```bash
git commit -m "feat(ui): add advanced mode with block editor for complex card layouts"
```

---

## Task 15: Frontend — Pre-Send Confirmation Dialog

**Goal:** Review button opens a confirmation dialog with card preview, audience summary, and estimated reach.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`

**Step 1:** Create `ConfirmSendDialog.tsx` — modal overlay on top of the slide-over:

```
┌──────────────────────────────────────┐
│           Review & Send              │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   [Adaptive Card Preview]    │    │
│  │   (rendered with sample      │    │
│  │    variable values)          │    │
│  └──────────────────────────────┘    │
│                                      │
│  Audience:                           │
│  Channel Posts:                      │
│    [Engineering · General]           │
│  Individual Messages:                │
│    [Product · 42 members]            │
│    [Design Group · 18 members]       │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ This message will reach      │    │
│  │ ~487 people                  │    │
│  └──────────────────────────────┘    │
│                                      │
│  [If scheduled: "Scheduled for       │
│   Feb 20, 2026 at 9:00 AM"]         │
│                                      │
│  [Cancel]            [Confirm & Send]│
└──────────────────────────────────────┘
```

**Step 2:** The dialog receives:
- Form values (to build card preview)
- Audience list (to display chips)
- Estimated reach count
- Optional schedule date
- `onConfirm` callback
- `onCancel` callback

**Step 3:** Card preview uses the full `buildCardPayload` with all fields, rendered in a contained preview box with the current theme.

**Step 4:** On "Confirm & Send":
1. Save the notification (create or update)
2. Call send or schedule endpoint
3. Transform dialog into delivery tracker (Task 16)

**Step 5:** Commit.

```bash
git commit -m "feat(ui): add pre-send confirmation dialog with card preview and reach estimate"
```

---

## Task 16: Frontend — Post-Send Delivery Tracker

**Goal:** After confirming send, the dialog transforms into a live delivery tracker.

**Files:**
- Create: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/DeliveryTracker.tsx`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ConfirmSendDialog.tsx`

**Step 1:** Create `DeliveryTracker.tsx`:

```
┌──────────────────────────────────────┐
│           Sending...                 │
│                                      │
│         ┌────────────┐               │
│         │            │               │
│         │  Progress  │               │
│         │   Ring     │               │
│         │   72%      │               │
│         │            │               │
│         └────────────┘               │
│                                      │
│  Delivered: 350  Failed: 2           │
│  Remaining: 135                      │
│                                      │
│  Status: Sending...                  │
│                                      │
│              [Done]                  │
└──────────────────────────────────────┘
```

**Step 2:** Uses `useDeliveryStatus(notificationId)` with 5s polling.

**Step 3:** Status label transitions:
- `Queued` → "Queuing..."
- `SyncingRecipients` → "Syncing recipients..."
- `InstallingApp` → "Installing app..."
- `Sending` → "Sending..."
- `Sent` → "Delivered to N people" (with checkmark animation)
- `Failed` → "Delivery failed" (with error icon)

**Step 4:** Progress ring (Fluent `ProgressBar` or custom SVG ring):
- Shows percentage: `succeededCount / totalRecipientCount`
- Color: brand while sending, success when complete, error when failed

**Step 5:** "Done" button appears once delivery reaches a terminal status:
- Closes the slide-over
- Navigates to the **Sent** tab
- Highlights the sent message at the top of the list

**Step 6:** If user closes early (X button), delivery continues in background. The message list shows progress via auto-polling in the message row.

**Step 7:** Update `ConfirmSendDialog.tsx` to manage the state transition:
- State: `'review' | 'sending'`
- After confirm → switch to `'sending'` state → render `DeliveryTracker` in place of the review content

**Step 8:** Commit.

```bash
git commit -m "feat(ui): add post-send delivery tracker with live progress"
```

---

## Task 17: Frontend — Update adaptiveCard.ts for New Fields

**Goal:** The frontend card builder generates Adaptive Card JSON that includes all new fields.

**Files:**
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/lib/adaptiveCard.ts`

**Step 1:** Update `CardData` interface:

```typescript
export interface CardData {
  title: string;              // Headline
  summary?: string | null;    // Body (markdown)
  imageLink?: string | null;  // Hero Image URL
  keyDetails?: KeyDetailPair[] | null;
  buttonTitle?: string | null;  // CTA label
  buttonLink?: string | null;   // CTA URL
  secondaryText?: string | null;
  author?: string | null;
  advancedBlocks?: AdvancedBlock[] | null;
  customVariables?: CustomVariable[] | null;
}
```

**Step 2:** Update `buildCardPayload` to add after summary:
- **FactSet** from `keyDetails` (array of `{title: label, value: value}`)
- **Advanced blocks** rendered as appropriate Adaptive Card elements

After action button:
- **Secondary text** as subtle, small TextBlock

**Step 3:** Add `resolvePreviewVariables(payload, customVariables)`:
- Walk the card JSON body elements
- Replace `{{varName}}` in all text values with sample values (recipient vars) or custom variable values
- Return modified payload for preview rendering

**Step 4:** Commit.

```bash
git commit -m "feat(cards): update frontend card builder for key details, secondary text, and blocks"
```

---

## Task 18: Frontend — Polish, Integration, and Cleanup

**Goal:** Wire everything together, remove old components, update i18n, final polish.

**Files:**
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/i18n/en-US.json`
- Modify: `src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx`
- Remove: `src/CompanyCommunicator.Api/ClientApp/src/components/NotificationList/`
- Remove: `src/CompanyCommunicator.Api/ClientApp/src/components/NotificationForm/`
- Remove: `src/CompanyCommunicator.Api/ClientApp/src/components/AudiencePicker/`
- Remove: `src/CompanyCommunicator.Api/ClientApp/src/components/Layout/AppLayout.tsx`

**Step 1:** Wire up CommunicationCenter state management:
- `selectedTab` state: 'Sent' | 'Drafts' | 'Scheduled'
- `selectedMessageId` state: string | null
- `composeOpen` state: boolean
- `composeEditId` state: string | null (null for new, id for edit)
- `previousTab` state: remembers which tab user came from for back navigation

**Step 2:** "Use as template" from detail panel:
- Button in DetailPanel calls `onCloneToCompose(notification)` → opens compose slide-over pre-filled with that message's content as a new draft (no ID, so it creates new on save)

**Step 3:** Back navigation fix:
- When navigating into a detail view, store `{tab, scrollPosition}`
- Back button restores both

**Step 4:** Update `i18n/en-US.json` with all new translation strings:
- Sidebar labels, new field labels (Headline, Body, Hero Image, etc.)
- Template names and descriptions
- Audience tab labels (Channel Posts, Individual Messages, Send to members/channel)
- Confirmation dialog text
- Delivery tracker status messages
- Variable names and labels
- All new button labels, hints, placeholders

**Step 5:** Remove old components that are fully replaced:
- `NotificationList/` → replaced by `MessageList/`
- `NotificationForm/` → replaced by `ComposePanel/`
- `AudiencePicker/` → replaced by `AudienceTab`
- `Layout/AppLayout.tsx` → replaced by `CommunicationCenter`
- Keep `StatusView/` as it may still be useful for deep-link routes
- Keep `AdaptiveCardPreview/` as it's reused
- Keep `ExportManager/` as it's still dialog-based

**Step 6:** Update `App.tsx` final routing:
- `/` → `CommunicationCenter` (default to Sent tab)
- `/export/:notificationId` → `ExportManager` (Teams dialog)
- `*` → redirect to `/`

**Step 7:** Verify build compiles cleanly:

```bash
cd src/CompanyCommunicator.Api/ClientApp && npm run build
```

**Step 8:** Commit.

```bash
git commit -m "feat(ui): integrate communication center, remove old components, update i18n"
```

---

## Task 19: Backend — Dynamic Variable Resolution in Prep/Send Functions

**Goal:** Resolve `{{firstName}}`, `{{displayName}}`, etc. per recipient at send time.

**Files:**
- Modify: `src/CompanyCommunicator.SendFunction/Activities/` (the activity that builds and sends cards)
- Modify: `src/CompanyCommunicator.Core/Services/Cards/AdaptiveCardService.cs`

**Step 1:** In the Send function's card-building step (where it calls `BuildNotificationCard`):
- After building the base card JSON, call `ResolveCustomVariables` to substitute custom variables
- For **personal-scope sends** (not channel posts): call `ResolveRecipientVariables` with the recipient's Graph profile data
- For **channel posts**: skip recipient variable resolution (leave `{{firstName}}` as literal text, or strip them)

**Step 2:** The Prep function already fetches user profiles from Graph during recipient sync. Ensure the relevant fields (firstName, displayName, department, jobTitle, officeLocation) are available when building per-recipient cards.

If user profiles aren't already cached with these fields, add Graph profile fetch to the send pipeline:
- `GET /users/{aadId}?$select=givenName,displayName,department,jobTitle,officeLocation`
- Cache the result for the duration of the send batch

**Step 3:** Commit.

```bash
git commit -m "feat(send): resolve dynamic variables per recipient at send time"
```

---

## Dependency Graph

```
Task 1 (DB) → Task 2 (DTOs) → Task 3 (Templates API)
                              → Task 4 (Card Service)
                              → Task 5 (Frontend Types) → Task 6 (Layout)
                                                        → Task 7 (List)
                                                        → Task 8 (Detail)
                                                        → Task 9 (Compose)
Task 6 → Task 7, 8
Task 9 → Task 10 (Templates), 11 (Audience), 12 (Action Bar)
Task 9 → Task 13 (Variables), 14 (Advanced), 17 (Card Builder)
Task 12 → Task 15 (Confirm) → Task 16 (Tracker)
Task 4, 9+ → Task 18 (Polish)
Task 4 → Task 19 (Variable Resolution)
```

**Suggested execution order:**

| Wave | Tasks | Can parallelize? |
|------|-------|-----------------|
| 1 | 1 | No |
| 2 | 2, 3, 4 | Yes (all depend on 1) |
| 3 | 5 | No (depends on 2) |
| 4 | 6, 17 | Yes (layout + card builder) |
| 5 | 7, 8, 9 | Yes (all depend on 6) |
| 6 | 10, 11, 12 | Yes (all depend on 9) |
| 7 | 13, 14 | Yes (depend on 9) |
| 8 | 15 | No (depends on 12) |
| 9 | 16 | No (depends on 15) |
| 10 | 18 | No (integration) |
| 11 | 19 | Independent of frontend |

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] Sidebar shows correct counts for Sent/Drafts/Scheduled
- [ ] Message list shows colored avatars, snippets, relative dates, status badges
- [ ] Clicking a message populates the detail panel
- [ ] Detail panel shows delivery stats, progress bar, audience chips, timestamps, actions
- [ ] "Compose" button opens slide-over with Content tab
- [ ] Standard mode shows all 6 field types (Headline, Body, Hero Image, Key Details, CTA, Secondary Text)
- [ ] Live preview updates in real time
- [ ] Template picker shows 5 built-in + custom templates
- [ ] Selecting a template pre-fills form with confirmation when dirty
- [ ] Audience tab shows Channel Posts / Individual Messages sections
- [ ] Teams/Groups search works with debounce and loading states
- [ ] "Send to members instead" / "Send to channel instead" toggles work
- [ ] Recently used audiences shown and clickable
- [ ] Summary card shows audience count + estimated reach
- [ ] Auto-save fires every 30 seconds when dirty
- [ ] "Review →" opens confirmation dialog with card preview + audience + reach
- [ ] "Confirm & Send" triggers send and shows delivery tracker
- [ ] Delivery tracker shows live progress with polling
- [ ] "Done" navigates to Sent tab with message highlighted
- [ ] Dynamic variables insert into text, show as chips in preview
- [ ] Custom variables editable in panel, update everywhere
- [ ] Advanced mode toggle adds block editor
- [ ] Advanced blocks render correctly in preview
- [ ] "Use as template" clones a sent message into new compose
- [ ] Save as template stores current form as custom template
- [ ] Back navigation remembers tab + scroll position
- [ ] All field labels use new names (Headline, Body, Hero Image, etc.)
- [ ] Build compiles with no errors: `npm run build`
- [ ] Backend variable resolution works for personal and channel sends
