# ByteSky Project Architecture Guide

This guide explains how the project actually works today by reading the codebase, not just the README.

## 1. What This Project Is

ByteSky is a single-page cloud dashboard built with:

- A static frontend in `frontend/`
- A Node.js + Express backend in `backend/`
- MongoDB for primary data
- Redis for optional caching and readiness checks
- Docker integration for launching extra services like browser VMs, Redis, Postgres, Metabase, Apache, and Jenkins
- Nginx in production to serve the frontend and reverse-proxy the backend

The project mixes two ideas:

- Simulated cloud resources stored in MongoDB, such as compute instances, bills, tickets, VPCs, route tables, and load balancers
- Real Docker-managed services, such as Jenkins, Redis, Metabase, Apache, and browser-accessible container sessions

## 2. High-Level Runtime Map

### Production-style flow

1. Browser loads static files from Nginx.
2. Frontend JS decides the API base URL.
3. Frontend calls `/api/...`.
4. Nginx proxies `/api/*` and `/uploads/*` to the backend container.
5. Express handles routes, middleware, auth, and business logic.
6. Backend talks to MongoDB, Redis, and sometimes the Docker socket.

### Local direct-backend flow

1. You run `backend/server.js`.
2. Express serves the frontend folder directly if it exists.
3. Browser opens the backend port directly, usually `http://localhost:5000`.
4. API requests stay same-origin under `/api`.

## 3. Frontend Architecture

Frontend code lives in:

- `frontend/index.html`
- `frontend/css/styles.css`
- `frontend/js/script.js`

### Frontend shape

This is not React, Vue, or Angular. It is a classic SPA built with:

- One large HTML page containing all page sections
- One CSS file for layout and design
- One large JS file that controls routing, auth, API calls, charts, modals, and page-specific behavior

### How frontend boot works

The frontend boot sequence is mainly in `frontend/js/script.js`:

- `API_URL` is computed from the current browser location
- session token is loaded from `localStorage`
- theme is applied
- `checkSession()` validates the saved JWT by calling `/api/auth/me`
- `router()` switches between pages and triggers page-specific loaders

### Frontend routing model

The app uses a custom router, not browser history routing.

- Each page is a `<div class="page">` in `frontend/index.html`
- `router(pageId)` hides all pages and shows the selected one
- Route changes trigger loaders such as:
  - `loadDashboardData()`
  - `loadVMs()`
  - `loadBilling()`
  - `loadStorage()`
  - `loadTickets()`
  - `loadNetworkResources()`
  - `loadAdmin()`
  - `showIAMTab(...)`
  - `showSaaSTab(...)`

### Frontend state model

State is mostly plain global variables in `script.js`, for example:

- `currentUser`
- `token`
- `billing`
- `saasIntegrations`
- `activeContainerSessions`
- `marketplaceServices`

Persistent client-side state is stored in `localStorage`, including:

- JWT token
- current user object
- theme
- profile draft data
- SSH keys
- some SaaS integration preferences

### Frontend/backend contract

The frontend talks directly to backend REST endpoints using `fetch`.

Examples:

- Auth: `/api/auth/...`
- Instances: `/api/instances`
- Storage: `/api/storage/...`
- Monitoring: `/api/monitoring/...`
- Billing: `/api/billing/...`
- Network: `/api/network/...`
- Tickets: `/api/tickets` and compatibility calls to `/api/support`
- IAM: `/api/iam/...`
- Admin: `/api/admin/...`
- Docker services: `/api/docker/...`, `/api/container/...`, `/api/vm/...`, `/api/jenkins/...`

## 4. Backend Architecture

The backend entry flow is:

- `backend/server.js`
- `backend/app.js`

### Startup sequence

`backend/server.js` does this in order:

1. connect MongoDB
2. connect Redis
3. seed core data
4. initialize VM/container cleanup lifecycle
5. start the metrics worker if enabled
6. create the HTTP server and listen on `env.port`

### Express app setup

`backend/app.js` configures:

- `helmet`
- `cors`
- JSON/urlencoded body parsing
- `morgan` logging into Winston
- rate limiting on `/api`
- static serving of `/uploads`
- static serving of the frontend folder if it exists
- SPA fallback to `frontend/index.html`
- not-found middleware
- error handler middleware

### Config layer

Config is centralized in `backend/config/env.js`.

It parses:

- ports
- Mongo URI
- JWT secret
- CORS origins
- Redis URL
- Docker settings
- VM lifecycle settings
- Stripe settings
- Google auth settings
- Keycloak settings
- Jenkins settings

Important detail:

- `MONGO_URI` and `JWT_SECRET` are required at startup

### Logging

`backend/config/logger.js` creates a Winston logger that writes to:

- `backend/logs/error.log`
- `backend/logs/combined.log`

### Authentication model

Auth is JWT-based:

- login/register happen in `backend/routes/auth.js`
- business logic lives in `backend/services/auth.service.js`
- token signing and verification live in `backend/services/token.service.js`
- route protection uses `backend/middleware/auth.js`

The frontend stores the JWT in `localStorage` and sends it as:

- `Authorization: Bearer <token>`

## 5. Backend Structure Pattern

The backend uses a mixed architecture.

Some areas follow:

- route -> controller -> service -> model

Examples:

- auth
- container
- docker
- vm
- health
- jenkins

Other areas keep business logic directly in route files:

- instances
- storage
- network
- billing
- support
- monitoring
- admin
- iam
- twoFA

This means there is no single consistent pattern across the whole backend. When learning the project, always inspect the route file first to see whether logic stays there or is delegated into services.

## 6. Main Backend Domains

### Auth

Files:

- `backend/routes/auth.js`
- `backend/controllers/auth.controller.js`
- `backend/services/auth.service.js`
- `backend/models/User.js`

Behavior:

- Register creates a Mongo user and returns a JWT
- Login verifies password with bcrypt and returns a JWT
- Google login verifies the Google ID token using `google-auth-library`
- Profile update and password change require auth

### Health

Files:

- `backend/routes/health.js`
- `backend/controllers/health.controller.js`

Behavior:

- `/api/health/live` checks process liveness
- `/api/health/ready` checks Mongo and Redis readiness
- `/api/health/client-config` gives frontend-safe config like Google client ID and app base URL

### Instances

Files:

- `backend/routes/instances.js`
- `backend/models/Instance.js`
- `backend/models/Invoice.js`
- `backend/models/Metric.js`
- `backend/models/Region.js`

Behavior:

- Creates simulated VM records in MongoDB
- Generates random private-looking IPs
- Creates an invoice when an instance is launched
- Uses `setTimeout` to simulate provisioning before switching to `running`
- Generates termination charges when deleted

This is a simulated compute system backed by MongoDB records, not real VM infrastructure.

### Monitoring

Files:

- `backend/routes/monitoring.js`
- `backend/services/metrics.service.js`
- `backend/models/Metric.js`

Behavior:

- The metrics worker periodically generates random metrics for running instances
- Monitoring routes read those metrics and shape them for charts
- The metric collection is synthetic, not tied to real host telemetry

### Storage

Files:

- `backend/routes/storage.js`
- `backend/models/Bucket.js`
- `backend/models/StorageObject.js`
- `backend/services/cache.service.js`

Behavior:

- Bucket metadata is stored in MongoDB
- Actual uploaded files go to `backend/uploads/storage/...`
- Bucket lists can be cached in Redis
- Public sharing serves files directly from disk

### Network

Files:

- `backend/routes/network.js`
- `backend/models/VPC.js`
- `backend/models/RouteTable.js`
- `backend/models/LoadBalancer.js`

Behavior:

- VPCs, subnets, route tables, and load balancers are MongoDB-backed models
- Main route tables are auto-created for VPCs
- Load balancers are simulated and flip from `provisioning` to `active` after a timer

### Billing

Files:

- `backend/routes/billing.js`
- `backend/models/Invoice.js`
- `backend/utils/pdfGenerator.js`

Behavior:

- Invoices are stored in MongoDB
- PDFs can be generated on demand
- Stripe checkout is supported if keys are configured
- Manual payment mode is also present

### Support / Tickets

Files:

- `backend/routes/support.js`
- `backend/models/Ticket.js`
- `backend/models/Notification.js`

Behavior:

- Tickets support pagination, filters, replies, attachments, and history
- Ticket files go under `backend/uploads/tickets`
- Admins can manage all tickets
- There are compatibility endpoints for older frontend behavior

### IAM and 2FA

Files:

- `backend/routes/iam.js`
- `backend/routes/twoFA.js`
- `backend/models/APIKey.js`
- `backend/models/TwoFA.js`
- `backend/services/keycloak-admin.service.js`

Behavior:

- API keys are generated and stored in MongoDB
- IAM policies are fetched from Keycloak realm roles
- 2FA is TOTP-based and uses QR codes plus backup codes

Important detail:

- IAM "policies" come from Keycloak roles, while local user authorization is still largely role/JWT based inside the Express app

### Admin

Files:

- `backend/routes/admin.js`

Behavior:

- Aggregates analytics from users, invoices, tickets, instances, metrics, and audit logs
- Supports user management and ticket management
- Adds another admin management layer on top of the standard routes

## 7. Real Docker-Managed Infrastructure Features

This repo does more than store records in Mongo.

The backend can also control real Docker containers through the Docker socket:

- Apache via `backend/services/container.service.js`
- Postgres / Redis / Metabase / VM via `backend/services/docker-manager.service.js`
- Browser VM marketplace sessions via `backend/services/vm.service.js`
- Jenkins via `backend/services/jenkins.service.js`

### How Docker access works

