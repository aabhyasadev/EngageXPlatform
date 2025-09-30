# EngageX Architecture

## Overview

EngageX is a comprehensive multi-tenant email marketing platform built with a modern full-stack architecture. The system is designed for scalability, maintainability, and security, serving multiple organizations with complete data isolation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   React SPA (TypeScript + Vite)                        │ │
│  │   - Wouter Router                                      │ │
│  │   - TanStack Query (State Management)                 │ │
│  │   - shadcn/ui + Tailwind CSS                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      BFF (Backend for Frontend)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   Express.js Server (TypeScript)                       │ │
│  │   - Session Management                                 │ │
│  │   - Request Proxying                                   │ │
│  │   - Static File Serving                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer (Django)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   Django REST Framework                                │ │
│  │   ├── Authentication (OIDC)                            │ │
│  │   ├── Accounts & Organizations                         │ │
│  │   ├── Subscriptions & Billing                          │ │
│  │   ├── Email Campaigns                                  │ │
│  │   ├── Templates & Contacts                             │ │
│  │   ├── Domain Verification                              │ │
│  │   ├── Analytics & Tracking                             │ │
│  │   └── Notifications                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
┌──────────────────────────┐  ┌─────────────────────────┐
│   Data Layer             │  │   External Services     │
│  ┌────────────────────┐  │  │  ┌────────────────────┐ │
│  │  PostgreSQL        │  │  │  │  SendGrid          │ │
│  │  - User Data       │  │  │  │  - Email Delivery  │ │
│  │  - Organizations   │  │  │  └────────────────────┘ │
│  │  - Campaigns       │  │  │  ┌────────────────────┐ │
│  │  - Analytics       │  │  │  │  Stripe            │ │
│  └────────────────────┘  │  │  │  - Payments        │ │
│  ┌────────────────────┐  │  │  │  - Subscriptions   │ │
│  │  Redis (Optional)  │  │  │  └────────────────────┘ │
│  │  - Caching         │  │  │  ┌────────────────────┐ │
│  │  - Sessions        │  │  │  │  Replit OIDC       │ │
│  └────────────────────┘  │  │  │  - Authentication  │ │
└──────────────────────────┘  │  └────────────────────┘ │
                              └─────────────────────────┘
```

## Architecture Principles

### 1. Separation of Concerns
- **Frontend**: User interface and client-side logic
- **BFF (Express)**: Session management, request proxying, static file serving
- **Backend (Django)**: Business logic, data persistence, external API integration
- **Database**: Data storage and integrity

### 2. Multi-Tenancy
- **Organization-based isolation**: All data is scoped to organizations
- **Shared schema approach**: Single database with organization_id foreign keys
- **Row-level security**: Queries automatically filtered by organization context
- **Resource isolation**: Each organization has independent quotas and limits

### 3. Modularity
- **Django Apps**: Organized by domain (accounts, campaigns, subscriptions, etc.)
- **Clean boundaries**: Each app has well-defined responsibilities
- **Minimal coupling**: Apps communicate through well-defined interfaces
- **Testability**: Each module can be tested independently

### 4. Scalability
- **Stateless API**: No server-side session state in Django
- **Horizontal scaling**: Multiple Django instances behind load balancer
- **Database connection pooling**: Efficient database resource utilization
- **Caching strategy**: Redis for frequently accessed data
- **Asynchronous tasks**: Background processing for email sending

## Domain-Driven Design

### Core Domains

#### 1. Accounts Domain (`apps/accounts/`)
**Purpose**: User and organization management

**Models**:
- `User`: Platform users with authentication credentials
- `Organization`: Multi-tenant organizations
- `OrganizationMembership`: User-organization relationships with roles
- `Invitation`: Pending team member invitations

**Key Responsibilities**:
- User registration and profile management
- Organization CRUD operations
- Team member management
- Role-based permissions

#### 2. Authentication Domain (`apps/authentication/`)
**Purpose**: User authentication and authorization

**Components**:
- OIDC integration with Replit
- Session management
- Password authentication (local)
- Token-based authentication

**Key Responsibilities**:
- Sign-in/sign-up flows
- Session creation and validation
- OAuth callback handling
- User context management

#### 3. Subscriptions Domain (`apps/subscriptions/`)
**Purpose**: Billing and subscription management

**Models**:
- `Subscription`: Organization subscription records
- `Plan`: Available subscription tiers
- `Usage`: Resource usage tracking
- `BillingHistory`: Payment records

**Key Responsibilities**:
- Stripe payment processing
- Subscription lifecycle management
- Usage tracking and enforcement
- Invoice generation

#### 4. Campaigns Domain (`apps/campaigns/`)
**Purpose**: Email campaign creation and sending

**Models**:
- `Campaign`: Email campaign records
- `CampaignRecipient`: Individual recipients
- `CampaignSchedule`: Scheduled sends

**Key Responsibilities**:
- Campaign creation and editing
- Recipient list management
- Scheduled sending
- Delivery tracking

#### 5. Templates Domain (`apps/templates/`)
**Purpose**: Reusable email templates

**Models**:
- `EmailTemplate`: HTML/text email templates
- `TemplateVariable`: Dynamic content placeholders

**Key Responsibilities**:
- Template CRUD operations
- Rich text editing support
- Variable substitution
- Template preview

#### 6. Contacts Domain (`apps/contacts/`)
**Purpose**: Contact and group management

**Models**:
- `Contact`: Individual email contacts
- `ContactGroup`: Contact segmentation
- `ContactGroupMembership`: Group membership

**Key Responsibilities**:
- Contact import (CSV/Excel)
- Contact CRUD operations
- Group management
- Segmentation logic

#### 7. Domains Domain (`apps/domains/`)
**Purpose**: Custom domain verification

**Models**:
- `Domain`: Verified sending domains
- `DomainVerification`: DNS verification records

**Key Responsibilities**:
- Domain registration
- DNS record validation
- SPF/DKIM/DMARC verification
- Verification status tracking

#### 8. Analytics Domain (`apps/analytics/`)
**Purpose**: Campaign performance tracking

**Models**:
- `AnalyticsEvent`: Email events (opens, clicks, bounces)
- `CampaignStats`: Aggregated statistics

**Key Responsibilities**:
- Event tracking
- Open/click tracking
- Bounce handling
- Performance reporting

#### 9. Notifications Domain (`apps/notifications/`)
**Purpose**: In-app and email notifications

**Models**:
- `Notification`: User notifications
- `NotificationPreference`: User preferences

**Key Responsibilities**:
- Notification creation
- Delivery (in-app, email)
- Read/unread tracking
- Preference management

#### 10. Common Domain (`apps/common/`)
**Purpose**: Shared utilities and cross-cutting concerns

**Components**:
- Base viewsets and mixins
- Custom middleware
- Shared utilities
- Constants and enums
- Background task management

## Data Flow

### Request Flow

1. **Client Request**
   ```
   User Action → React Component → TanStack Query
   ```

2. **BFF Layer**
   ```
   HTTP Request → Express Server → Session Check → Proxy to Django
   ```

3. **API Layer**
   ```
   Django Middleware → Authentication → View → Serializer → Business Logic
   ```

4. **Data Layer**
   ```
   ORM Query → PostgreSQL → Result → Serializer → JSON Response
   ```

5. **Response Flow**
   ```
   JSON → BFF → Client → React Update → UI Render
   ```

### Campaign Sending Flow

```
1. User creates campaign
   ↓
