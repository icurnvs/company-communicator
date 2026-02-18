# Company Communicator - Component Inventory

## Backend Classes & Responsibilities

### Web App (CompanyCommunicator/)

#### Controllers
| Class | File | Responsibility |
|-------|------|---------------|
| BotController | Controllers/BotController.cs | Routes bot messages to /api/messages/user and /api/messages/author |
| DraftNotificationsController | Controllers/DraftNotificationsController.cs | CRUD for draft messages, submit for sending |
| SentNotificationsController | Controllers/SentNotificationsController.cs | Query sent messages, cancel, request export |
| DeleteMessagesController | Controllers/DeleteMessagesController.cs | Message deletion with UPN authorization |
| ExportController | Controllers/ExportController.cs | Data export operations |
| TeamDataController | Controllers/TeamDataController.cs | Team information queries |
| GroupDataController | Controllers/GroupDataController.cs | M365 group queries via Graph API |
| HealthController | Controllers/HealthController.cs | Health check endpoint |

#### Bot Handlers
| Class | File | Responsibility |
|-------|------|---------------|
| AuthorTeamsActivityHandler | Bot/AuthorTeamsActivityHandler.cs | Author bot: file uploads, channel events, service URL tracking |
| UserTeamsActivityHandler | Bot/UserTeamsActivityHandler.cs | User bot: member add/remove, team renames, data capture |
| CompanyCommunicatorBotAdapter | Bot/CompanyCommunicatorBotAdapter.cs | CloudAdapter extension with filter middleware |
| CompanyCommunicatorBotFilterMiddleware | Bot/CompanyCommunicatorBotFilterMiddleware.cs | Tenant filtering middleware |
| TeamsDataCapture | Bot/TeamsDataCapture.cs | Captures team/user data during conversations |
| TeamsFileUpload | Bot/TeamsFileUpload.cs | Handles file consent flow for attachments |

#### Authentication
| Class | File | Responsibility |
|-------|------|---------------|
| AuthenticationOptions | Authentication/AuthenticationOptions.cs | Config model for AAD settings |
| AuthenticationServiceCollectionExtensions | Authentication/AuthenticationServiceCollectionExtensions.cs | DI registration for auth services |
| GraphTokenProvider | Authentication/GraphTokenProvider.cs | IAuthenticationProvider for Graph SDK |
| MSGraphScopeHandler | Authentication/MSGraphScopeHandler.cs | Authorization handler for Graph scopes |
| MustBeValidUpnHandler | Authentication/MustBeValidUpnHandler.cs | Authorization: validates creator UPN |
| MustBeValidDeleteUpnHandler | Authentication/MustBeValidDeleteUpnHandler.cs | Authorization: validates delete UPN |

### Common Library (CompanyCommunicator.Common/)

#### Repositories
| Class | File | Responsibility |
|-------|------|---------------|
| BaseRepository\<T\> | Repositories/BaseRepository.cs | Abstract base: CRUD, batch, filter, pagination over Azure Table Storage |
| NotificationDataRepository | Repositories/NotificationData/ | Draft/Sent notification CRUD, partition management, blob image storage |
| SentNotificationDataRepository | Repositories/SentNotificationData/ | Per-recipient delivery result tracking |
| SendingNotificationDataRepository | Repositories/SendingNotificationData/ | Active sending state, Adaptive Card content storage |
| UserDataRepository | Repositories/UserData/ | User cache from Graph, delta link management |
| TeamDataRepository | Repositories/TeamData/ | Team metadata storage |
| ExportDataRepository | Repositories/ExportData/ | Export job tracking |
| AppConfigRepository | Repositories/AppConfig/ | Configuration entity storage |
| CleanUpHistoryRepository | Repositories/CleanUpHistory/ | Audit trail of deleted messages |
| GlobalSendingNotificationDataRepository | Repositories/ | Global throttle state management |

