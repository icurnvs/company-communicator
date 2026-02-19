# Author Dashboard Redesign — Design Document

**Date:** 2026-02-19
**Status:** Approved
**Scope:** Complete redesign of the Company Communicator Author UI

---

## Overview

The current Author UI is functional but uninspiring — a tabbed table, a cramped dialog-based compose form, confusing field labels, and poor navigation flow. This redesign transforms it into a polished, delightful Communication Center with a powerful card builder, intuitive audience selection, and a confident send flow.

## Design Decisions Summary

| Decision | Choice |
|----------|--------|
| Layout | Communication Center (sidebar + list + detail) |
| Compose flow | Slide-over panel from right |
| Compose organization | Content tab + Audience tab |
| Card builder modes | Standard / Advanced toggle (remembered per user) |
| Templates | 5 built-in + save-as custom templates |
| Audience picker | Side-by-side Teams/Groups with Channel Posts vs Individual Messages sections |
| Dynamic variables | Recipient properties (Graph) + author-defined custom variables |
| Pre-send | "Review" button opens confirmation dialog with card preview + audience + reach |
| Post-send | Confirmation transforms into live delivery tracker |
| Default landing | Sent tab (not Drafts) |

---

## 1. Navigation & Layout

The app uses a **Communication Center** layout with three zones:

### Sidebar (fixed left, ~200px)
- A prominent "Compose" button at top
- Navigation items: **Sent** (default active), **Drafts**, **Scheduled** — each with a count badge
- The sidebar is always visible, even when composing

### Message List (middle)
- Shows notifications for the selected nav category
- Each row has a colored avatar (initials from the title), the message title, a preview snippet, relative date, and a color-coded status badge (Sent, Sending, Scheduled, Draft, Failed)
- Clicking a row selects it and populates the detail panel
- **Default landing is Sent** — not Drafts — because that's where the action is
- Messages currently sending show a subtle animated progress bar under the row
- Auto-refresh polls for updates while any message is in a sending state (10s interval)
- Search bar at the top for filtering by title

### Detail Panel (right, ~320px)
- Delivery stats in a 2x2 grid: Delivered (green), Failed (red), Pending (amber), Total
- Progress bar with percentage and delivered/total count
- Audience section showing chips with the same Channel Posts / Individual Messages grouping used during compose
- Timestamps: Created, Sent/Scheduled, Completed
- **Actions:** Cancel (if sending), Export (if complete), "Use as template" (clone into new compose)
- Failed count is clickable, showing a breakdown of failure reasons when available
- "Retry failed" action for failed messages

### Back Navigation Fix
Navigating into a detail view from any tab (Sent, Scheduled, etc.) remembers which tab you came from. The back button returns you to that same tab and scroll position — never dumps you on Drafts.

---

## 2. Compose Flow — Slide-Over Panel

Clicking "Compose" in the sidebar (or "Edit" on a draft) opens a **slide-over panel** from the right. It covers the message list and detail panel, but the sidebar stays visible for orientation. The list dims slightly to reinforce focused mode.

### Slide-over structure:
- **Header:** Title ("New Message" or "Edit: [Message Title]"), Simple/Advanced mode toggle (remembered per user), and close button (X) that prompts "Discard unsaved changes?" if the form is dirty
- **Two tabs:** Content and Audience
- **Bottom action bar:** Always visible. Left side shows a quick audience summary (chips + estimated reach: "Sending to: Engineering, Product · ~487 people"). Right side has: **Save Draft**, **Send Preview** (sends to yourself), **Schedule** (opens date picker), **Review →** (opens confirmation dialog)

### Auto-save
Drafts auto-save every 30 seconds while composing. No more losing work.

### Editing existing drafts
Opens the same slide-over, pre-filled with saved content. Header says "Edit: [Message Title]."

### Cloning from sent messages
From the detail panel of any sent message, a "Use as template" action opens compose pre-filled with that message's content as a new draft.

---

## 3. Content Tab — Card Builder

The Content tab is the heart of the compose experience.

### Template Picker

At the top, a grid of template cards:

