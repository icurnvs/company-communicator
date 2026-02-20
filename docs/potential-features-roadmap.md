# Company Communicator — Potential Features Roadmap

**Date:** 2026-02-19
**Status:** Proposal for leadership review
**Context:** Our modernized Company Communicator is fully operational with end-to-end broadcast delivery to both personal chats and team channels. This document evaluates five potential features that would meaningfully extend the platform's value for a large enterprise.

---

## Feature 1: Bot Personas (Content-Branded Senders)

### What It Is
Instead of every broadcast appearing as "Company Communicator," messages display under context-appropriate identities — "IT Alerts," "HR Updates," "Social Committee," etc. — each with its own name and avatar. Authors select a persona when composing a message.

### Why It Matters
In a large org, a single bot name becomes noise. When everything looks the same, people stop reading. Distinct sender identities let recipients mentally triage messages before opening them. "IT Alerts" in your chat demands attention; "Fun Committee" can wait until after lunch.

### Technical Feasibility: HIGH

**How it works under the hood:**
- The Bot Framework REST API's `POST /v3/conversations/{id}/activities` payload accepts a `from` object with `name` and an `entities` array for icon overrides
- Teams respects the `from.name` field on bot-sent activities, displaying that name instead of the bot's registered display name
- This means **one bot app registration** can send messages that appear under different names — no need for multiple bot registrations or Teams app manifests

**What we'd need to build:**
- A `BotPersona` database table (Id, Name, AvatarUrl, Description, IsDefault)
- A `PersonaId` foreign key on the `Notification` entity
- Admin UI for managing personas (CRUD, avatar upload to Blob Storage)
- Compose UI: persona picker dropdown
- Modify `SendFunctionMessageSender.SendNotificationAsync()` to include `from.name` and icon in the activity payload

**Complexity:** Low-medium. Mostly new CRUD + a small change to the send path. No infrastructure changes.

**Risk:** The `from.name` override behavior may differ between personal chat and channel contexts — needs a quick proof-of-concept spike to confirm consistent behavior across both. If Teams doesn't respect the override in channels, the fallback is purely cosmetic (persona shown in the dashboard only, with the bot's registered name shown in Teams).

**Estimated effort:** 1–2 weeks

---

## Feature 2: Aggregate Engagement Stats

### What It Is
A dashboard showing how broadcasts actually perform — not just "delivered" but aggregate metrics like delivery rate, open rate (where possible), and button click-through rate. Think: "78% delivered, 42% opened the card, 12% clicked the CTA link."

### Why It Matters
Without engagement data, comms teams are flying blind. They send messages and hope for the best. Aggregate stats (not per-person tracking) give enough signal to improve content quality without creating a surveillance culture.

### Technical Feasibility: MEDIUM

**What Teams gives us natively:**
- **Delivery status:** We already track this — Succeeded, Failed, RecipientNotFound per recipient. Aggregate delivery rate is essentially free today.
- **Read receipts:** Teams has a read receipts feature for 1:1 chats, but there is **no API for bots to query read receipt data**. This is a platform limitation.
- **Card action callbacks:** When a user clicks an `Action.Submit` button on an Adaptive Card, the bot receives a callback. `Action.OpenUrl` (external links) do **not** generate a callback — the browser opens and Teams doesn't notify the bot.

**What we can actually measure:**
| Metric | Source | Available? |
|--------|--------|-----------|
| Delivery rate | SentNotification table (already tracked) | **Yes — free today** |
| Delivery failure breakdown | SentNotification.StatusCode + ErrorMessage | **Yes — free today** |
| Button clicks (internal actions) | Action.Submit callbacks to bot endpoint | **Yes — requires new work** |
| Button clicks (external URLs) | Not possible via Teams API | **No** |
| Message opens / views | No Bot API for read receipts | **No** |
| Time-to-deliver distribution | SentNotification.SentDate vs Notification.SentDate | **Yes — free today** |

**What we'd need to build:**
- **Phase A (quick win):** Analytics dashboard that visualizes what we already have — delivery rates, failure rates, send duration. This is purely a frontend + API query exercise. No backend changes needed.
- **Phase B (action tracking):** For interactive cards (polls, acknowledgments — see Feature 3), track Action.Submit callbacks. Requires a new `CardInteraction` table and handling submissions at the bot endpoint.
- **Phase C (link click tracking — optional):** Replace `Action.OpenUrl` with `Action.Submit` that logs the click, then returns an `Action.OpenUrl` response. This is a workaround that adds latency and complexity — may not be worth it.

**Complexity:** Phase A is low effort (dashboard only). Phase B is medium (requires bot endpoint changes). Phase C is high and arguably not worth the UX trade-off.

**Estimated effort:** Phase A: 3–5 days. Phase B: 1–2 weeks (builds on Feature 3). Phase C: 1 week but debatable value.

---

## Feature 3: Embedded Polls & Surveys

