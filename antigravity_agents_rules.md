# ANTIGRAVITY PRODUCTION POV, CONTROL, MAINTENANCE, UI, AND AI CONTEXT

## 1. Core Objective

The project must be treated as a real production system.

It must not be designed as a demo, mockup, prototype, fake production environment, or generic generated application.

The system must have clear operational separation between:

**User POV**

**Admin POV**

**Developer POV**

**Maintenance POV**

Each POV has a different purpose, permissions model, interface, and access scope.

The system must maintain a strict distinction between normal production usage and operational management.

---

# 2. User POV

The User POV represents the actual production experience of a normal end user.

The user should only see and access functionality that is intentionally exposed to normal production users.

The User POV should not expose internal operational systems.

The user must not have access to:

* Production control
* Server management
* Database management
* Database administration
* Deployment controls
* Application configuration
* Server configuration
* Internal logs
* Developer tools
* Administrative tools
* User management
* System diagnostics
* Infrastructure controls
* Maintenance controls
* Internal monitoring
* Operational dashboards

The user interacts with the actual production application.

The User POV must feel like the finished product rather than a management interface.

---

# 3. User Production Experience

The User POV represents:

**Production application**

**Production account**

**Production data**

**Production functionality**

**Production sessions**

**Production notifications**

**Production availability**

The user must receive only the information relevant to their role.

Internal system information should never be exposed unnecessarily.

For example, a user should not see:

* Database errors containing internal SQL details
* Server paths
* Internal service names
* Infrastructure identifiers
* Developer debugging information
* Internal configuration
* Stack traces
* Credentials
* Secrets
* Administrative states that are not intended for users

Errors presented to users should be appropriate for production.

---

# 4. Admin POV

The Admin POV represents operational control of the production application.

Administrators should have access to the management functions required for running the system.

The Admin POV may include:

## Production Control

* Application status
* Production availability
* Maintenance mode
* User access control
* Operational announcements
* Service control
* Feature control where implemented
* Configuration control where authorized
* Operational settings
* Production activity

## User Management

* User list
* User status
* Account state
* Account restrictions
* Access permissions
* Session information where appropriate
* Account actions
* User activity where legitimately required
* Administrative audit information

## Server Management

* Server status
* Server health
* Resource utilization
* Application process status
* Service status
* Restart operations where authorized
* Maintenance operations
* Deployment state
* Runtime information
* Error monitoring
* Operational logs where appropriate

## Database Management

* Database connection status
* Database health
* Database usage
* Migration state
* Backup state
* Data-management functions
* Schema status
* Database monitoring
* Administrative database operations

Administrative database access must be tightly controlled.

The UI must not expose unrestricted destructive operations casually.

---

# 5. Developer POV

The Developer POV represents engineering and infrastructure access.

Developer access should be broader than normal administrative access when the actual project requires it, but it must still follow explicit permission boundaries.

The Developer POV may include:

## Application

* Source-aware diagnostics
* Application health
* Runtime information
* Build information
* Release information
* Version information
* Configuration diagnostics
* Error diagnostics
* Deployment status

## Server

* Server health
* Runtime state
* Process state
* Resource usage
* Service state
* Maintenance state
* Deployment state
* Restart controls where authorized
* System diagnostics
* Operational logs

## Database

* Database health
* Connection information
* Migration status
* Schema information
* Query diagnostics where appropriate
* Backup status
* Data integrity status
* Database maintenance tools
* Database management functions

## Development and Deployment

* Build status
* Release status
* Deployment controls
* Environment status
* Staging status
* Production status
* Rollback capability where implemented
* Deployment history
* Version management
* Configuration management

Developer tools must not automatically be exposed to users or normal administrators.

---

# 6. Admin vs Developer Permissions

Admin and Developer are not automatically identical roles.

The exact permission model must be based on the project's actual operational requirements.

A practical separation may be:

**Admin**

Focused on:

* Users
* Production operations
* Operational settings
* Service management
* Maintenance
* Business-level controls
* Moderation
* Operational monitoring

**Developer**

Focused on:

* Application internals
* Engineering diagnostics
* Deployment
* Database engineering
* Configuration
* Runtime diagnostics
* Build and release systems
* Infrastructure-related operations

Some permissions may overlap.

Some permissions may remain restricted to one role.

Do not create arbitrary permission differences without a real security or operational reason.

---

# 7. Principle of Complete Operational Visibility

Admin and Developer POV should provide a central operational view of the production system.

This can include:

**Application status**

**Server status**

**Database status**

**User status**

**System status**

**Maintenance status**

**Deployment status**

**Error status**

**Resource status**

**Backup status**

**Security status**

**Operational events**

Only information actually available from the underlying system should be displayed.

Do not fabricate metrics.

Do not display fake CPU usage, memory usage, active users, latency, uptime, or database health.

---

# 8. Production Control

Production control is the operational layer used to manage the running project.

It must be designed around the real application architecture.

Production control may include:

* Start
* Stop
* Restart
* Maintenance mode
* User access restrictions
* Deployment
* Configuration updates
* Service state
* Feature controls
* Operational notifications
* Health checks

Every control must map to a real system operation.

A visual button does not count as a functional control unless it is connected to the actual backend behavior.

---

# 9. Server Management

Server management should expose the actual operational state of the server.

Potential information includes:

* Online or offline state
* Process state
* CPU usage
* Memory usage
* Storage usage
* Network state
* Runtime state
* Application health
* Service health
* Error state
* Restart state
* Maintenance state
* Deployment state

Only collect and display metrics that are actually available.

Do not create artificial monitoring metrics.

---

# 10. Server Status

The server status system must reflect real server state.

For example, possible states include:

**Online**

**Offline**

**Starting**

**Stopping**

**Restarting**

**Maintenance**

**Degraded**

**Error**

The exact state model depends on the implementation.

A server should not be reported as healthy merely because the management UI itself is reachable.

Health must be based on relevant service checks.

---

# 11. User Status

The operational interface should distinguish user-facing state from system-facing state.

Depending on the project, user status may include:

* Online
* Offline
* Active
* Inactive
* Restricted
* Suspended
* Logged in
* Logged out
* Session state
* Account state

Only expose information that the corresponding administrative role is authorized to see.

User information must not be unnecessarily exposed.

---

# 12. Database Management

Database management is a separate operational responsibility.

The system should distinguish between:

**Application data**

**Database structure**

**Database health**

**Database operations**

**Database administration**

The Admin or Developer interface should provide only the operations actually required by the project.

Potential functions may include:

* Connection status
* Database health
* Migration status
* Schema status
* Backup status
* Restore operations
* Data inspection
* Controlled data modification
* Maintenance operations

Destructive operations must require appropriate authorization and safeguards.

Do not create database management controls that the underlying database system cannot safely support.

---

# 13. Database Safety

Database administration must prioritize:

**Integrity**

**Consistency**

**Security**

**Recoverability**

**Auditability**

Before performing a destructive operation, the system should have an appropriate safety mechanism where required.

Examples may include:

* Authorization
* Confirmation
* Audit logging
* Backup
* Validation
* Transaction boundaries
* Recovery procedures

The exact implementation depends on the real database technology.

---

# 14. Maintenance POV

Maintenance POV is a special operational state.

When the production system is under maintenance:

**Normal users are restricted from normal production access.**

**Admin access remains available.**

**Developer access remains available.**

The purpose is to allow operators to work on the system while preventing normal production traffic from interfering with maintenance.

---

# 15. Maintenance State

The system must have a real maintenance state.

When maintenance is enabled:

Normal User POV:

The normal application is locked or restricted according to the configured maintenance behavior.

Admin POV:

Operational controls remain available.

Developer POV:

Engineering and operational controls remain available.

The underlying application and management systems must be designed so that maintenance does not accidentally lock administrators or developers out of the control plane.

---

# 16. Maintenance Access Model

The intended behavior is:

## User

Cannot use the normal production application while maintenance restrictions are active.

The user should receive an appropriate maintenance interface.

## Admin

Can access the operational management interface.

Can inspect the system.

Can manage maintenance.

Can perform authorized operational actions.

