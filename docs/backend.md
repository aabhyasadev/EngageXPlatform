# Backend Documentation

## Overview

The EngageX backend is built with Django and Django REST Framework, providing a robust RESTful API for the email marketing platform. The backend follows a modular, domain-driven architecture with 10 specialized Django apps.

## Tech Stack

- **Framework**: Django 4.x
- **API**: Django REST Framework
- **Database**: PostgreSQL 15+ (via Neon)
- **ORM**: Django ORM with Drizzle for TypeScript types
- **Authentication**: OpenID Connect (OIDC) + Session-based auth
- **Email**: SendGrid API
- **Payments**: Stripe API
- **Caching**: Redis (optional)
- **Task Scheduling**: Python schedule library

## Project Structure

```
backend/
├── apps/                           # Django applications
│   ├── accounts/                   # User & organization management
│   │   ├── models.py              # User, Organization, Membership
│   │   ├── serializers.py         # DRF serializers
│   │   ├── views.py               # API endpoints
│   │   └── permissions.py         # Custom permissions
│   ├── authentication/             # Auth flows
│   │   ├── views.py               # Sign-in, sign-up, OIDC
│   │   └── middleware.py          # Auth middleware
│   ├── subscriptions/              # Billing & plans
│   │   ├── models.py              # Subscription, Plan, Usage
│   │   ├── views.py               # Subscription API
│   │   ├── stripe_handlers.py     # Stripe webhooks
│   │   └── tasks.py               # Scheduled tasks
│   ├── contacts/                   # Contact management
│   │   ├── models.py              # Contact, ContactGroup
│   │   ├── views.py               # CRUD endpoints
│   │   └── importers.py           # CSV/Excel import
│   ├── domains/                    # Domain verification
│   │   ├── models.py              # Domain, DomainVerification
│   │   ├── views.py               # Verification API
│   │   └── validators.py          # DNS validation
│   ├── campaigns/                  # Email campaigns
│   │   ├── models.py              # Campaign, CampaignRecipient
│   │   ├── views.py               # Campaign API
│   │   └── senders.py             # Email sending logic
│   ├── templates/                  # Email templates
│   │   ├── models.py              # EmailTemplate
│   │   ├── views.py               # Template API
│   │   └── renderers.py           # Template rendering
│   ├── analytics/                  # Analytics & tracking
│   │   ├── models.py              # AnalyticsEvent, Stats
│   │   ├── views.py               # Analytics API
│   │   └── aggregators.py         # Data aggregation
│   ├── notifications/              # Notification system
│   │   ├── models.py              # Notification
│   │   ├── views.py               # Notification API
│   │   └── senders.py             # Multi-channel delivery
│   └── common/                     # Shared utilities
│       ├── middleware.py          # Common middleware
│       ├── viewsets.py            # Base viewsets
│       ├── tasks.py               # Task scheduler
│       └── utils.py               # Helper functions
├── config/                         # Django configuration
│   ├── settings/                  # Split settings
│   │   ├── base.py               # Common settings
│   │   ├── development.py        # Dev settings
│   │   └── production.py         # Prod settings
│   ├── urls.py                    # URL routing
│   ├── wsgi.py                    # WSGI application
│   └── asgi.py                    # ASGI application
├── requirements/                   # Python dependencies
│   ├── base.txt                   # Common packages
│   ├── dev.txt                    # Development packages
│   ├── prod.txt                   # Production packages
│   └── test.txt                   # Testing packages
├── manage.py                       # Django management script
├── Dockerfile                      # Container definition
└── Makefile                        # Common commands
```

## Database Schema

### Core Models