### What It Is
Authors can embed quick polls directly in the Adaptive Card. Recipients tap a choice right in the message — no external link, no separate app. Results aggregate in real time on the author's dashboard.

Example: "Which date works best for the all-hands? [Mon Jan 6] [Wed Jan 8] [Fri Jan 10]"

### Why It Matters
This turns one-way broadcasts into two-way conversations. Polls have dramatically higher engagement than "click this link to fill out a form" because the friction is near zero — one tap, done, the card updates with results.

### Technical Feasibility: HIGH

**How Adaptive Cards handle this:**
- Adaptive Cards support `Input.ChoiceSet` (radio buttons, dropdowns) and `Action.Submit`
- When a user submits, Teams sends the input data back to the bot endpoint as an `invoke` activity
- The bot can respond with an updated card (showing results, confirming the vote, etc.)
- This is a well-established pattern — Microsoft's own Polly app for Teams works exactly this way

**What we'd need to build:**
- **Data model:** New tables — `Poll` (PollId, NotificationId, Question, AllowMultiple) and `PollOption` (OptionId, PollId, Text, SortOrder) and `PollResponse` (ResponseId, PollId, OptionId, RespondentId, Timestamp)
- **Compose UI:** Poll builder in the card editor — add a question, add 2–5 options, toggle single/multiple choice
- **Card generation:** Extend `AdaptiveCardService` to render `Input.ChoiceSet` + `Action.Submit` when the notification has an associated poll
- **Bot endpoint:** Handle `invoke` activities for poll submissions — validate, store response, return updated card showing current results (or a "Thanks for voting" confirmation)
- **Dashboard:** Poll results view — bar chart of responses, response rate, export to CSV

**Key design decisions:**
- **Anonymous vs. identified responses?** Recommend: store RespondentId for deduplication (one vote per person) but only show aggregate results to authors. Never expose individual votes in the UI.
- **Can you change your vote?** Recommend: yes, upsert on RespondentId. Simple and expected.
- **Live results on the card?** Recommend: show results after voting (not before) to avoid anchoring bias.

**Complexity:** Medium. The Adaptive Card mechanics are well-documented. The main work is the poll builder UI, the bot invoke handler, and the results dashboard.

**Risk:** Low. This is a proven pattern in Teams. The bot endpoint already exists; it just needs a new handler for invoke activities.

**Estimated effort:** 2–3 weeks

---

## Feature 4: Message Expiry & Pinning

### What It Is
- **Expiry:** Author sets a date after which the message auto-updates to show "This message has expired" or is deleted entirely. No more outdated "Sign up by Friday!" cards lingering in chats weeks later.
- **Pinning:** Mark a message as "pinned" so it remains accessible from a dedicated view — a reference point that recipients can return to.

### Why It Matters
Stale messages erode trust in the platform. If half the messages in your chat are about events that already happened or deadlines that passed, you start ignoring all of them. Expiry keeps the signal-to-noise ratio high. Pinning ensures the important stuff is findable.

### Technical Feasibility: MIXED