#### Data Entities
| Entity | Storage | PartitionKey | Key Fields |
|--------|---------|-------------|------------|
| NotificationDataEntity | Table | "DraftNotifications" / "SentNotifications" | Title, Summary, ImageLink, Audience, Status, Counts |
| SentNotificationDataEntity | Table | NotificationId | RecipientId, StatusCode, DeliveryStatus, ConversationId |
| SendingNotificationDataEntity | Table | Sending partition | NotificationId, Content (serialized card) |
| UserDataEntity | Table | "UserData" | AadId, Name, Email, UPN, ConversationId, UserId |
| TeamDataEntity | Table | Default | TeamId, Name, ServiceUrl, TenantId |
| ExportDataEntity | Table | Default | ExportId, Status, ContentUrl, ErrorMessage |
| GlobalSendingNotificationDataEntity | Table | Global | SendRetryDelayTime (throttle state) |

#### Services
| Class | File | Responsibility |
|-------|------|---------------|
| MessageService | Services/CommonBot/MessageService.cs | Sends Adaptive Cards via Bot Framework with Polly retry |
| ConversationService | Services/CommonBot/ConversationService.cs | Creates proactive 1:1 conversations |
| UsersService | Services/MicrosoftGraph/UsersService.cs | Graph API: user enumeration, delta sync, license check, batch requests |
| GroupMembersService | Services/MicrosoftGraph/GroupMembersService.cs | Graph API: group/DL/SG member listing |
| AppManagerService | Services/MicrosoftGraph/AppManagerService.cs | Graph API: Teams app lifecycle |
| AppCatalogService | Services/MicrosoftGraph/AppCatalogService.cs | Graph API: app catalog queries |
| ChatsService | Services/MicrosoftGraph/ChatsService.cs | Graph API: chat/conversation management |
| GraphServiceFactory | Services/MicrosoftGraph/GraphServiceFactory.cs | DI factory for Graph service instances |
| RecipientsService | Services/Recipients/RecipientsService.cs | Batches recipients into partition keys |
| TeamMembersService | Services/Teams/TeamMembersService.cs | Team roster synchronization |

#### Queue Abstractions
| Class | Queue Name | Message Type |
|-------|-----------|-------------|
| BaseQueue\<T\> | - | Abstract base: send, batch, delayed send |
| PrepareToSendQueue | cc-prepare-to-send-queue | PrepareToSendQueueMessageContent |
| SendQueue | cc-send-queue | SendQueueMessageContent |
| DataQueue | cc-data-queue | DataQueueMessageContent |
| ExportQueue | cc-export-queue | ExportQueueMessageContent |

#### Bot Adapters
| Class | File | Responsibility |
|-------|------|---------------|
| CCBotAdapterBase | Adapter/CCBotAdapterBase.cs | Base adapter with retry and error handling |
| CCBotAdapter | Adapter/CCBotAdapter.cs | Adapter for proactive messaging |
| CCBotFrameworkHttpAdapter | Adapter/CCBotFrameworkHttpAdapter.cs | HTTP adapter for incoming bot messages |

### Prep Function (CompanyCommunicator.Prep.Func/)

#### Functions & Orchestrators
| Class | Trigger | Responsibility |
|-------|---------|---------------|
| PrepareToSendFunction | Service Bus (prepare queue) | Entry point: starts durable orchestration |
| PrepareToSendOrchestrator | Durable (orchestrator) | Main flow: store -> sync -> convo -> queue |
| SyncRecipientsOrchestrator | Durable (sub-orchestrator) | Branches by audience type for recipient sync |
| TeamsConversationOrchestrator | Durable (sub-orchestrator) | Fan-out conversation creation |
| SendQueueOrchestrator | Durable (sub-orchestrator) | Fan-out message queuing in 100-msg batches |
| ExportFunction | Service Bus (export queue) | Entry point for export operations |
| ExportOrchestration | Durable (orchestrator) | Export workflow orchestration |