#### accounts.User
```python
class User(AbstractUser):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    avatar_url = models.URLField(blank=True)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### accounts.Organization
```python
class Organization(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### accounts.OrganizationMembership
```python
class OrganizationMembership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
```

#### subscriptions.Subscription
```python
class Subscription(models.Model):
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE)
    plan = models.CharField(max_length=50, choices=PLAN_CHOICES)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES)
    stripe_subscription_id = models.CharField(max_length=255, unique=True)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    trial_end = models.DateTimeField(null=True, blank=True)
```

#### campaigns.Campaign
```python
class Campaign(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    from_name = models.CharField(max_length=255)
    from_email = models.EmailField()
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
```

### Relationships

```
User ──┬── OrganizationMembership ──→ Organization
       │                                    │
       └── owns ──────────────────────────┘
                                            │
Organization ──┬── Subscription            │
               ├── Campaign                │
               ├── Contact                 │
               ├── ContactGroup            │
               ├── EmailTemplate           │
               ├── Domain                  │
               └── Notification            │
```

## API Endpoints

### Authentication

#### POST /api/auth/signin
Sign in with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "session_id": "abc123..."
}
```

#### POST /api/auth/signup
Create a new user account.

#### GET /api/auth/user
Get current authenticated user.

#### POST /api/auth/logout
End current session.

### Organizations

#### GET /api/organizations/
List user's organizations.

#### POST /api/organizations/
Create a new organization.

#### GET /api/organizations/{id}/
Get organization details.

#### PATCH /api/organizations/{id}/
Update organization.

#### DELETE /api/organizations/{id}/
Delete organization.

#### GET /api/organizations/{id}/members/
List organization members.

#### POST /api/organizations/{id}/invite/
Invite a team member.

### Campaigns

#### GET /api/campaigns/
List campaigns for current organization.

**Query Parameters:**
- `status`: Filter by status (draft, scheduled, sending, sent, cancelled)
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 20)

**Response:**
```json
{
  "count": 50,
  "next": "/api/campaigns/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Summer Sale 2024",
      "subject": "50% off everything!",
      "status": "sent",
      "sent_at": "2024-07-01T10:00:00Z",
      "stats": {
        "sent": 5000,
        "delivered": 4950,
        "opened": 2475,
        "clicked": 742
      }
    }
  ]
}
```

#### POST /api/campaigns/
Create a new campaign.

#### GET /api/campaigns/{id}/
Get campaign details.

#### PATCH /api/campaigns/{id}/
Update campaign.

#### DELETE /api/campaigns/{id}/
Delete campaign.

#### POST /api/campaigns/{id}/send/
Send or schedule campaign.

#### GET /api/campaigns/{id}/stats/
Get campaign statistics.

### Templates

#### GET /api/templates/
List email templates.

#### POST /api/templates/
Create a new template.

#### GET /api/templates/{id}/
Get template details.

#### PATCH /api/templates/{id}/
Update template.

#### DELETE /api/templates/{id}/
Delete template.

#### POST /api/templates/{id}/preview/
Preview template with test data.

### Contacts

#### GET /api/contacts/
List contacts.

#### POST /api/contacts/
Create a contact.

#### POST /api/contacts/import/
Import contacts from CSV/Excel.

**Request:**
```
Content-Type: multipart/form-data