2. Campaign stored in database
   ↓
3. User schedules send
   ↓
4. Background task picks up campaign
   ↓
5. Load recipients from contact groups
   ↓
6. For each recipient:
   - Render template with variables
   - Send via SendGrid API
   - Track delivery status
   - Log analytics event
   ↓
7. Update campaign statistics
   ↓
8. Notify user of completion
```

## Authentication Flow

### OpenID Connect (OIDC) Flow

```
1. User clicks "Sign in with Replit"
   ↓
2. Redirect to Replit authorization endpoint
   ↓
3. User authenticates with Replit
   ↓
4. Replit redirects to callback URL with code
   ↓
5. Exchange code for tokens
   ↓
6. Fetch user info from Replit
   ↓
7. Create or update user in database
   ↓
8. Create session in PostgreSQL
   ↓
9. Redirect to dashboard
```

### Session Management

- Sessions stored in PostgreSQL (not in-memory)
- Session expiry: 30 days (configurable)
- Automatic session refresh on activity
- Secure cookie with HttpOnly and SameSite flags

## Database Schema Design

### Key Design Patterns

#### 1. Multi-Tenancy Pattern
```sql
-- Every tenant-scoped table has organization_id
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255),
    ...
);

-- Enforced at application level via middleware
```

#### 2. Soft Delete Pattern
```sql
-- Records are marked as deleted, not removed
ALTER TABLE contacts ADD COLUMN deleted_at TIMESTAMP;

-- Queries filter out deleted records
SELECT * FROM contacts WHERE deleted_at IS NULL;
```

#### 3. Audit Trail Pattern
```sql
-- Track who and when for changes
ALTER TABLE campaigns ADD COLUMN created_by_id INTEGER;
ALTER TABLE campaigns ADD COLUMN updated_by_id INTEGER;
ALTER TABLE campaigns ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
```

#### 4. Polymorphic Relationships
```sql
-- Notifications can be for different object types
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50),  -- 'campaign', 'subscription', etc.
    object_id INTEGER,
    ...
);
```

## Security Architecture

### Defense in Depth

1. **Network Layer**
   - HTTPS/TLS encryption
   - Firewall rules
   - DDoS protection

2. **Application Layer**
   - CSRF protection (Django middleware)
   - SQL injection prevention (ORM)
   - XSS prevention (React escaping)
   - Rate limiting
   - Input validation

3. **Authentication Layer**
   - OpenID Connect (OIDC)
   - Secure session management
   - Password hashing (PBKDF2)
   - Multi-factor authentication support

4. **Authorization Layer**
   - Role-based access control (RBAC)
   - Organization-level permissions
   - Resource-level permissions
   - API endpoint protection

5. **Data Layer**
   - Encrypted connections (SSL/TLS)
   - Data encryption at rest
   - Regular backups
   - Access logging

### RBAC Implementation

**Roles**:
- **Owner**: Full access, billing management, team management
- **Admin**: Full access except billing
- **Campaign Manager**: Create and manage campaigns
- **Analyst**: Read-only access to analytics
- **Editor**: Create and edit content (templates, contacts)

**Permission Checks**:
```python
# Middleware checks organization membership
def check_organization_access(user, organization):
    return OrganizationMembership.objects.filter(
        user=user,
        organization=organization,
        is_active=True
    ).exists()