#### Activities
| Activity | Responsibility |
|----------|---------------|
| SyncAllUsersActivity | Graph delta sync for all org users |
| SyncTeamMembersActivity | Graph sync for specific team members |
| SyncGroupMembersActivity | Graph sync for M365 group members |
| SyncTeamsActivity | Team information sync |
| RecipientsActivity | Batch recipients into partition keys |
| StoreMessageActivity | Serialize Adaptive Card to storage |
| TeamsConversationActivity | Create proactive 1:1 conversations |
| SendBatchMessagesActivity | Queue 100-message batches to SendQueue |
| DataAggregationTriggerActivity | Trigger result aggregation polling |
| UpdateNotificationStatusActivity | Update notification status |
| HandleFailureActivity | Log errors to notification entity |
| GetMetadataActivity | (Export) Get export metadata |
| UploadActivity | (Export) Upload export file |
| UpdateExportDataActivity | (Export) Update export status |
| SendFileCardActivity | (Export) Send file download card |
| HandleExportFailureActivity | (Export) Handle export errors |

### Send Function (CompanyCommunicator.Send.Func/)

| Class | Trigger | Responsibility |
|-------|---------|---------------|
| SendFunction | Service Bus (send queue) | Per-recipient message delivery with retry/throttle |
| ScheduleSendFunction | Timer (every 5 min) | Check and trigger scheduled notifications |
| NotificationService | - | Pre-flight checks, throttle detection, status updates |

### Data Function (CompanyCommunicator.Data.Func/)

| Class | Trigger | Responsibility |
|-------|---------|---------------|
| CompanyCommunicatorDataFunction | Service Bus (data queue) | Result aggregation and notification finalization |
| AggregateSentNotificationDataService | - | Count delivery results by status |
| UpdateNotificationDataService | - | Determine completion state and update |

---

## Frontend Components

### Pages / Routes
| Component | File | Type | Responsibility |
|-----------|------|------|---------------|
| App | App.tsx | Functional | Root: routing, theme, Teams init |
| HomePage | components/Home/homePage.tsx | Functional | Main dashboard with accordion sections |
| NewMessage | components/NewMessage/newMessage.tsx | Functional | Message composition form (800+ lines) |
| SignInPage | components/SignInPage/ | Functional | Authentication flow |
| ErrorPage | components/ErrorPage/errorPage.tsx | Functional | Error display |
| Configuration | components/config.tsx | **Class** | Teams tab configuration |

### List Components
| Component | File | Responsibility |
|-----------|------|---------------|
| DraftMessages | components/DraftMessages/draftMessages.tsx | Draft message list |
| SentMessages | components/SentMessages/sentMessages.tsx | Sent message list |
| ScheduledMessages | components/ScheduledMessages/scheduledMessages.tsx | Scheduled message list |
| DeleteMessages | components/DeleteMessages/deleteMessages.tsx | Message deletion interface |

### Detail / Task Components
| Component | File | Responsibility |
|-----------|------|---------------|
| DraftMessageDetail | components/DraftMessages/draftMessageDetail.tsx | Draft message detail view |
| SentMessageDetail | components/SentMessages/sentMessageDetail.tsx | Sent message detail view |
| ScheduledMessageDetail | components/ScheduledMessages/scheduledMessageDetail.tsx | Scheduled message detail |
| DeleteMessagesDetail | components/DeleteMessages/deleteMessagesDetail.tsx | Delete message detail |
| SendConfirmationTask | components/SendConfirmationTask/ | Send confirmation dialog |
| DeleteConfirmationTask | components/DeleteMessages/deleteConfirmationTask.tsx | Delete confirmation dialog |
| ViewStatusTask | components/ViewStatusTask/ | Delivery status view |
| PreviewMessageConfirmation | components/PreviewMessageConfirmation/ | Message preview dialog |

### Shared / Utility
| Component | File | Responsibility |
|-----------|------|---------------|
| Header | components/header.tsx | App header bar |
| AdaptiveCard | components/AdaptiveCard/adaptiveCard.ts | Adaptive Card manipulation utilities |
| useInterval | hooks/useInterval.tsx | Polling mechanism hook |

### State Management
| File | Responsibility |
|------|---------------|
| store.ts | Redux Toolkit store configuration |
| messagesSlice.ts | Single Redux slice (all app state) |
| actions.ts | Async side effects (API calls -> dispatch) |

### API Layer
| File | Responsibility |
|------|---------------|
| apis/apiDecorator.ts | Fetch wrapper with Teams token injection |
| apis/messageListApi.ts | ~14 API endpoint functions |
