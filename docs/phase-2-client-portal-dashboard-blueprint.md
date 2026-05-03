# Phase 2 Blueprint - Client Portal Dashboard

## 1. Executive Summary

Phase 2 turns the completed auth foundation into a usable client portal dashboard for a four-person SME delivery team. The goal is not to build a broad SaaS platform; it is to give clients one secure place to see project status, pending actions, files, and basic communication without relying on repeated email updates. The dashboard must reuse the existing Next.js auth boundary, session handling, and protected-route enforcement from Phase 1 rather than introducing a second auth model. The result should be small enough to ship in weeks, clear enough to implement without guessing, and strong enough to reduce manual client coordination immediately.

## 2. Business Objective (WHY)

The dashboard exists to replace fragmented client communication with one secure, predictable portal entry point. Today, a small service team loses time answering the same status, file, and next-step questions through email, chat, and ad-hoc document sharing. The dashboard solves that by giving each client a single authenticated view of their projects, required actions, messages, and deliverables. If it does not exist, the team keeps spending operational time on manual updates, clients keep lacking visibility, and the value of the completed auth system remains mostly internal instead of customer-facing.

## 2.1 Engineering Gap Closure (Phase 2 Entry Point)

Phase 2 is not starting from a blank system. It is starting from a completed auth system but a missing product layer.

The following gaps were identified from a real repository scan and must be treated as the primary objective of Phase 2.

### Root Gap #1 - Database Layer Missing

- No schema
- No persistence

Impact:

- Data models cannot exist
- API cannot function

### Root Gap #2 - API Layer Missing

- No business endpoints

Impact:

- Dashboard cannot fetch data
- Projects cannot load
- System becomes UI-only

### Root Gap #3 - Portal Routes Missing

- No project, task, message routes

Impact:

- Navigation broken
- UX incomplete

### Root Gap #4 - Domain Mapping Missing

- Auth exists but no domain linkage

Impact:

```text
Auth system can identify a user
BUT system cannot determine:
- which client
- which projects
- which tasks
```

Phase 2 exists to eliminate these four gaps in a deterministic order.

## 3. Core Value Proposition

- What client can see: active projects, current status, next milestone, pending actions, recent messages, and available files.
- What client can do: open a project, respond to required actions, read and send simple messages, download deliverables, update profile details, and sign out.
- What client no longer needs to ask manually: "What is the current project status?", "What do you need from me next?", "Where is the latest file?", and "Who replied last?"

## 4. System Scope (STRICT)

### 4.1 Included (MVP)

- Dashboard overview
- Project tracking
- Task or action required
- Basic communication
- File access
- Profile and account

### 4.2 Excluded (IMPORTANT)

- Advanced analytics
- Real-time chat system
- Multi-tenant scaling
- Complex permission system

## 5. User Roles

### Client

The client is the external user of the portal. The client can sign in through the existing auth system, see only their assigned projects, review status, complete requested actions, read and send project messages, access shared files, and manage their own account details.

### Admin (Internal Team)

The admin is an internal team member responsible for keeping client-visible data current. Admin responsibilities are to create and update projects, post status updates, assign client actions, upload deliverables, answer messages, and maintain client access. For Phase 2, admin permissions remain simple: internal users are treated as admins, and a complex role matrix is intentionally out of scope.

## 6. Core Modules (DETAILED)

### 6.1 Dashboard Overview

Data shown:

- Client name or company name
- Summary cards for active projects, pending actions, unread messages, and recent files
- A short recent activity list
- The next required action block

Purpose:

The overview page gives the client immediate orientation after login. It answers the first questions a client has without forcing them to open multiple screens.

UI expectation:

The page should be the first protected screen after login. It should use a simple server-rendered layout with summary cards at the top and short actionable lists below. No charts are required.

### 6.2 Project Module

Project list:

- Show all client-visible projects
- Show name, status, owner, next milestone, and last updated time

Project detail:

- Show summary, timeline or milestone list, current status, latest update, open tasks, recent messages, and related files

Status tracking:

- Use a small deterministic status set: `planned`, `in_progress`, `client_review`, `blocked`, `complete`

Purpose:

The project module gives the client one trusted place to understand current work without asking the team for a manual status report.

UI expectation:

Use a list page for projects and a single detail page per project. Keep the layout clean: summary first, then tasks, messages, and files below.

### 6.3 Task / Action Module

Pending actions:

- Show actions that require a client response
- Include title, project, due date, short instruction, and current status

Client responsibilities:

- Confirm information
- Upload a requested document when enabled
- Mark an action as completed or submitted
- Leave a short response when needed

Purpose:

The task module removes ambiguity about what the client needs to do next.

UI expectation:

Expose a dedicated "Actions" view plus project-level action lists. Keep task state simple: `open`, `submitted`, `done`, `blocked`.

### 6.4 Communication Module

Message thread:

- One simple thread per project
- Chronological messages only
- No typing indicators, presence, or real-time push

Purpose:

The communication module keeps project-related discussion attached to the project instead of spreading it across email chains.

UI expectation:

Use a standard message thread with a message list and a compose box. Refresh on page load or manual send; real-time behavior is not required.

