# Company Communicator v2 - Documentation Index

Welcome to the Company Communicator v2 documentation. This collection of guides covers deployment, development, architecture, and operations.

## Quick Navigation

### For First-Time Deployment

**Start here**: [Setup and Deployment Guide](setup-guide.md)

A comprehensive step-by-step guide for Azure administrators deploying Company Communicator v2 for the first time. Covers:
- Prerequisites and tools
- Entra ID app registration setup
- GitHub environment configuration
- Azure infrastructure deployment
- Application code deployment
- Teams app installation
- Deployment verification
- Troubleshooting common issues

**Estimated time**: 2-4 hours

---

### For Local Development

**Start here**: [Local Development Guide](local-development.md)

Instructions for developers who want to run Company Communicator v2 locally for feature development and testing. Covers:
- Development environment setup
- Local database configuration (LocalDB or Docker)
- User secrets configuration
- Running the API, frontend, and Azure Functions
- Testing with Teams Emulator
- Running unit tests
- Debugging and development workflow

**Estimated time**: 30 minutes to first run, 1-2 hours for full setup

---

### For Understanding the System

**Start here**: [Architecture Reference](architecture.md)

A complete reference for the system design and components. Covers:
- System overview and design principles
- Architecture diagram and component relationships
- Technology stack
- Data flow for key operations
- Authentication and authorization
- Database schema
- Message processing pipeline
- Infrastructure overview
- Security measures
- Resilience and fault handling
- Monitoring and observability

Read this to understand how Company Communicator v2 works and why certain decisions were made.

---

### For Operations and Maintenance

**Start here**: [Operations and Monitoring Guide](operations.md)

Operational procedures for running Company Communicator v2 in production. Covers:
- Monitoring and alerting setup
- Application Insights dashboards
- Log Analytics queries
- Dead-letter queue management
- Database maintenance
- Scaling procedures
- Cost management
- Deploying updates and rollbacks
- Disaster recovery procedures
- Common troubleshooting scenarios
- Escalation procedures

Use this guide to maintain, monitor, and troubleshoot the application in production.

---

## Documentation Organization

### External Planning Documents

These documents were created during the planning and analysis phase of the project:

| Document | Purpose |
|----------|---------|
| [01-architecture-overview.md](01-architecture-overview.md) | Original solution architecture analysis |
| [02-message-flow.md](02-message-flow.md) | Message flow through original system |
| [03-technical-debt-assessment.md](03-technical-debt-assessment.md) | Analysis of outdated components (42 issues, 7 critical) |
| [04-component-inventory.md](04-component-inventory.md) | Every original component and dependency |
| [05-dependency-inventory.md](05-dependency-inventory.md) | Package and version status |
| [06-rebuild-plan.md](06-rebuild-plan.md) | Complete technical plan for v2 rebuild |
| [07-plan-review.md](07-plan-review.md) | Specialist review findings |

### User-Facing Documentation

These are the primary guides for deployment, development, and operations:

| Document | Audience | Primary Use |
|----------|----------|------------|
| [setup-guide.md](setup-guide.md) | Azure admins, DevOps engineers | Initial deployment |
| [local-development.md](local-development.md) | Software developers | Development environment |
| [architecture.md](architecture.md) | All technical users | Understanding system design |
| [operations.md](operations.md) | Operations engineers, on-call support | Production maintenance |

---

## Key Concepts

### Technology Stack (v2)

| Layer | Technology |
|-------|-----------|
| **API & Bot** | ASP.NET Core 8, M365 Agents SDK |
| **Frontend** | React 19, Vite, Fluent UI v9, TanStack Query |
| **Database** | Azure SQL (Serverless), EF Core 8 |
| **Messaging** | Azure Service Bus (Standard) |
| **Functions** | Azure Functions v4 (isolated worker), Durable Functions |
| **Graph** | Microsoft Graph SDK v5 |
| **Auth** | Teams SSO, Managed Identity, Entra ID groups |
| **Observability** | Application Insights, Log Analytics |
| **IaC** | Bicep modules |
| **CI/CD** | GitHub Actions (OIDC, no secrets) |

