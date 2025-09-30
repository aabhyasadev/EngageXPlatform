# EngageX Email Marketing Platform

## Overview

EngageX is a comprehensive multi-tenant email marketing platform that enables organizations to create, manage, and track email campaigns. Built with a modern full-stack architecture, it features a React/TypeScript frontend with a Django REST API backend, supporting subscription-based access with tiered feature sets.

The platform handles the complete email marketing lifecycle: contact management, template creation, campaign execution, domain verification for authenticated sending, real-time analytics, and subscription billing through Stripe integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript 5.6 for type safety
- Vite 5.4 as the build tool and dev server
- Wouter 3.3 for lightweight client-side routing
- TanStack Query 5.x for server state management and caching
- shadcn/ui components built on Radix UI primitives
- Tailwind CSS 3.4 for utility-first styling
- React Hook Form 7.x for form management
- TipTap for rich text editing (email templates)
- Recharts for analytics visualization

**BFF Pattern (Backend for Frontend):**
- Express.js TypeScript server acts as a gateway between React and Django
- Handles session management and authentication state
- Proxies API requests to Django with signed authentication headers
- Serves static files and manages WebSocket connections for development
- Uses HMAC-SHA256 signatures to securely bridge user sessions to Django

**Authentication Flow:**
- OpenID Connect (OIDC) integration with Replit for user authentication
- Session-based auth stored in PostgreSQL via connect-pg-simple
- Passport.js strategy for OIDC token validation
- Express maintains sessions and forwards authenticated user context to Django

### Backend Architecture

**Django REST Framework API:**
- Modular app structure with 10 domain-specific applications
- Domain-driven design with clear separation of concerns
- Each app encapsulates related models, views, serializers, and business logic
- Custom viewsets inherit from `BaseOrganizationViewSet` for automatic tenant isolation

**Core Applications:**
1. **accounts** - User management, organizations, multi-tenant memberships with RBAC
2. **authentication** - Sign-up/sign-in flows, OIDC integration, OTP verification
3. **subscriptions** - Stripe billing, plan management, usage tracking, webhook processing
4. **contacts** - Contact lists, groups, CSV/Excel import, subscription management
5. **templates** - Email template CRUD with rich text support
6. **campaigns** - Campaign creation, scheduling, sending, recipient tracking
7. **domains** - DNS verification (DKIM, SPF, DMARC, CNAME) for authenticated sending
8. **analytics** - Event tracking (opens, clicks, bounces, unsubscribes), dashboard stats
9. **notifications** - Multi-channel notifications for subscription events
10. **common** - Shared utilities, middleware, constants, background tasks

**Multi-Tenancy:**
- Organization-scoped data isolation enforced at the model and viewset level
- Users can belong to multiple organizations via OrganizationMembership
- Session tracks current active organization for context-aware queries
- All queries automatically filtered by organization to prevent data leakage

**Authentication Bridge:**
- Custom `SignedHeaderAuthentication` class verifies HMAC signatures from Express
- User data passed via `X-User-Data` and `X-User-Signature` headers
- Timestamp validation prevents replay attacks (5-minute window)
- Falls back to Django session authentication for direct API access

**Subscription & Usage Enforcement:**
- Middleware checks subscription status and feature availability
- Decorator `@requires_plan_feature` restricts endpoint access by plan tier
- Real-time usage tracking for contacts, campaigns, and emails sent
- Automatic limit checks before resource creation
- Usage metrics updated transactionally to ensure accuracy

### Data Storage

**PostgreSQL Database:**
- Hosted on Neon serverless platform for scalability
- Drizzle ORM used for TypeScript schema definition (frontend/shared)
- Django ORM for backend model definitions
- UUID primary keys for all entities to support distributed systems
- JSONB columns for flexible metadata storage

**Session Storage:**
- PostgreSQL-backed sessions via connect-pg-simple
- Custom `sessions` table with indexed expiration for cleanup
- 1-week session TTL with httpOnly, secure cookies

**Schema Design Patterns:**
- Soft deletes via status fields (is_subscribed, is_active)
- Audit trails with created_at/updated_at timestamps
- Composite unique constraints for tenant-scoped uniqueness
- Foreign key cascades configured per business logic requirements

### External Dependencies

**Email Delivery - SendGrid:**
- Transactional and bulk email sending via SendGrid API
- Domain authentication (DKIM, SPF) for improved deliverability
- Webhook integration for delivery status updates
- Template rendering with HTML and plain text fallbacks
- Rate limiting and retry logic for failed sends

**Payment Processing - Stripe:**
- Subscription management with recurring billing
- Checkout sessions for plan upgrades
- Customer portal for self-service billing management
- Webhook event processing with idempotency (ProcessedWebhookEvent table)
- Payment method storage and card management
- Invoice history and failed payment handling

**DNS Verification:**
- Python dnspython library for DNS record validation
- Automated verification tasks via Celery (optional) or Python schedule
- TXT, CNAME, DKIM, DMARC record generation and checking
- Domain status tracking (pending, verified, failed)

**Background Task Processing:**
- Python schedule library for lightweight periodic tasks
- Custom management command `runserver_with_scheduler` runs scheduler alongside Django
- Tasks: domain verification, trial expiration notifications, usage monitoring
- Designed for migration to Celery/Redis for production scaling

**Monitoring & Logging:**
- Prometheus metrics collection for Django and Express
- Grafana dashboards for visualization
- Alertmanager for notification routing
- Health check endpoints at /health for both services
- Structured logging with request correlation

**Development Tools:**
- Docker Compose orchestration for local development
- Multi-stage Dockerfiles for backend, frontend, and workers
- Replit-specific integrations (cartographer, dev-banner, error overlay)
- Hot module replacement via Vite for frontend development
- Django debug toolbar and django-extensions for backend debugging