## Developer

Can access the engineering and management interface.

Can inspect application state.

Can work on deployment, configuration, database, server, diagnostics, and related systems according to permissions.

---

# 17. Maintenance UI

The User POV during maintenance should be intentionally simple.

It should communicate:

* The application is under maintenance
* Normal access is temporarily unavailable
* Relevant status information
* Expected information only when actually available

Do not expose internal technical details.

Do not expose database names.

Do not expose server architecture.

Do not expose developer diagnostics.

Do not expose stack traces.

Do not expose internal error messages.

---

# 18. Maintenance Admin UI

Admin users should not be forced through the normal user maintenance lock.

The Admin interface should remain operational.

It may provide:

* Maintenance enable
* Maintenance disable
* Maintenance status
* Maintenance reason
* Maintenance schedule where implemented
* User access state
* Current server status
* Current application status
* Operational notifications
* Health checks
* Deployment state

Only controls that are actually implemented should be displayed.

---

# 19. Maintenance Developer UI

The Developer interface should remain fully operational during maintenance.

The developer should be able to inspect and work on:

* Application
* Server
* Database
* Configuration
* Deployment
* Runtime
* Logs
* Health checks
* Build state
* Release state
* Maintenance state

The exact controls depend on the actual infrastructure.

---

# 20. Maintenance Workflow

The production maintenance process should follow a controlled workflow.

## Before Maintenance

Check:

* Current production status
* Active user state where relevant
* Current deployment version
* Database state
* Backup requirements
* Server health
* Pending operations
* Maintenance scope

## Enter Maintenance

Activate maintenance state.

Restrict normal user access.

Keep operational control available.

## During Maintenance

Perform:

* Application updates
* Configuration changes
* Database migrations
* Server changes
* Deployment operations
* Testing
* Validation

Only perform operations that are actually required.

## Post-Maintenance

Validate:

* Application health
* Database health
* Server health
* Authentication
* Core user functionality
* Relevant integrations
* Logs
* Error state

## Exit Maintenance

Disable the maintenance restriction only after the relevant checks have succeeded.

---

# 21. Maintenance Does Not Mean Developers Lose Access

This is a fundamental requirement.

The production maintenance lock applies to the **User POV**.

It must not unintentionally apply to the management control plane.

The intended relationship is:

**User access: restricted**

**Admin control: available**

**Developer control: available**

This requires the authentication and authorization architecture to distinguish normal application access from administrative operational access.

---

# 22. Control Plane and User Plane

The architecture should conceptually separate:

**User Plane**

The actual production application used by normal users.

**Control Plane**

The administrative and developer management system.

The control plane is responsible for managing the production system.

This distinction is particularly important during maintenance.

The system should be designed so that disabling normal user access does not disable the administrative control system.

---

# 23. Authentication and Authorization

The system must identify the user's role before granting access.

Possible roles may include:

* User
* Admin
* Developer

Additional roles can be added only when genuinely necessary.

Authorization must happen server-side.

Do not rely only on hidden UI elements to protect privileged operations.

A user who cannot see an admin button must still be prevented from directly calling the underlying administrative endpoint.

---

# 24. Backend Enforcement

Maintenance restrictions must be enforced by the backend.

It is not sufficient to show a maintenance page in the frontend.

The backend should determine whether a request is allowed according to:

* Authentication state
* User role
* Maintenance state
* Endpoint requirements
* Authorization policy

The actual implementation depends on the project's framework.

---

# 25. Frontend Enforcement

The frontend should reflect backend authorization.

For normal users:

Maintenance state should display the appropriate maintenance interface.

For authorized operators:

The management interface should remain accessible.

The frontend must not be treated as the security boundary.

---

# 26. Production Data

User POV should use real production data.

Admin and Developer POV should access operational information according to their permissions.

Do not create:

* Fake active users
* Fake server metrics
* Fake database records
* Fake logs
* Fake deployment histories
* Fake status information

unless the user explicitly requests sample data for demonstration.

---

# 27. Real Production-Level Requirement

Every functional element must connect to actual functionality.

For example:

A "Restart Server" button must have a real, secure server-control implementation.