The backend connects to Docker using `dockerode` in:

- `backend/services/docker.service.js`

In Docker Compose production, the backend container mounts:

- `/var/run/docker.sock:/var/run/docker.sock`

That gives the backend direct control of the host Docker daemon.

### VM/session model

The browser VM feature is the most advanced real infrastructure flow.

`backend/services/vm.service.js` does the following:

1. checks per-user VM limits
2. validates allowed image families
3. finds an available host port
4. ensures the Docker image exists
5. creates a Mongo `VirtualMachine` record
6. creates and starts a Docker container
7. optionally waits for an HTTP service to become ready
8. stores the public URL in Mongo
9. schedules auto-cleanup based on TTL

This part is real container orchestration, not just simulation.

## 8. Data Layer

Primary data is stored in MongoDB through Mongoose models such as:

- `User`
- `Instance`
- `Invoice`
- `Metric`
- `Bucket`
- `StorageObject`
- `Ticket`
- `Notification`
- `VPC`
- `RouteTable`
- `LoadBalancer`
- `VirtualMachine`
- `AuditLog`
- `APIKey`
- `TwoFA`
- `Region`

Common patterns:

- ownership is tied to `req.user.id`
- many routes manually enforce ownership checks
- audit logs are written for important security and resource events

## 9. Docker and Nginx

### Production compose

`docker-compose.yml` defines:

- `nginx`
- `backend`
- `mongo`
- `redis`

Important details:

- Nginx exposes port `80`
- Backend is internal-only and exposed to the `bytesky_internal` network
- Mongo and Redis are internal-only
- Nginx proxies `/api` and `/uploads` to backend
- Frontend files are mounted directly into Nginx

### Nginx behavior

`nginx/nginx.conf` does three things:

1. serves static frontend files
2. proxies `/api/*` to `http://backend:5000/api/*`
3. proxies `/uploads/*` to backend file serving

It also uses `try_files ... /index.html`, which supports the SPA page-switching model.

### Backend image

`backend/Dockerfile` has:

- `base`
- `development`
- `production`

The image installs Node dependencies and also installs `docker-cli`, because the backend has infrastructure features that interact with Docker.

## 10. Development vs Production

### If you run only the backend directly

- frontend is served by Express
- Mongo and Redis must exist separately
- app is accessible on the backend port

### If you run production compose

- frontend is served by Nginx
- backend sits behind Nginx
- Mongo and Redis run as containers
- backend can talk to the host Docker daemon through the mounted socket

### Important repo observation

`docker-compose.dev.yml` currently defines only the backend service and still references `mongo` and `redis` in env defaults, but it does not define those services itself.

That means:

- `docker-compose.dev.yml` is not a full standalone development stack right now
- it is missing at least Mongo and Redis service definitions if you expect one-command local startup

## 11. CI / Automation

### GitHub Actions

`.github/workflows/ci.yml` currently does lightweight checks:

- install backend dependencies
- syntax-check `backend/server.js`
- validate Docker Compose config

There are no real automated tests yet.

### Jenkins

`Jenkinsfile` and `backend/services/jenkins.service.js` support a Dockerized Jenkins setup where:

- Jenkins can mount the project into its workspace
- Jenkins can install dependencies
- Jenkins can optionally build a Docker image
- the frontend can launch and manage Jenkins from the dashboard

## 12. What Is Simulated vs Real

### Simulated in MongoDB

- compute instances in `instances.js`
- metrics in `metrics.service.js`
- VPCs, route tables, load balancers
- much of the cloud billing/resource model

### Real Docker-backed features

- browser VM sessions
- Apache service
- Postgres service
- Redis service
- Metabase service
- Jenkins service

This distinction is one of the most important things to understand in the project.

## 13. Best Order To Learn The Codebase

If you want to understand the system quickly, read in this order:

1. `backend/server.js`
2. `backend/app.js`
3. `backend/config/env.js`
4. `backend/routes/index.js`
5. `frontend/js/script.js`
6. `backend/routes/auth.js` and `backend/services/auth.service.js`
7. `backend/routes/instances.js`
8. `backend/routes/storage.js`
9. `backend/routes/network.js`
10. `backend/routes/billing.js`
11. `backend/routes/support.js`
12. `backend/services/vm.service.js`
13. `backend/services/docker-manager.service.js`
14. `docker-compose.yml`
15. `nginx/nginx.conf`

## 14. Most Important Architectural Takeaways

- The frontend is a hand-written SPA with one large JS controller file.
- The backend is Express + Mongo with mixed architectural styles.
- Some cloud features are simulated data models, while others launch real Docker containers.
- Production deployment expects Nginx in front of the backend.
- Redis is optional for cache behavior but still included in readiness checks and Compose.
- Docker socket access is a core capability for the marketplace/VM/Jenkins features.
- The README is now behind the actual codebase. The app is more advanced than the README describes.