**Built-in templates (5):**
- **Announcement** — Headline, Body, Hero Image, Call to Action. General-purpose default.
- **Event Invite** — Headline, Body, Hero Image, Key Details pre-filled with Date/Time/Location rows, Call to Action labeled "RSVP"
- **Urgent Alert** — Headline (warning emphasis), Body, Call to Action. No image — lean and fast.
- **Link Share** — Headline, short Body, Call to Action (emphasized). Minimal — the link is the point.
- **Survey / Feedback** — Headline, Body, Call to Action labeled "Take Survey"

**Blank** option always available for starting from scratch.

**Custom templates** appear after a divider, with a distinct visual treatment and delete option.

Selecting a template pre-fills the form. If the form already has content, a confirmation: "Replace current content with this template?"

### Save as Template

Available from the bottom action bar (secondary menu alongside Save Draft). Prompts for name and optional description. Saves the block structure and placeholder content (not the specific message text).

### Form Fields — Standard Mode

- **Headline** — Input with placeholder: "What's the main message?"
- **Body** — Textarea with a mini markdown toolbar (bold, italic, bullet list, numbered list, link, insert variable). Supports bold, italic, lists, and hyperlinks per Adaptive Card markdown subset.
- **Hero Image** — Drop zone for URL or drag-and-drop, with thumbnail preview. Labeled "(optional)"
- **Key Details** — Fact list builder: label + value pairs with "Add row" button. Hidden by default, shown via "+ Add details" link. Great for dates, locations, deadlines.
- **Call to Action** — Button label + URL side by side, with hint: "Add a button that links to more info". Labeled "(optional)"
- **Secondary Text** — Optional fine-print field, hidden by default via "+ Add footnote"

### Form Fields — Advanced Mode (toggle adds)

- **Add Block** button opening a picker: Column layout, Image set, Additional text block, Table, Extra action button, Divider
- Blocks can be **reordered** via drag handles
- Each block has a remove (X) button
- Advanced-mode templates that include column layouts or tables load those blocks regardless of current mode setting

### Live Preview

Right-side pane, updating in real time as the user types. Dynamic variables show as styled placeholder chips with sample values (e.g. `{{firstName}}` renders as "Sarah"). Preview matches Teams card rendering as closely as possible. Preview reflects the current theme (light/dark/high-contrast).

---

## 4. Audience Tab

Switching to the Audience tab gives full space to recipient selection.

### Left Side — Search & Select

**Send to everyone** — Compact toggle at top (small switch + label, not a full-width banner). Sublabel: "All users in your organization."

**Teams search** — Combobox with placeholder "Search teams...". Typing shows a loading spinner inside the input. Results drop down showing team name + member count. Clicking adds the team as a chip. Search clears after selection. 300ms debounce with clear loading/empty/error states.

**Groups search** — Same pattern. Shows group name + member count. No "security group" jargon.

### Right Side — Selection & Summary

Selected audiences displayed in **two distinct sections** that make delivery behavior unmistakable:

**Channel Posts:**
- Teams default here when added
- Each chip shows: "Engineering · General"
- Posts to the team's General channel
- A "Send to members instead" link on each chip to move to Individual Messages

