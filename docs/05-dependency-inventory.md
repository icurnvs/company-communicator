# Company Communicator - Dependency Inventory

## Backend NuGet Packages

### CompanyCommunicator (Web App)
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| Microsoft.Bot.Builder.Integration.AspNet.Core | 4.21.2 | Current-ish | Latest 4.x |
| Microsoft.Identity.Web | 2.13.4 | Needs update | Latest 2.x or 3.x |
| Microsoft.Identity.Web.MicrosoftGraph | 2.13.4 | Needs update | Latest |
| Microsoft.AspNetCore.SpaServices.Extensions | - | Deprecated in .NET 8 | Use Vite proxy |
| AdaptiveCards | 1.2.4 | Outdated | 3.x |
| Newtonsoft.Json | 13.0.1 | Functional | System.Text.Json |

### CompanyCommunicator.Common (Shared Library)
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| Microsoft.Azure.Cosmos.Table | 1.0.1 | **DEPRECATED** | Azure.Data.Tables 12.x |
| Azure.Storage.Blobs | 12.14.1 | Needs update | Latest 12.x |
| Azure.Messaging.ServiceBus | 7.15.0 | Needs update | Latest 7.x |
| Microsoft.Graph | 3.22.0 | **OUTDATED** | 5.x+ |
| Microsoft.Graph.Core | 1.24.0 | **OUTDATED** | Bundled with Graph 5.x |
| Microsoft.Identity.Client | 4.56.0 | Needs update | Latest 4.x |
| Microsoft.Bot.Builder | 4.21.2 | Current-ish | Latest 4.x |
| Microsoft.Bot.Connector | 4.21.2 | Current-ish | Latest 4.x |
| Microsoft.Bot.Schema | 4.21.2 | Current-ish | Latest 4.x |
| Polly | 7.2.1 | Outdated | 8.x+ |
| Polly.Contrib.WaitAndRetry | 1.1.1 | Outdated | Built into Polly 8 |
| Newtonsoft.Json | 13.0.1 | Functional | System.Text.Json |

### CompanyCommunicator.Prep.Func (Preparation Function)
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| Microsoft.Azure.WebJobs.Extensions.DurableTask | 2.9.6 | Current-ish | Latest 2.x |
| Microsoft.Azure.WebJobs.Extensions.ServiceBus | - | Needs check | Latest |
| Microsoft.NET.Sdk.Functions | - | Azure Functions v4 | v4 isolated model |

### CompanyCommunicator.Send.Func (Send Function)
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| Microsoft.Extensions.Caching.Memory | - | Current | - |
| Azure Functions v4 packages | - | In-process model | Isolated worker model |

### CompanyCommunicator.Data.Func (Data Function)
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| Same Azure Functions v4 packages | - | In-process model | Isolated worker model |

---

## Frontend npm Packages

### Production Dependencies
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| react | 18.2.0 | Current | 19.x available |
| react-dom | 18.2.0 | Current | 19.x available |
| react-router-dom | 6.11.2 | Slightly behind | Latest 6.x (6.20+) |
| @reduxjs/toolkit | 1.9.5 | Needs update | 2.x |
| react-redux | 8.0.5 | Needs update | 9.x |
| typescript | 3.9.7 | **SEVERELY OUTDATED** | 5.3+ |
| @fluentui/react | 8.110.3 | **LEGACY** | Remove (use v9 only) |
| @fluentui/react-components | 9.20.2 | Current-ish | Latest 9.x |
| @fluentui/react-datepicker-compat | 0.1.4 | Bridge | Use v9 native |
| @fluentui/react-icons | - | Current | - |
| @microsoft/teams-js | 2.11.0 | Current | Latest 2.x |
| i18next | 22.5.0 | Needs update | 23.x |
| react-i18next | 12.3.1 | Needs update | 14.x |
| i18next-browser-languagedetector | 7.0.1 | Current-ish | Latest |
| i18next-http-backend | 2.2.1 | Current-ish | Latest |
| moment | 2.29.4 | **MAINTENANCE ONLY** | date-fns or dayjs |
| adaptivecards | 1.2.0 | Outdated | 3.x |
| markdown-it | 13.0.1 | Current-ish | Latest |
| validator | 13.9.0 | Current-ish | Latest |
| color-hash | 2.0.2 | Current | - |
| faker | 5.5.3 | **DEPRECATED** (wrong location) | @faker-js/faker (devDep) |
| font-awesome | 4.7.0 | **VERY OLD** | Remove (use Fluent Icons) |
| sass | 1.62.1 | Needs update | Latest |
| typestyle | 2.4.0 | Current | Consider removal |

### Dev Dependencies
| Package | Version | Status | Replacement |
|---------|---------|--------|-------------|
| eslint | 8.41.0 | Current-ish | 9.x available |
| @typescript-eslint/eslint-plugin | 5.59.7 | Outdated | 7.x (matches TS 5.x) |
| @typescript-eslint/parser | 5.59.7 | Outdated | 7.x |
| eslint-plugin-react | 7.32.2 | Current-ish | Latest |
| eslint-config-standard-with-typescript | 34.0.1 | Current-ish | Latest |
| react-scripts | 5.0.1 | Stable but slow | Vite |

### Overrides (Security Patches)
| Package | Version | Reason |
|---------|---------|--------|
| @babel/traverse | 7.23.9 | Security vulnerability patch |

---

## Azure Functions Runtime

| Aspect | Current | Recommended |
|--------|---------|-------------|
| Runtime | v4 | v4 (current) |
| Hosting Model | **In-process** | **Isolated worker** (recommended for .NET 8+) |
| .NET Version | 6.0 | 8.0 LTS or 9.0 |

**Note:** Azure Functions in-process model for .NET 6 reaches end of support. Migration to isolated worker model is required for .NET 8+.

---

## Deployment Tools

| Tool | Version Requirement | Status | Replacement |
|------|-------------------|--------|-------------|
| Azure CLI | >= 2.49.0 | Current | - |
| PowerShell Az Module | - | Current | - |
| AzureAD PowerShell Module | - | **RETIRED (March 2024)** | Microsoft.Graph PowerShell |
| WriteAscii PowerShell Module | - | Optional/cosmetic | Remove |
| Node.js | 16.x | **EOL Sept 2023** | 20.x LTS |
| .NET SDK | 6.0.x | **EOL Nov 2024** | 8.0.x LTS |
| MSBuild | 14.0 (referenced) | **VS 2015 era** | dotnet CLI |
| nuget.exe | Referenced | Legacy | dotnet restore |
| jq | External | Fragile dependency | ConvertFrom-Json |