file: [CSV/Excel file]
group_id: 123 (optional)
```

#### GET /api/contacts/{id}/
Get contact details.

#### PATCH /api/contacts/{id}/
Update contact.

#### DELETE /api/contacts/{id}/
Delete contact.

### Contact Groups

#### GET /api/contact-groups/
List contact groups.

#### POST /api/contact-groups/
Create a group.

#### GET /api/contact-groups/{id}/
Get group details.

#### POST /api/contact-groups/{id}/add-contacts/
Add contacts to group.

### Domains

#### GET /api/domains/
List verified domains.

#### POST /api/domains/
Register a new domain for verification.

**Request:**
```json
{
  "domain": "example.com"
}
```

**Response:**
```json
{
  "id": 1,
  "domain": "example.com",
  "status": "pending",
  "verification_records": {
    "spf": "v=spf1 include:sendgrid.net ~all",
    "dkim": "k=rsa; p=MIGfMA0GCSq...",
    "dmarc": "v=DMARC1; p=none;",
    "cname": "em1234.example.com CNAME u1234.wl.sendgrid.net"
  }
}
```

#### POST /api/domains/{id}/verify/
Trigger domain verification.

#### DELETE /api/domains/{id}/
Remove domain.

### Subscriptions

#### GET /api/subscription/current
Get current organization's subscription.

**Response:**
```json
{
  "plan": "pro",
  "status": "active",
  "current_period_end": "2024-08-01T00:00:00Z",
  "usage": {
    "contacts": 2500,
    "contacts_limit": 10000,
    "campaigns_this_month": 15,
    "campaigns_limit": 50,
    "emails_sent_this_month": 45000,
    "emails_limit": 100000
  }
}
```

#### POST /api/subscription/checkout
Create Stripe checkout session.

#### POST /api/subscription/portal
Get Stripe billing portal URL.

#### GET /api/subscription/plans
List available subscription plans.

#### GET /api/subscription/notifications
Get subscription-related notifications.

### Analytics

#### GET /api/dashboard/stats
Get dashboard statistics.

**Response:**
```json
{
  "total_contacts": 5000,
  "total_campaigns": 50,
  "emails_sent_today": 1250,
  "open_rate": 0.247,
  "click_rate": 0.082,
  "recent_campaigns": [...]
}
```

#### GET /api/analytics/events
Get analytics events.

**Query Parameters:**
- `campaign_id`: Filter by campaign
- `event_type`: open, click, bounce, unsubscribe
- `start_date`: Filter start date
- `end_date`: Filter end date

#### GET /api/campaigns/{id}/analytics
Get detailed campaign analytics.

## Authentication

### Session-Based Authentication

Sessions are stored in PostgreSQL using `connect-pg-simple`:

```python
# settings/base.py
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 2592000  # 30 days
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = True  # Production only
```

### Organization Context

Every request is scoped to an organization:

```python
# middleware.py
class OrganizationMiddleware:
    def process_request(self, request):
        if request.user.is_authenticated:
            # Get organization from session or header
            org_id = request.session.get('current_organization_id')
            request.organization = Organization.objects.get(id=org_id)
```

### Permission Checks

```python
# permissions.py
class IsOrganizationMember(BasePermission):
    def has_permission(self, request, view):
        return OrganizationMembership.objects.filter(
            user=request.user,
            organization=request.organization,
            is_active=True
        ).exists()

class IsOrganizationOwner(BasePermission):
    def has_permission(self, request, view):
        return request.organization.owner == request.user
```

## Business Logic

### Campaign Sending

```python
# campaigns/senders.py
class CampaignSender:
    def send_campaign(self, campaign):
        # Get recipients
        recipients = campaign.get_recipients()
        
        # Render template for each recipient
        for recipient in recipients:
            html_content = self.render_template(
                campaign.template,
                recipient.get_context()
            )
            
            # Send via SendGrid
            self.send_email(
                to=recipient.email,
                from_email=campaign.from_email,
                from_name=campaign.from_name,
                subject=campaign.subject,
                html=html_content
            )
            
            # Track delivery
            AnalyticsEvent.objects.create(
                campaign=campaign,
                recipient=recipient,
                event_type='sent'
            )
```

### Subscription Management

```python
# subscriptions/stripe_handlers.py
@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META['HTTP_STRIPE_SIGNATURE']
    
    # Verify webhook signature
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
    
    # Handle events
    if event.type == 'customer.subscription.created':
        handle_subscription_created(event.data.object)
    elif event.type == 'customer.subscription.updated':
        handle_subscription_updated(event.data.object)
    elif event.type == 'invoice.payment_succeeded':
        handle_payment_succeeded(event.data.object)
    
    return JsonResponse({'status': 'success'})
