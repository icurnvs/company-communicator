# Company Communicator - Message Flow: Draft to Delivery

## Overview

This document traces the complete lifecycle of a notification from draft creation through delivery and result aggregation.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───▶│  QUEUED  │───▶│ PREPARE  │───▶│  SEND    │───▶│ COMPLETE │
│ Creation │    │ Submitted│    │ Orchestr.│    │ Delivery │    │ Aggreg.  │
│ (Web App)│    │ (Web App)│    │(Prep.Func│    │(Send.Func│    │(Data.Func│
│          │    │          │    │ Durable) │    │ per-rcpt)│    │ polling) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Phase 1: Draft Creation

**Actor:** Author (via React SPA in Teams tab)
**Component:** DraftNotificationsController + NewMessage React component

### Steps
1. Author opens the Company Communicator tab in Teams
2. Composes message: Title, Summary, Image, Button (Title + URL)
3. Selects audience:
   - **All Users** - entire organization
   - **Teams** - specific Teams channels
   - **Rosters** - members of specific Teams
   - **Groups** - M365 groups, distribution lists, security groups
4. Optionally sets a scheduled send date/time

### Data Created
```
NotificationDataEntity:
  PartitionKey = "DraftNotifications"
  RowKey = new GUID
  Title, Summary, ImageLink, ButtonTitle, ButtonLink
  TeamsInString = JSON array of team IDs
  RostersInString = JSON array of team IDs (for member enumeration)
  GroupsInString = JSON array of group IDs
  AllUsers = true/false
  CreatedBy = author UPN
  CreatedDate = now
  Status = Draft
  IsScheduled = false (or true with ScheduledDate)
```

If image attached: stored as base64 in Blob Storage, BlobName saved in entity.

---

## Phase 2: Submit for Sending

**Actor:** Author clicks "Send" (or timer fires for scheduled messages)
**Component:** DraftNotificationsController.PostAsync() or ScheduleSendFunction

### Steps
1. `MoveDraftToSentPartitionAsync()`:
   - Creates new entity with PartitionKey = "SentNotifications"
   - Generates new RowKey (sent notification ID)
   - Sets Status = "Queued", SendingStartedDate = now
   - Deletes the draft entity
2. Sends message to **PrepareToSendQueue** (Service Bus):
   ```json
   { "NotificationId": "<new-sent-notification-id>" }
   ```
3. Returns new SentNotificationId to the UI

### For Scheduled Messages
- `ScheduleSendFunction` runs every 5 minutes (timer trigger: `0 */5 * * * *`)
- Queries notifications where IsScheduled=true AND ScheduledDate <= now
- Performs same MoveDraftToSent + queue steps
- Also sends a delayed DataQueue message (24-hour delay) as a safety net

---

## Phase 3: Prepare to Send (Durable Functions Orchestration)

**Actor:** Prep.Func Azure Function
**Component:** PrepareToSendFunction -> PrepareToSendOrchestrator

### 3.1: Entry Point
1. `PrepareToSendFunction` triggered by Service Bus message
2. Retrieves notification from SentNotifications table
3. Starts `PrepareToSendOrchestrator` durable function instance
4. Stores orchestration HTTP management payload in notification entity (for monitoring)

### 3.2: Store Message Template
1. `StoreMessageActivity` serializes the Adaptive Card JSON
2. Stores in `SendingNotificationDataEntity` (Table Storage)
3. Also stored in Blob Storage for Send.Func to cache

### 3.3: Sync Recipients (Sub-Orchestrator)
`SyncRecipientsOrchestrator` branches based on audience type:

#### All Users Path
```
SyncAllUsersActivity:
  1. Call UsersService.GetAllUsersAsync() with delta link (incremental sync)
  2. Page through all users from Microsoft Graph
  3. For each user:
     a. Filter out guest users (UserType != "Guest")
     b. Verify Teams license (check service plan GUIDs)
     c. Store/update UserDataEntity in UserData table
     d. Create SentNotificationDataEntity:
        - PartitionKey = NotificationId
        - RowKey = user's AAD ID
        - StatusCode = 0 (Initialization)
        - ConversationId = existing value or null
  4. Batch insert (100 per batch operation)
```

