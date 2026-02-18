# Company Communicator - Technical Debt Assessment

## Executive Summary

The Company Communicator project was last actively maintained circa 2022-2023. It has accumulated significant technical debt across all layers: infrastructure, backend, frontend, and deployment. This document catalogs every identified issue, ranked by severity and organized by component.

---

## Severity Definitions

| Level | Definition |
|-------|-----------|
| **CRITICAL** | Security risk, out-of-support runtime, or blocking incompatibility. Must be addressed before any production deployment. |
| **HIGH** | Deprecated libraries/APIs that will stop working, or patterns that significantly impair maintainability. |
| **MEDIUM** | Outdated but functional. Creates developer friction or technical risk over time. |
| **LOW** | Minor improvements. Nice-to-have modernizations. |

---

## 1. Infrastructure & Deployment

### CRITICAL

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| I-1 | ARM template API versions from 2015-2017 | Deployment/azuredeploy.json | Web/Sites/config uses 2015-08-01 (10+ years old). Multiple resources use 2016-2017 APIs. These may lose support at any time. |
| I-2 | OAuth2 implicit flow enabled | Deployment/deploy.ps1 | `--oauth2-allow-implicit-flow` parameter used during app registration. Implicit flow is a security risk and has been deprecated in AAD. |
| I-3 | AzureAD PowerShell module deprecated | Deployment/deploy.ps1 | Uses Get-AzureADApplication, New-AzureADApplication, etc. Module was retired March 2024. Must migrate to Microsoft.Graph PowerShell SDK. |