A "Database Backup" button must trigger an actual backup mechanism.

A "Maintenance Mode" control must change the real maintenance state.

A "Server Status" display must obtain real status information.

A "User Count" must be based on actual data.

A "Deployment Status" display must reflect an actual deployment state.

Do not create visual simulations and present them as working production functionality.

---

# 28. UI and UX Master Rule

Every UI and UX in the project must follow the defined visual language.

Primary visual systems:

**Claymorphism**

**Premium solid morphism**

Secondary visual systems:

**Liquid effects**

**Glass effects**

Liquid and glass may be used selectively where they genuinely improve the interface.

They should not replace the primary design system.

---

# 29. Claymorphism

Claymorphism should be used where dimensional depth and soft physical appearance are appropriate.

Characteristics may include:

* Soft depth
* Rounded surfaces
* Subtle shadows
* Tactile components
* Controlled elevation
* Soft contrast
* Refined surfaces
* Clean spacing

The result must remain professional.

Avoid exaggerated toy-like styling.

---

# 30. Premium Solid Morphism

Premium solid morphism should be a major design foundation.

Use:

* Strong visual hierarchy
* Solid surfaces
* Refined spacing
* Controlled depth
* Professional contrast
* Clear cards
* Structured panels
* High-quality typography
* Consistent component treatment

The interface should look like a real premium production product.

---

# 31. Liquid and Glass Effects

Liquid and glass effects are allowed selectively.

Use them where they improve:

* Visual hierarchy
* Layer separation
* Navigation
* Contextual panels
* Status information
* Special interaction areas

Do not apply glass or liquid effects to every component.

Avoid making the interface visually noisy.

---

# 32. No Neon Theme

Neon must not be the project's visual identity.

Avoid:

* Neon backgrounds
* Neon borders
* Excessive glowing elements
* Cyberpunk styling
* Artificial RGB aesthetics
* Overuse of luminous gradients
* Excessive glow effects

The design should feel:

**Premium**

**Modern**

**Professional**

**Controlled**

**Production-oriented**

rather than gaming-neon or cyberpunk.

---

# 33. UI Consistency

Every interface must use a consistent visual system.

Maintain consistency across:

* Buttons
* Cards
* Tables
* Forms
* Navigation
* Dialogs
* Notifications
* Status indicators
* Dashboards
* Settings
* Management panels
* Maintenance pages

Do not design each screen as an unrelated visual concept.

---

# 34. User UI vs Management UI

The User POV should focus on the product experience.

The Admin and Developer POV should focus on control, information density, diagnostics, and operational efficiency.

Do not force the user interface to behave like an administrator dashboard.

Do not make the administrator dashboard look like the consumer application.

They may share the same visual language while having very different information architecture.

---

# 35. Admin Dashboard

The Admin dashboard should prioritize operational clarity.

Potential areas include:

* System overview
* Current status
* Users
* Server
* Database
* Maintenance
* Alerts
* Operational events
* Settings

Only actual system capabilities should be shown.

---

# 36. Developer Dashboard

The Developer dashboard should prioritize engineering visibility.

Potential areas include:

* Application health
* Runtime
* Server
* Database
* Deployment
* Build
* Release
* Logs
* Diagnostics
* Configuration
* Maintenance

Again, only actual capabilities should appear.

---

# 37. System Status Hierarchy

The management system should make important operational states easy to understand.

Examples:

**Healthy**

**Warning**

**Degraded**

**Maintenance**

**Error**

**Unavailable**

The exact terminology should match the actual implementation.

Do not invent health states that have no underlying meaning.

---

# 38. Operational Auditability

Administrative and developer actions that affect production should be auditable where appropriate.

Potential audit information:

* Who performed the action
* What action was performed
* When it was performed
* Relevant target
* Result
* Error state where applicable

Do not collect unnecessary personal information.

---

# 39. Admin and Developer Operational Separation

Although both roles have extensive control, their responsibilities should remain conceptually distinct.

Admin:

Operational and production management.

Developer:

Engineering and technical management.

Shared controls may exist where justified.