### Key Design Principles

1. **Single-tenant**: One app registration per organization
2. **Event-driven**: Service Bus queues, no polling
3. **Scalable**: Durable Functions handle 10k+ recipients
4. **Secure**: Managed identity, Entra ID-only auth, groups-based RBAC
5. **Observable**: Application Insights and Log Analytics
6. **Modern tooling**: .NET 8 LTS, React 19, current Azure services

---

## Deployment Environments

Company Communicator v2 supports three isolated deployment environments:

| Environment | Purpose | Approval Required | Auto-Deploy |
|-------------|---------|-------------------|------------|
| **dev** | Development, testing | No | Yes (on main) |
| **stg** | Staging, pre-release validation | No | Manual |
| **prod** | Production, live users | Yes | Manual |

Each environment has:
- Separate Azure resource group
- Separate SQL database
- Separate Service Bus namespace
- Separate app registration (or same registration with different credentials)
- Isolated monitoring and alerts

---

## Common Tasks

### I want to...

#### Deploy to Production for the First Time
→ Follow [Setup and Deployment Guide](setup-guide.md)

#### Add a New Feature
→ Read [Local Development Guide](local-development.md), then follow [Architecture Reference](architecture.md) to understand the layers

#### Understand Why Something Happened
→ Check [Operations Guide](operations.md) for troubleshooting, or [Architecture Reference](architecture.md) for how it works

#### Fix a Performance Issue
→ Start with [Operations Guide - Monitoring Section](operations.md#monitoring-overview), then check specific resource (SQL, Service Bus, Graph) issues

#### Set Up Monitoring Dashboards
→ See [Operations Guide - Application Insights Dashboard](operations.md#application-insights-dashboard)

#### Investigate a Failed Notification Delivery
→ See [Operations Guide - Dead Letter Queue Management](operations.md#dead-letter-queue-management)

#### Scale the System for More Users
→ See [Operations Guide - Scaling](operations.md#scaling)

#### Deploy a Code Update
→ See [Operations Guide - Deploying Updates](operations.md#deploying-updates)

#### Restore from a Backup
→ See [Operations Guide - Disaster Recovery](operations.md#disaster-recovery)

---

## Support and Resources

### Internal Resources

- **GitHub Repository**: [your-org/CompanyCommunicator](https://github.com/your-org/CompanyCommunicator)
- **Deployment Pipelines**: GitHub Actions > [Workflows](.github/workflows)
- **Monitoring**: Azure Portal > Application Insights > [app-ins-cc-prod](https://portal.azure.com)
- **Incident Response**: See [Operations Guide](operations.md#support-and-escalation)

### External Resources

- [M365 Agents SDK Documentation](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/agents-sdk-overview)
- [Azure SQL Database Serverless](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview)
- [Azure Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Microsoft Graph API v5](https://learn.microsoft.com/en-us/graph/api/overview)
- [Teams Developer Documentation](https://learn.microsoft.com/en-us/microsoftteams/platform/)
- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview)

---

## Document Versions and Updates

| Document | Last Updated | Status |
|----------|--------------|--------|
| [setup-guide.md](setup-guide.md) | 2026-02-17 | Current |
| [local-development.md](local-development.md) | 2026-02-17 | Current |
| [architecture.md](architecture.md) | 2026-02-17 | Current |
| [operations.md](operations.md) | 2026-02-17 | Current |

**Note**: These guides are maintained with the codebase. When you update the application, keep documentation synchronized.

---

## Contributing to Documentation

When updating documentation:

1. Use Markdown formatting
2. Include code examples and commands (fenced code blocks with language)
3. Add headers hierarchically (# → ## → ###)
4. Link related documents using relative paths
5. Keep technical language precise but accessible
6. Test commands before documenting

---

## Contact and Feedback

For questions, corrections, or improvements to this documentation:

1. Open an issue on [GitHub](https://github.com/your-org/CompanyCommunicator/issues)
2. Submit a pull request with proposed changes
3. Contact the engineering team on Slack or email

---

**Happy deploying!** 🚀