#### Rosters Path (Team Members)
```
For each team in Rosters[]:
  SyncTeamMembersActivity:
    1. Call Graph API for team members
    2. Same filtering and entity creation as All Users
```

#### Groups Path (M365 Groups/DLs/SGs)
```
For each group in Groups[]:
  SyncGroupMembersActivity:
    1. Call GroupMembersService for group members
    2. Same filtering and entity creation as All Users
```

#### Teams Path (Channel Messages)
```
SyncTeamsActivity:
  1. Sync team information
  2. Create SentNotificationDataEntity with RecipientType="Team"
```

**Output:** `RecipientsInfo`
- TotalRecipientCount
- BatchKeys (partition keys for batched processing)
- HasRecipientsPendingInstallation (recipients without ConversationId)

### 3.4: Create Conversations (if needed)
If recipients exist without a ConversationId (bot hasn't chatted with them before):

```
Update Status -> "InstallingApp"

TeamsConversationOrchestrator (fan-out per batch):
  For each batch:
    1. GetPendingRecipientsActivity - query recipients with null ConversationId
    2. For each pending recipient:
       a. ConversationService.CreateUserConversationAsync()
       b. Bot Framework API creates proactive 1:1 chat
       c. Update SentNotificationDataEntity with:
          - ConversationId (the 1:1 chat ID)
          - ServiceUrl (Bot Framework service endpoint)
          - TenantId
          - UserId (Teams-specific user ID, "29:...")
```

### 3.5: Queue Send Messages
```
Update Status -> "Sending"

DataAggregationTriggerActivity:
  - Send DataQueue message (starts result polling)

SendQueueOrchestrator (fan-out per batch key):
  For each batch:
    1. GetRecipientsActivity - read all recipients in batch
    2. Break into 100-message chunks
    3. For each chunk:
       SendBatchMessagesActivity:
         - Create SendQueueMessageContent per recipient
         - Batch send to SendQueue (max 100 per Service Bus call)
```

---

## Phase 4: Deliver Messages

**Actor:** Send.Func Azure Function (one invocation per recipient)
**Component:** SendFunction

### Pre-Flight Checks
```
1. IsNotificationCanceled?     -> If yes: return (no-op)
2. IsRecipientGuestUser?       -> If yes: mark NotSupported, return
3. IsPendingNotification?      -> Must be StatusCode 0 or -1
4. Has ConversationId?         -> If no: mark Failed, return
5. IsSendNotificationThrottled? -> If yes: re-queue with delay, return
```

### Message Delivery
```
1. Get Adaptive Card:
   a. Check IMemoryCache (key: "sentcard_{NotificationId}", TTL: 24 hours)
   b. If cache miss: download from Blob Storage, cache it

2. MessageService.SendMessageAsync():
   a. Build ConversationReference (ServiceUrl + ConversationId)
   b. Create Activity with Adaptive Card attachment
   c. Send via Bot Framework with Polly retry policy:
      - 3 attempts, exponential backoff (1s median)
      - Retry on: 429, 5xx
      - No retry on: 201, 404
```

### Response Handling
```
201 (Success):
  - StatusCode = 201
  - DeliveryStatus = "Succeeded"
  - SentDate = now
  - NumberOfFunctionAttemptsToSend++

429 (Throttled):
  - Set global throttle: SendRetryDelayTime = now + delay
  - Re-queue message with delay (default: 660 seconds)
  - Update throttle counts

404 (Not Found):
  - DeliveryStatus = "RecipientNotFound"
  - Final status (no retry)

Other Error (4xx/5xx):
  - If delivery count < 10:
    - StatusCode = -1 (FaultedAndRetrying)
    - Service Bus will automatically redeliver
  - If delivery count >= 10:
    - StatusCode = -2 (FinalFaulted)
    - Dead-lettered, no more retries

All cases: Update SentNotificationDataEntity with:
  - StatusCode, DeliveryStatus, ErrorMessage
  - AllSendStatusCodes (comma-separated history)
  - TotalNumberOfSendThrottles
  - NumberOfFunctionAttemptsToSend
  - SentDate (if delivered)
```

---

## Phase 5: Aggregate Results

**Actor:** Data.Func Azure Function (self-requeuing poller)
**Component:** CompanyCommunicatorDataFunction

### Aggregation Loop
```
1. Receive DataQueue message (NotificationId + ForceComplete flag)

2. If notification already Status=Sent or Status=Canceled:
   -> Return (no-op, already finalized)

3. AggregateSentNotificationDataService:
   a. Query all SentNotificationData rows for this NotificationId
   b. Filter where DeliveryStatus != null (only processed recipients)
   c. Count by status:
      - Succeeded (StatusCode = 201)
      - Failed (StatusCode = -2 or other permanent failure)
      - RecipientNotFound (StatusCode = 404)
      - Throttled (still retrying)
   d. Track LastSentDate (most recent successful delivery)

4. Completion Decision:
   ┌─────────────────────────────────────────────────────────┐
   │ If (currentTotal >= expectedTotal):                     │
   │   Status = "Sent", Unknown = 0, SentDate = LastSentDate│
   │                                                        │
   │ Else If orchestration Completed/Terminated:             │
   │   If all accounted: Status = "Sent"                    │
   │   Else: Status = "Canceled", Canceled = difference     │
   │                                                        │
   │ Else If ForceMessageComplete = true:                   │
   │   Status = "Sent", Unknown = difference                │
   │                                                        │
   │ Else:                                                  │
   │   NOT COMPLETE -> re-queue with adaptive delay          │
   │   - First 10 min: 10-second delay                      │
   │   - After 10 min: 60-second delay                      │
   └─────────────────────────────────────────────────────────┘

5. Update NotificationDataEntity:
   - Succeeded, Failed, RecipientNotFound, Throttled, Unknown, Canceled counts
   - Status = "Sent" or "Canceled"
   - SentDate
```

### Safety Net
- A delayed DataQueue message (24-hour delay) with ForceMessageComplete=true ensures notifications always complete, even if the aggregation loop stalls.

---

## Status Lifecycle

```
Draft ──▶ Queued ──▶ SyncingRecipients ──▶ InstallingApp ──▶ Sending ──▶ Sent
                                                                    └──▶ Failed
                                                                    └──▶ Canceled

Cancel flow: Any status ──▶ Canceling ──▶ Canceled
```

### Per-Recipient Status Codes
| Code | Meaning |
|------|---------|
| 0 | Initialization (not yet attempted) |
| -1 | Faulted and Retrying |
| -2 | Final Faulted (dead-lettered) |
| -3 | Not Supported (guest user) |
| 201 | Successfully delivered |
| 404 | Recipient not found |
| 429 | Throttled (will retry) |

---

## Sequence Diagram (Simplified)

```
Author    Web App      Prep.Func       Send.Func      Data.Func     Graph API
  │          │              │               │              │              │
  │─Submit──▶│              │               │              │              │
  │          │─Queue msg───▶│               │              │              │
  │          │              │──Get users───▶│              │              │
  │          │              │◀─Users list───│              │              │
  │          │              │               │              │              │
  │          │              │──Create convos (Bot Framework)│              │
  │          │              │               │              │              │
  │          │              │──Queue sends─▶│              │              │
  │          │              │──Queue data──▶│              │──▶│          │
  │          │              │               │              │              │
  │          │              │               │─Send card───▶│(Teams user) │
  │          │              │               │◀─201/429/etc─│              │
  │          │              │               │─Update status│              │
  │          │              │               │              │              │
  │          │              │               │              │─Aggregate───│
  │          │              │               │              │─Update notif│
  │          │              │               │              │              │
  │◀─Poll────│◀─────────────────────────────────────Status─┘              │
```