Highly sensitive technical functionality should remain restricted to authorized developer or infrastructure roles when required by the project.

---

# 40. No Unnecessary Role Explosion

Do not create large numbers of roles simply because role-based access control supports them.

Start with the roles the project actually requires.

Additional roles should be introduced only when a real permission boundary exists.

---

# 41. No Artificial Dashboard Metrics

Do not display:

* Fake uptime
* Fake CPU load
* Fake memory percentage
* Fake active user count
* Fake database health
* Fake deployment status
* Fake response time
* Fake network statistics

Every metric must come from an actual source.

---

# 42. AI Rule

The project must not contain AI branding or AI-generated visual identity unless explicitly requested as a project feature.

Do not use:

* AI templates
* Generic AI dashboard templates
* AI references
* AI branding
* "Powered by AI" language
* Unrequested AI terminology
* Generic AI product wording
* AI-looking placeholder content
* AI-generated filler

The project should be presented as the actual product.

---

# 43. No AI Template Dependency

Do not construct the project by copying a generic AI-generated template and treating it as the final architecture.

Templates may only be used where the user explicitly requests a specific template or when the template is an actual established project dependency.

The architecture must be based on the real project requirements.

---

# 44. No Unwanted Context

Do not add unrelated:

* Features
* Modules
* Services
* Dashboards
* AI systems
* Automation systems
* Databases
* Monitoring systems
* Integrations
* UI sections

unless they serve an actual requirement.

The project must remain focused.

---

# 45. Production-Level Engineering Standard

The project should be engineered with real production concerns in mind:

**Security**

**Reliability**

**Maintainability**

**Observability**

**Data integrity**

**Access control**

**Error handling**

**Deployment**

**Recovery**

**Performance**

**Testing**

**Configuration**

**Operational control**

However, these concepts must correspond to actual implementation rather than decorative terminology.

---

# 46. Realism Standard

When designing any system, ask:

Does this actually work?

Where does the data come from?

What service performs the operation?

What happens if it fails?

Who is authorized?

What happens during maintenance?

What happens after restart?

What happens during deployment?

What happens to active sessions?

What happens to the database?

What is the rollback mechanism?

How is the operation verified?

If these questions are not answered by the actual system, do not pretend they are.

---

# 47. Operational Control Principle

Admin and Developer POV should act as the operational control system for the project.

The management interface must be connected to real backend controls.

The interface should not merely display settings.

Where authorized, it should control the underlying system.

Examples include:

* Maintenance
* Server state
* Application state
* User state
* Database operations
* Configuration
* Deployment
* Monitoring
* Diagnostics

Each operation must be implemented securely.

---

# 48. Maintenance Control Principle

Maintenance is a system state, not merely a page.

The system should have an authoritative maintenance state.

That state should influence:

* User access
* User interface
* Backend request handling
* Administrative visibility
* Developer access
* Operational status
* Notifications where implemented

The exact implementation must depend on the actual architecture.

---

# 49. Production to Maintenance Lifecycle

The intended lifecycle is:

## Normal Production

Users use the application normally.

Admin and Developer monitor and manage the system.

## Maintenance Preparation

Admin or Developer prepares for maintenance.

Relevant operational state is checked.

## Maintenance Activation

User access becomes restricted.

Admin and Developer access remains operational.

## Maintenance Work

Authorized personnel perform:

* Updates
* Configuration changes
* Database work
* Server work
* Deployment
* Testing
* Diagnostics

## Validation

The system is tested.

## Maintenance Completion

The production system is verified.

## Production Restoration

Normal users regain access.

## Monitoring

The system continues to be observed for problems.

---

# 50. User Experience During Maintenance

The maintenance experience must be intentional.

The user should not receive:

* Broken pages
* Raw errors
* Stack traces
* Empty screens
* Unstyled HTML
* Internal diagnostics
* Server information

Instead, the maintenance experience should use the project's established UI system and communicate only appropriate information.

---

# 51. Admin and Developer Experience During Maintenance

The management system should remain usable.

During maintenance, authorized operators should still be able to:

* Log in
* View system state
* Access operational dashboards
* View relevant diagnostics
* Manage maintenance
* Work on the system
* Validate changes
* Perform authorized administrative operations

Maintenance must not create an operational deadlock where the system is locked and nobody can control it.

---

# 52. Control Plane Security

Because the management interface has privileged access, it requires stronger protection than the normal user interface.

Potential controls include:

* Strong authentication
* Role-based authorization
* Session security
* Audit logging
* Rate limiting
* Secure cookies
* Access restrictions
* Sensitive operation confirmation
* CSRF protection where relevant
* Secure transport

The exact controls depend on the technology.

---

# 53. No Client-Side-Only Security

Do not rely on:

* Hidden buttons
* Frontend route protection alone
* Disabled controls
* Hidden menu items

to protect administrative operations.

The backend must enforce authorization.

---

# 54. Production Configuration

Production configuration must be separated appropriately from development configuration.

Do not mix:

* Development credentials
* Production credentials
* Development data
* Production data
* Testing configuration
* Production settings

Do not expose secrets.

---

# 55. Environment Awareness

The system should clearly distinguish:

**Development**

**Testing**

**Staging**

**Production**

**Maintenance**

Where appropriate, the management interface should identify the environment being controlled.

Never assume that an environment is production merely because it looks similar to production.

---

# 56. Deployment Awareness

Admin and Developer POV should understand the actual deployment state.

Relevant information may include:

* Current release
* Target release
* Deployment state
* Deployment time
* Build state
* Health state
* Rollback availability

Only display information that is actually available.

---

# 57. Release Integrity

A release should be based on a real build artifact.

Do not manually fabricate release status.

The release lifecycle should correspond to the project's actual build process.

---

# 58. Backup and Recovery

Where persistent data is important, maintenance and deployment planning must consider recovery.

Potentially relevant systems include:

* Database backup
* Application backup
* Configuration backup
* Artifact retention
* Recovery procedures

Do not claim backups exist unless they are actually implemented or verified.

---

# 59. Operational Logs

Management interfaces may provide operational logs where appropriate.

Logs should be:

* Real
* Relevant
* Secure
* Searchable where useful
* Appropriately retained
* Protected from unauthorized access

Do not fabricate logs to populate a dashboard.

---

# 60. Error Management

The management interface should provide useful technical error information to authorized operators.

The User POV should receive appropriate production-safe error handling.

The same underlying error can therefore have different representations depending on authorization.

---

# 61. Final Architectural Principle

The system should conceptually operate as:

**User POV**

Normal production experience.

**Admin POV**

Production operations and management.

**Developer POV**

Engineering and technical management.

**Maintenance POV**

Restricted User access with continued Admin and Developer operational access.

These perspectives must be backed by actual authentication, authorization, backend logic, database behavior, server behavior, and deployment architecture.

They must not exist only as UI screens.

---

# 62. Antigravity Enforcement

Whenever Antigravity works on this project, it must check the requested change against this context.

Before implementation, determine:

* Which POV is affected
* Which permissions are affected
* Whether production behavior is affected
* Whether maintenance behavior is affected
* Whether database state is affected
* Whether server state is affected
* Whether deployment is affected
* Whether UI/UX requirements are affected
* Whether the change introduces unnecessary complexity

The implementation must preserve these boundaries.

---

# 63. Final Non-Negotiable Rules

The project must be:

**Real**

**Production-oriented**

**Functional**

**Secure**

**Consistent**

**Non-duplicated**

**Non-fabricated**

**Non-placeholder**

**Non-neon**

**Premium in visual design**

**Claymorphism-first**

**Premium solid morphism-first**

**Selective liquid and glass**

**No AI templates**

**No AI references**

**No unwanted context**

**No unnecessary complexity**

**No fake operational data**

**No fake system states**

**No fake production claims**

**No unauthorized control**

**No user access during active maintenance where maintenance lock is enabled**

**Admin access remains operational during maintenance**

**Developer access remains operational during maintenance**

All operational controls must correspond to actual backend functionality.

All production claims must be supported by actual implementation or verification.

The final system must behave like a real production product and real production control environment, not like a generated demonstration.