**Expiry — FEASIBLE:**
- The Bot Framework REST API supports `PUT /v3/conversations/{id}/activities/{activityId}` to **update** a previously sent message, and `DELETE` to remove it
- This requires storing the `activityId` returned when the message is originally sent (we don't currently store this)
- A scheduled Azure Function (timer trigger, runs hourly) checks for expired messages and either updates them with an "expired" card or deletes them
- **What we'd need:**
  - Add `ActivityId` column to `SentNotification` (populated at send time from the API response)
  - Add `ExpiryDate` column to `Notification`
  - New timer-triggered Function that queries expired notifications and issues update/delete calls
  - Compose UI: optional expiry date picker

**Pinning — LIMITED:**
- Teams does not expose a "pin message" API for bots. Users can manually pin messages in Teams, but bots cannot trigger this programmatically.
- **Alternative approach:** Build a "Pinned Messages" tab within the Company Communicator Teams app. This is a custom view in our frontend that shows a filtered list of messages the author marked as "pinned." Recipients access it from the app's tab, not from the chat. It's not native Teams pinning, but it serves the same purpose — a reference library of important, current messages.
- **What we'd need:**
  - Add `IsPinned` boolean to `Notification`
  - API endpoint to list pinned notifications
  - Frontend tab/view showing pinned messages with search
  - Compose UI: "Pin this message" toggle

**Complexity:** Expiry is medium (new Function + activity ID storage). Pinning-as-a-tab is low (purely a filtered view). Native Teams pinning is not possible.

**Risk:** Expiry depends on storing activity IDs, which requires a change to `SendFunctionMessageSender` to capture and persist the response. The update/delete API calls must handle edge cases (message already deleted by user, conversation no longer exists, etc.). For very large broadcasts (10,000+ recipients), the expiry Function needs to batch the update/delete calls with throttling.

**Estimated effort:** Expiry: 1–2 weeks. Pinned messages tab: 3–5 days. Total: 2–3 weeks.

---

## Feature 5: Rich Media Cards

### What It Is
Go beyond text-and-a-button. Support header images with overlays, image galleries, video thumbnail cards (with a play button linking to Stream/SharePoint), countdown timers for events, and styled layouts with columns, colors, and emphasis.

### Why It Matters
The current card format works but looks utilitarian. In a world where people are used to polished content on every platform, a plain text card feels like a system notification, not a communication. Rich media makes messages feel intentional and worth reading.

### Technical Feasibility: HIGH (with caveats)

**What Adaptive Cards already support (schema v1.4+):**
| Element | Support | Notes |
|---------|---------|-------|
| Header images | **Full** | Already implemented — `Image` with `size: stretch` |
| Image galleries | **Full** | Already implemented — `ImageSet` in AdvancedBlocks |
| Multi-column layouts | **Full** | Already implemented — `ColumnSet` in AdvancedBlocks |
| Tables | **Full** | Already implemented — rendered as header + data ColumnSets |
| Styled text (bold, italic, color) | **Partial** | Adaptive Cards support markdown in TextBlocks, plus `color`, `weight`, `size` attributes. No arbitrary CSS. |
| Background images/colors | **Partial** | `backgroundImage` on containers works, but behavior varies by Teams client (desktop vs. mobile vs. web) |
| Video (inline playback) | **No** | Adaptive Cards do not support inline video. Best approach: thumbnail image + "Watch" button that opens Stream/SharePoint URL |
| Countdown timers | **No** | Adaptive Cards are static — no JavaScript, no dynamic content. Workaround: render the date prominently and include "X days left" text calculated at send time (but it won't update) |
| Animated GIFs | **Partial** | Teams renders GIFs in Image elements, but file size limits apply and some mobile clients don't animate |
| Custom fonts/CSS | **No** | Not supported. Cards use the Teams design system. |

**What we'd need to build:**
- **Phase A (card builder upgrade):** Enhance the compose UI with a visual card builder — drag-and-drop blocks for text, images, dividers, columns, buttons. Live preview. This is primarily a frontend project; the backend `AdvancedBlocks` JSON schema already supports arbitrary block types.
- **Phase B (new block types):** Add video thumbnail block (image + overlay play icon + OpenUrl action), styled text block (size, weight, color, alignment options), and background image support for containers.
- **Phase C (templates):** Pre-built card templates — "Event Invitation," "Urgent Alert," "Newsletter," "Welcome Message" — that authors can select and customize. Stored in a `Template` table with the card JSON pre-filled.

**Complexity:** Phase A is the largest lift (visual card builder is a significant frontend project). Phase B is small (new block type handlers in `AdaptiveCardService`). Phase C is medium (template CRUD + template picker UI).

**Risk:** The main risk is scope creep — a "card builder" can easily become a full design tool. Recommend keeping it constrained: predefined block types with simple options, not a freeform layout editor. The existing `AdvancedBlocks` architecture is well-suited for this approach.

**Estimated effort:** Phase A: 2–3 weeks. Phase B: 1 week. Phase C: 1 week. Total: 4–5 weeks (but phases are independent and can be shipped incrementally).

---

## Summary & Recommended Sequencing

| # | Feature | Feasibility | Effort | Dependencies |
|---|---------|-------------|--------|-------------|
| 1 | Bot Personas | High | 1–2 weeks | None |
| 2 | Aggregate Engagement Stats | Medium | 1–3 weeks | Phase B needs Feature 3 |
| 3 | Embedded Polls & Surveys | High | 2–3 weeks | None |
| 4 | Message Expiry & Pinning | Medium | 2–3 weeks | None |
| 5 | Rich Media Cards | High | 4–5 weeks | None |

### Recommended build order

**Wave 1 — Quick wins, immediate value:**
1. **Bot Personas** — Low effort, high visual impact. Changes how the tool *feels* from day one.
2. **Engagement Stats Phase A** — Dashboard for delivery metrics we already have. No backend changes.

**Wave 2 — Interactivity:**
3. **Embedded Polls** — Transforms the tool from broadcast to two-way. High engagement potential.
4. **Engagement Stats Phase B** — Now that we have interactive cards, track the interactions.

**Wave 3 — Content quality:**
5. **Rich Media Cards** — Better card builder, templates, video thumbnails.
6. **Message Expiry** — Keep content fresh, auto-clean stale messages.

**Wave 4 — Polish:**
7. **Pinned Messages tab** — Reference library for important ongoing messages.
8. **Engagement Stats Phase C** — Link click tracking (if warranted).

### What's deliberately excluded
- Per-recipient read tracking (privacy concern, no API support)
- Native Teams message pinning (no API)
- Inline video playback (Adaptive Card limitation)
- Countdown timers that update in real time (Adaptive Card limitation)

---

*This document is a feasibility assessment for discussion purposes. Effort estimates assume a single developer familiar with the codebase. Actual timelines will depend on team capacity, testing requirements, and whether features are shipped incrementally or as a batch.*