**Individual Messages:**
- Groups always land here (can't be moved)
- Teams moved here show member count: "Engineering · 142 members"
- A "Send to channel instead" link on each chip to move back
- Chips are color-coded: blue for teams, purple for groups
- X button directly on each chip for removal

**Recently used** — Below the selected list, audiences from the last few sends shown as clickable ghost chips. One click adds them.

**Summary card** at bottom — Total audiences selected + big estimated reach number. Channel posts count as 1 delivery per team, individual messages count per member. Updates live as audiences change.

---

## 5. Dynamic Variables

Accessible via an **"Insert variable"** button in the markdown toolbar (available in Headline, Body, Key Details values, and Secondary Text).

### Recipient Variables (from Microsoft Graph)
- `{{firstName}}`, `{{displayName}}`, `{{department}}`, `{{jobTitle}}`, `{{officeLocation}}`
- Resolved per recipient at send time
- In the editor: styled inline chips with a person icon
- In the live preview: show sample values ("Sarah", "Engineering")
- **Not available for channel posts** — grayed out / hidden when all audiences are channel posts, with a hint explaining why

### Custom Variables (author-defined)
- "Add variable" option in the insert menu
- Author names the variable and sets its value (e.g. `{{deadline}}` = "March 15, 2026")
- Use in multiple places — update value once, updates everywhere
- In the editor: styled chips in a different color from recipient variables
- A collapsible "Variables" panel lists all custom variables with editable values

---

## 6. Pre-Send Confirmation & Post-Send Flow

### Review Button
The bottom action bar shows **"Review →"** (not "Send"). This opens the confirmation dialog — a modal overlay on the slide-over.

### Confirmation Dialog Shows:
- **Card preview** — Rendered Adaptive Card exactly as recipients will see it, with dynamic variables shown as resolved sample values
- **Audience summary** — Chips for each selected team/group (or "Everyone"), organized in Channel Posts / Individual Messages sections, with member counts
- **Estimated reach** — Prominently displayed: "This message will reach **~487 people**"
- **Schedule info** — If scheduling, shows the scheduled date/time
- Two buttons: **"Cancel"** (back to editing) and **"Confirm & Send"** (the real commit)

### Post-Confirmation: Delivery Tracker
After confirming, the dialog **transforms into a delivery tracker**:
- Progress ring/bar filling up as messages deliver
- Live counters: Delivered / Failed / Remaining
- Status label transitions: "Queuing..." → "Sending..." → "Delivered to 487 people"
- A **"Done"** button appears that closes the slide-over and returns to the **Sent** tab with the message highlighted at the top, still showing live delivery status in the detail panel

If closed early, delivery continues in the background — the Sent list shows progress via auto-polling.

---

## 7. Improved Field Labels

| Old Label | New Label | Why |
|-----------|-----------|-----|
| Title | **Headline** | Clearer intent — this is the main message |
| Summary | **Body** | It's the content, not a summary |
| Image URL | **Hero Image** | Describes what it does, not how |
| Button Title | **Call to Action** (label field) | Industry-standard term |
| Button URL | **Call to Action** (URL field) | Paired with label, hint explains it |
| Include Roster | **Send to members instead** | Describes the actual behavior |
| All Users (toggle) | **Send to everyone** | Plain language |

---

## 8. Technical Notes

### Adaptive Cards Capabilities Used
- **TextBlock** with Markdown subset (bold, italic, bullet/numbered lists, hyperlinks)
- **RichTextBlock** with TextRun for inline formatting
- **Image** for hero images
- **FactSet** for key details (label-value pairs)
- **ColumnSet/Column** for multi-column layouts (Advanced mode)
- **ImageSet** for image galleries (Advanced mode)
- **Table** for tabular data (Advanced mode)
- **Action.OpenUrl** for call-to-action buttons
- **Adaptive Card Templating** (`${variable}` syntax) for dynamic variables

### Adaptive Cards Limitations
- No headers (H1/H2/H3) — use TextBlock with size/weight properties instead
- No HTML support — Markdown subset only
- No custom fonts — controlled by host app (Teams)
- No embedded forms/inputs in sent cards (read-only broadcast)

### Template Storage
- Built-in templates: hardcoded in frontend
- Custom templates: stored in database (new `Templates` table with userId, name, description, cardSchema JSON, createdDate)
- Template picker loads from API on compose open

### Dynamic Variable Resolution
- Recipient variables resolved at send time in the Prep/Send functions via Graph user profile data
- Custom variables resolved at send time from stored variable map on the notification record
- Channel post cards skip recipient variable resolution (use raw text or omit)

---

## 9. Out of Scope (Future Enhancements)

- Org-shared templates (admin marks templates as available to all authors)
- Drag-and-drop image upload to Azure Blob Storage (currently URL-only)
- A/B testing (send variant cards to segments)
- Analytics dashboard (open rates, engagement beyond delivery)
- Rich text WYSIWYG editor (beyond markdown toolbar)
- Recipient variable preview with real user data (currently sample values only)