# View-level permission checks
@permission_required('campaigns.create_campaign')
def create_campaign(request):
    ...
```

## Scalability Considerations

### Horizontal Scaling

**Frontend/BFF**:
- Stateless Express servers
- Load balancer distribution
- CDN for static assets

**Backend**:
- Multiple Django instances
- Load balancer (Nginx/HAProxy)
- Shared PostgreSQL database
- Redis for distributed caching

### Vertical Scaling

**Database Optimization**:
- Proper indexing
- Query optimization
- Connection pooling
- Read replicas for analytics

**Caching Strategy**:
- Redis for session storage
- Query result caching
- Template caching
- API response caching

### Background Processing

**Asynchronous Tasks**:
- Email sending queue
- Analytics aggregation
- Report generation
- Scheduled campaigns

**Implementation Options**:
- Celery with Redis/RabbitMQ
- Django-Q
- Custom task queue

## Performance Optimization

### Frontend Performance
- Code splitting (React lazy loading)
- Bundle optimization (Vite)
- Image optimization
- Lazy loading for images
- React.memo for expensive components
- Virtual scrolling for large lists

### Backend Performance
- Database query optimization
- N+1 query prevention (select_related, prefetch_related)
- Pagination for large datasets
- API response compression
- Database connection pooling

### Monitoring & Observability

**Metrics Collection**:
- Prometheus for metrics
- Grafana for visualization
- Application performance monitoring
- Error tracking (Sentry)

**Key Metrics**:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Database query time
- Email delivery rate
- Campaign success rate

## Deployment Architecture

### Production Environment

```
┌─────────────────────┐
│   Load Balancer     │
│   (Nginx/HAProxy)   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Express │  │ Express │
│  (BFF)  │  │  (BFF)  │
└────┬────┘  └────┬────┘
     │            │
     └──────┬─────┘
            ▼
     ┌────────────┐
     │   Django   │
     │  (API x3)  │
     └──────┬─────┘
            │
    ┌───────┴────────┐
    ▼                ▼
┌──────────┐    ┌─────────┐
│ PostgreSQL│    │  Redis  │
│  (Primary)│    │ (Cache) │
└──────────┘    └─────────┘
```

### High Availability

**Database**:
- Primary-replica setup
- Automatic failover
- Regular backups
- Point-in-time recovery

**Application**:
- Multi-instance deployment
- Health checks
- Graceful shutdown
- Zero-downtime deployments

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript | UI framework |
| Routing | Wouter | Client-side routing |
| State | TanStack Query | Server state management |
| Styling | Tailwind CSS + shadcn/ui | UI styling and components |
| BFF | Express.js + TypeScript | Backend for frontend |
| API | Django + DRF | RESTful API |
| Database | PostgreSQL | Primary data store |
| Cache | Redis | Session and query caching |
| Email | SendGrid | Email delivery |
| Payments | Stripe | Subscription billing |
| Auth | Replit OIDC | User authentication |
| Monitoring | Prometheus + Grafana | Metrics and visualization |
| CI/CD | GitHub Actions | Automated testing and deployment |

## Design Patterns

### Backend Patterns
- **Repository Pattern**: Storage interface abstracts data access
- **Service Layer**: Business logic separated from views
- **ViewSet Pattern**: DRF viewsets for CRUD operations
- **Serializer Pattern**: Data validation and transformation
- **Middleware Pattern**: Cross-cutting concerns (auth, logging)

### Frontend Patterns
- **Component Composition**: Reusable UI components
- **Custom Hooks**: Shared business logic
- **Provider Pattern**: Context for global state
- **Container/Presenter**: Separation of logic and UI
- **Higher-Order Components**: Component enhancement

## Future Architecture Considerations

### Planned Improvements
- [ ] Microservices architecture for larger scale
- [ ] Event-driven architecture with message queue
- [ ] GraphQL API for flexible data fetching
- [ ] WebSocket support for real-time updates
- [ ] Service mesh for microservices communication
- [ ] Kubernetes deployment for container orchestration

### Scalability Targets
- Support 10,000+ organizations
- Handle 1M+ emails per day
- Sub-200ms API response time
- 99.9% uptime SLA
- Horizontal scaling to 20+ instances