```

### Usage Tracking

```python
# subscriptions/tasks.py
def check_usage_limits(organization):
    subscription = organization.subscription
    usage = subscription.get_current_usage()
    limits = subscription.plan.get_limits()
    
    # Check contacts limit
    if usage['contacts'] >= limits['contacts'] * 0.9:
        send_limit_warning(organization, 'contacts', usage['contacts'])
    
    # Check campaigns limit
    if usage['campaigns_this_month'] >= limits['campaigns'] * 0.9:
        send_limit_warning(organization, 'campaigns', usage['campaigns'])
    
    # Enforce hard limits
    if usage['contacts'] >= limits['contacts']:
        raise UsageLimitExceeded('contacts')
```

## Testing

### Running Tests

```bash
cd backend
pytest --cov=apps --cov-report=html
```

### Test Structure

```
backend/tests/
├── test_accounts.py
├── test_campaigns.py
├── test_subscriptions.py
└── fixtures/
    ├── users.json
    └── organizations.json
```

### Example Test

```python
# tests/test_campaigns.py
import pytest
from apps.campaigns.models import Campaign

@pytest.mark.django_db
def test_create_campaign(authenticated_client, organization):
    response = authenticated_client.post('/api/campaigns/', {
        'name': 'Test Campaign',
        'subject': 'Test Subject',
        'from_email': 'test@example.com',
        'template_id': 1
    })
    
    assert response.status_code == 201
    assert Campaign.objects.count() == 1
    campaign = Campaign.objects.first()
    assert campaign.organization == organization
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/engagex

# Django
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=engagex.com,www.engagex.com

# SendGrid
SENDGRID_API_KEY=SG.xxx
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG.xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Redis
REDIS_URL=redis://localhost:6379/0

# OIDC
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_DISCOVERY_URL=https://replit.com/.well-known/openid-configuration
```

### Settings Files

**base.py**: Common settings for all environments
**development.py**: Development-specific settings (DEBUG=True, etc.)
**production.py**: Production settings (security, performance)

## Common Tasks

### Create Superuser

```bash
cd backend
python manage.py createsuperuser
```

### Run Migrations

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Collect Static Files

```bash
cd backend
python manage.py collectstatic --noinput
```

### Load Fixtures

```bash
cd backend
python manage.py loaddata demo.json
```

### Shell Access

```bash
cd backend
python manage.py shell
```

## Performance Optimization

### Database Optimization

```python
# Use select_related for foreign keys
campaigns = Campaign.objects.select_related(
    'organization', 'template'
).all()

# Use prefetch_related for many-to-many
campaigns = Campaign.objects.prefetch_related(
    'recipients', 'analytics_events'
).all()

# Add database indexes
class Meta:
    indexes = [
        models.Index(fields=['organization', 'status']),
        models.Index(fields=['created_at']),
    ]
```

### Caching

```python
from django.core.cache import cache

def get_campaign_stats(campaign_id):
    cache_key = f'campaign_stats_{campaign_id}'
    stats = cache.get(cache_key)
    
    if stats is None:
        stats = calculate_campaign_stats(campaign_id)
        cache.set(cache_key, stats, 3600)  # 1 hour
    
    return stats
```

## Deployment

### Running in Production

```bash
# Install dependencies
pip install -r requirements/prod.txt

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Start with Gunicorn
gunicorn config.wsgi:application \
    --bind 0.0.0.0:8001 \
    --workers 4 \
    --timeout 120
```

### Docker Deployment

```bash
# Build image
docker build -t engagex-backend .

# Run container
docker run -d \
    -p 8001:8001 \
    --env-file .env.production \
    engagex-backend
```

## Troubleshooting

### Common Issues

**Database connection errors**:
```bash
# Check DATABASE_URL format
# postgresql://user:password@host:port/database
```

**Migration conflicts**:
```bash
python manage.py migrate --fake-initial
```

**Static files not loading**:
```bash
python manage.py collectstatic --clear
```

## API Documentation

Full API documentation is available at:
- Development: http://localhost:8001/api/docs/
- Production: https://api.engagex.com/docs/

Generated using drf-spectacular (OpenAPI 3.0).