### 6.5 File Module

Upload and download:

- Allow admins to upload deliverables for client access
- Allow clients to download approved files
- Allow client uploads for requested documents after the core workflow is stable

Deliverables:

- Files should always be tied to a project
- Files should show name, uploaded date, uploader, and type

Purpose:

The file module replaces ad-hoc document sharing with one controlled portal location.

UI expectation:

Start with a simple file list and download action. Upload can follow as a controlled form with one file at a time.

### 6.6 Account Module

Profile:

- Show name, email, company, and preferred contact details

Logout:

- Reuse the existing auth logout route

Purpose:

The account module gives the client a small self-service area without rebuilding identity management.

UI expectation:

Keep the page minimal. Account settings inside the portal are limited to profile data, while password and identity policy remain handled by the existing auth provider.

## 7. Data Model (MINIMAL)

### User

Purpose:

Represents an authenticated person using the portal.

Fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable user identifier |
| `role` | `client` or `admin` |
| `displayName` | Human-readable name |
| `email` | Contact and login identity reference |
| `companyName` | Client organization label |
| `status` | `active` or `inactive` |
| `createdAt` | Audit and sorting |
| `updatedAt` | Audit and profile updates |

### Project

Purpose:

Represents one client-facing engagement or workstream.

Fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable project identifier |
| `clientId` | Owner client reference |
| `name` | Project title |
| `summary` | Short description |
| `status` | Current lifecycle state |
| `startDate` | Project start reference |
| `targetDate` | Planned completion or milestone target |
| `lastUpdatedAt` | Freshness indicator for dashboard |

### Task

Purpose:

Represents a client action or required response.

Fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable task identifier |
| `projectId` | Project ownership |
| `assignedUserId` | Client responsible for the action |
| `title` | Short action label |
| `description` | Clear instruction |
| `status` | `open`, `submitted`, `done`, or `blocked` |
| `dueDate` | Response deadline |
| `createdByUserId` | Admin who created the task |
| `completedAt` | Completion timestamp when closed |

### Message

Purpose:

Represents a project-scoped communication entry.

Fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable message identifier |
| `projectId` | Project thread ownership |
| `authorUserId` | Sender reference |
| `body` | Message content |
| `createdAt` | Message order |
| `readAt` | Optional read marker for simple unread logic |

### File

Purpose:

Represents a project-related deliverable or uploaded document.

Fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable file identifier |
| `projectId` | Project ownership |
| `uploadedByUserId` | Uploader reference |
| `fileName` | Display name |
| `storageKey` | Storage lookup key or path |
| `mimeType` | File type handling |
| `sizeBytes` | File size display and limits |
| `category` | `deliverable`, `request`, or `supporting_document` |
| `createdAt` | Upload timestamp |

## 7.1 Domain Mapping (Auth -> Business Context)

The auth system identifies a user, but Phase 2 must resolve:

User -> Client -> Project -> Task -> Message

This mapping is mandatory for all business logic.

Rule:

- All API endpoints MUST derive client context from session user
- ClientId MUST NOT be trusted from frontend
- Data access MUST always be scoped to authenticated user

Without this mapping:

- System becomes insecure
- Data leakage risk increases
- Business logic breaks

## 8. System Architecture

### 8.1 Frontend

- Use Next.js App Router
- Keep a server-first approach for dashboard, project, task, message, and file listing pages
- Use client components only for local interactions such as message composition, action submission, and upload forms
- Keep protected portal pages inside the existing authenticated application boundary

### 8.2 Backend

- Use Next.js API routes for dashboard data, project detail, task updates, messages, files, and profile updates
- Resolve the current user on the server for every protected request
- Keep business logic in server-side handlers; do not move access control into browser state

Minimal API surface for execution:

- `GET /api/dashboard`
- `GET /api/projects`
- `GET /api/projects/[projectId]`
- `POST /api/tasks/[taskId]/complete`
- `POST /api/projects/[projectId]/messages`
- `GET /api/files/[fileId]/download`
- `PATCH /api/account`

### 8.3 Session

- Reuse the existing auth system exactly as built in Phase 1
- Continue to rely on the current protected-route gate and session lookup model
- Do not create a second session table, browser token flow, or custom login path
- Resolve the logged-in portal user from the existing authenticated session on the server

### 8.4 Data Storage

Primary database: PostgreSQL (Docker containerized)

Rationale:

- Ensures consistent environment across all engineers
- Eliminates version mismatch issues
- Supports concurrent usage safely
- Aligns with SME production readiness

Deployment model:

- PostgreSQL runs inside Docker container
- Application connects via DATABASE_URL

Engineering benefit:

- Reproducible local development
- Stable schema evolution
- No "works on my machine" issue

## 9. User Flow (CRITICAL)

### Login -> Dashboard

1. User visits `/login`
2. Existing auth system completes sign-in
3. User is redirected to `/dashboard`
4. Server loads dashboard summary data for the authenticated user

### Dashboard -> Project

1. User selects a project from the dashboard or project list
2. User opens the project detail page
3. Server loads project summary, current status, open tasks, recent messages, and files

### Action -> Completion