### HIGH

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| I-4 | No Bicep or Terraform | Deployment/ | Raw ARM JSON templates (1,349 lines for main template). Extremely hard to maintain. Should convert to Bicep. |
| I-5 | Service Bus Basic tier | azuredeploy.json:353 | No dead-letter queues, no transactions, no scaling. Messages can be silently lost on persistent failure. |
| I-6 | Government cloud templates incomplete | Deployment/GCCH/, DOD/ | GCCH and DOD templates only deploy Log Analytics, App Insights, and Bot Service. Missing: Storage, Service Bus, Functions, App Service. |
| I-7 | Legacy Kudu/KuduSync deployment | deploy.app.cmd, deploy.function.cmd | Kudu is legacy. deploy.app.cmd references MSBuild 14.0 (VS 2015). deploy.function.cmd uses nuget.exe + MSBuild 16.70. |
| I-8 | Teams manifest schema v1.5 | Manifest/*.json | Current schema version is 1.13+. Missing features: meeting extensions, adaptive card actions, stage view, etc. |
| I-9 | Key Vault uses access policies | azuredeploy.json | Should use RBAC model (recommended since 2021). |
| I-10 | Node 16.x in CI/CD | azure-pipelines.yml:17 | Node 16 EOL was September 2023. Should be Node 20.x LTS. |

### MEDIUM

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| I-11 | No autoscaling policies | azuredeploy.json | Manual hostingPlanSize selection. No auto-scale rules for production workloads. |
| I-12 | No CDN for static assets | - | React SPA served directly from App Service. No caching layer. |
| I-13 | Triple authentication in deploy script | deploy.ps1 | Requires Connect-AzAccount, az login, AND Connect-AzureAD separately. |
| I-14 | External jq dependency | deploy.ps1 | PowerShell script pipes az cli output to jq. Should use ConvertFrom-Json. |
| I-15 | Hard-coded 2-minute timeout | deploy.ps1 | Source control sync waits 120 seconds. May fail on slow networks. |
| I-16 | npm --legacy-peer-deps in CI | azure-pipelines.yml:27 | Indicates unresolved peer dependency conflicts. |
| I-17 | No rollback strategy documented | - | No procedure for failed deployments. |
| I-18 | Front Door API version 2019-04-01 | azuredeploy.json | Should be 2022-05-01+. |

---

## 2. Backend (.NET)

### CRITICAL

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| B-1 | .NET 6.0 out of support | All .csproj files | .NET 6 LTS ended November 2024. Must upgrade to .NET 8 (LTS) or .NET 9. |
| B-2 | Multi-tenant bot architecture | Bot/ | Microsoft is deprecating multi-tenant bot registrations. Must migrate to single-tenant. |
| B-3 | Microsoft.Azure.Cosmos.Table v1 deprecated | CompanyCommunicator.Common.csproj | Package replaced by Azure.Data.Tables. Will stop receiving updates/patches. |

### HIGH

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| B-4 | Microsoft.Graph v3 | All projects | Current version is v5+. v3 is no longer maintained. Missing latest Graph API features. |
| B-5 | 3 AAD app registrations required | Deployment + appsettings.json | Complex setup and maintenance. Modern Teams Toolkit supports single app registration. |
| B-6 | .NET Standard 2.1 for Common library | CompanyCommunicator.Common.csproj | Should target .NET 8 directly. .NET Standard 2.1 limits available APIs. |

### MEDIUM

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| B-7 | Newtonsoft.Json throughout | All projects | System.Text.Json is the .NET standard. Newtonsoft adds unnecessary dependency. |
| B-8 | Polly v7 | Common project | Polly v8+ has been released with significant improvements. |
| B-9 | AdaptiveCards v1.2.4 | - | Current version is 3.x. Missing newer card features. |
| B-10 | Connection strings for Storage/Service Bus | appsettings.json | Should use Managed Identity consistently (partially implemented). |

---

## 3. Frontend (React)

### CRITICAL

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| F-1 | TypeScript 3.9.7 | ClientApp/package.json | Current is 5.3+. Six major versions behind. Missing critical type system features. |

### HIGH

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| F-2 | Dual Fluent UI v8 + v9 | ClientApp/package.json | Both @fluentui/react (v8) and @fluentui/react-components (v9) installed. Incomplete migration doubles bundle size and creates inconsistency. |
| F-3 | Redux anti-pattern | messagesSlice.ts | All state wrapped in `{ action: string; payload: any }`. Redundant wrapper that breaks type safety and adds boilerplate. |
| F-4 | No async thunks | actions.ts | Side effects handled outside Redux Toolkit's async thunk pattern. Manual fetch status flags instead of automatic pending/fulfilled/rejected. |

### MEDIUM

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| F-5 | Moment.js | package.json | Maintenance-only since 2022. Heavy bundle impact. Replace with date-fns or dayjs. |
| F-6 | Manual Fetch API | apis/apiDecorator.ts | No retry, timeout, or cancellation. Should use RTK Query or TanStack Query. |
| F-7 | Mixed styling | Various | SCSS files + CSS-in-JS (TypeStyle/makeStyles). Should consolidate. |
| F-8 | Old JSX transform | tsconfig.json | `"jsx": "react"` requires explicit React imports. Should be `"react-jsx"`. |
| F-9 | No error boundaries | - | No React Error Boundary for graceful error handling. |
| F-10 | Font-Awesome 4.7 + Fluent Icons | package.json | Duplicate icon libraries. Should use Fluent Icons only. |
| F-11 | @ts-ignore comments | Various | 6+ instances bypassing type checking. Indicates unresolved TS compatibility issues. |
| F-12 | Class component | components/config.tsx | Should be converted to functional component with hooks. |
| F-13 | NewMessage component 800+ lines | components/NewMessage/ | Single file too large. Should be decomposed into smaller components. |

### LOW

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| F-14 | ES5 target | tsconfig.json | Overly conservative. Modern Teams clients support ES2020+. |
| F-15 | Faker in production deps | package.json | Should be devDependency or removed entirely. |
| F-16 | Create React App | - | CRA is stable but slow. Vite would improve DX significantly. |

---

## 4. Security Concerns

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| S-1 | OAuth2 implicit flow | CRITICAL | Deprecated, tokens exposed in URL fragments. |
| S-2 | Storage SAS keys as secrets | HIGH | Connection strings in Key Vault. Should use Managed Identity. |
| S-3 | Bot endpoints exposed | MEDIUM | No IP whitelisting on /api/messages/* endpoints. |
| S-4 | No Content Security Policy | MEDIUM | No CSP headers configured in middleware. |
| S-5 | Babel traverse vulnerability | LOW | Patched via npm override (good), but indicates dependency chain risks. |
| S-6 | jq supply chain risk | LOW | External binary dependency in deployment script. |

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 12 |
| MEDIUM | 19 |
| LOW | 4 |
| **TOTAL** | **42** |

### By Component
| Component | Issues |
|-----------|--------|
| Infrastructure/Deployment | 18 |
| Backend (.NET) | 10 |
| Frontend (React) | 16 |
| Security | 6 |

---

## Recommendation

Given 42 identified issues (7 critical, 12 high), the technical debt is pervasive enough that a **clean-room rebuild** using modern tooling (Teams Toolkit, .NET 8/9, Bicep, React 19/Vite, Fluent UI v9) would likely be more efficient than incremental modernization. The fundamental architecture (Durable Functions orchestration, Service Bus queuing, event-driven delivery) is sound and should be preserved in any rebuild.