1. User opens an action from the dashboard or project page
2. User reads the instruction and required due date
3. User completes the action by submitting a response, marking it complete, or attaching the requested file when available
4. Server updates task state and shows the new state immediately in the dashboard and project detail

## 10. UI Structure

Layout:

- Left sidebar for primary navigation on desktop
- Top bar for client identity, current context, and logout
- Main content area for dashboard cards, lists, and detail views

Navigation:

- Dashboard
- Projects
- Actions
- Messages
- Files
- Account
- Logout

UI rule:

- Use one consistent portal shell across all protected screens
- Prefer summary cards, tables, and simple thread layouts over custom widgets
- Keep the portal readable on laptop screens first; mobile should collapse the sidebar into a menu, not introduce a separate product flow

## 11. Priority Roadmap

### P0 (MVP)

- Dashboard
- Project module
- Auth integration
- Portal shell and navigation

### P1

- Task system
- Messaging

### P2

- File upload
- Notification

Roadmap rule:

- P0 must ship before P1 work expands
- P2 is optional if time remains after P0 and P1 are stable

## 12. Team Distribution (4 People)

| Role | Primary Responsibility |
| --- | --- |
| Tech Lead / Full-Stack Engineer | Final scope control, architecture decisions, schema review, API standards, code review |
| Frontend Engineer | Portal shell, dashboard UI, project pages, account page, navigation integration |
| Backend Engineer | Postgres schema, protected API routes, task updates, messaging endpoints, file metadata handling |
| QA / Product Operator | Acceptance criteria, test scenarios, seeded sample data, validation against client workflows, release checklist |

Operating rule:

- Each person owns one primary area, but the team works in vertical slices instead of isolated layers only
- The internal admin role in the product can be fulfilled by the same small team; a separate large support organization is not assumed

## 13. Timeline (REALISTIC)

| Week | Focus | Output |
| --- | --- | --- |
| Week 1 | Setup | Postgres schema, seeded sample data, portal shell, auth reuse wiring, dashboard route skeleton |
| Week 2 | Core modules | Dashboard overview, project list, project detail, basic navigation |
| Week 3 | Features | Task actions, basic messaging, file list and download, account page |
| Week 4 | Testing | Integration testing, role validation, content review, bug fixing, release readiness |

Timeline rule:

- If Week 2 slips, file upload stays in P2 and does not block MVP sign-off

## 14. Success Metrics

- Client can sign in and reach a usable dashboard without staff help
- Client can see at least one active project, current status, and next action within two clicks after login
- Client knows what to do next because open actions are visible on the dashboard and project page
- Manual status-request messages from pilot clients are reduced by at least 30 percent within the first month of usage
- Latest approved deliverable can be downloaded from the portal without manual resend from the internal team

## 15. Risk Analysis

| Risk | Impact | Control |
| --- | --- | --- |
| Overengineering | Delivery slows and the team builds features clients do not need yet | Lock MVP to the modules in Section 4 and reject additions without a direct client need |
| Scope creep | P0 work slips into P1 and P2 items before the core portal works | Enforce the roadmap order and require explicit approval for any new module |
| Delivery delay | A four-person team loses time if UI, API, and data work start without fixed boundaries | Use the module breakdown, minimal API surface, and weekly outputs defined in this document |

## 16. Constraints & Assumptions

- Team size is four people
- Infrastructure is limited and should stay simple
- The existing auth system is already built and must be reused
- The current deployment model is not a distributed system yet
- Session behavior remains inside the existing auth boundary and is not redesigned in Phase 2
- A single managed Postgres instance is acceptable for this phase
- Real-time behavior is not required for messages or notifications

## 17. Phase Transition (IMPORTANT)

Phase 2 creates the first working client-facing portal on top of the completed auth system. Once this phase is stable, Phase 3 can focus on hardening and operational maturity rather than basic product existence.

Phase 3 should build on this foundation by addressing what is intentionally deferred here:

- Notification depth beyond basic status awareness
- Stronger admin workflows
- Expanded audit and observability features
- Storage hardening and scaling decisions beyond the current SME setup
- More advanced permissions only if the client base and internal workflow justify them

The transition rule is simple: Phase 3 starts only after Phase 2 MVP is live, used, and proven useful to real client workflows.

## 18. Phase 2 Completion Definition (100%)

Phase 2 is considered 100% complete when:

- Database layer exists and is operational
- API layer fully implemented for dashboard, project, task, message, file
- Portal routes fully implemented
- Domain mapping works for all requests
- Auth integration reused without modification
- Client can login
- Client can view dashboard
- Client can open project
- Client can see tasks
- Client can read messages
- Client can download files
- No placeholder UI remains
- No manual data required to test flow
- System usable by real client without engineering support

If any of the above is missing -> Phase 2 is NOT complete

## Final Rule

This document must:

- Be readable without explanation
- Be implementable without guessing
- Be aligned with real constraints

If it is not, it should be rewritten before implementation starts.

## Validation Checklist

- [ ] No vague wording
- [ ] No feature bloat
- [ ] Clear MVP scope
- [ ] Directly implementable
- [ ] Matches SME reality