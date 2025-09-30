# EngageX Backend

Django-based backend API for EngageX email marketing platform.

## Architecture

### Project Structure
```
backend/
├── apps/                      # Domain-specific applications
│   ├── accounts/             # User and organization management
│   ├── analytics/            # Campaign analytics and tracking
│   ├── authentication/       # Auth flows (signup, signin, sessions)
│   ├── campaigns/            # Email campaign management
│   ├── common/               # Shared utilities and middleware
│   ├── contacts/             # Contact and group management
│   ├── domains/              # Domain verification
│   ├── notifications/        # Notification system
│   ├── subscriptions/        # Billing and subscription management
│   └── templates/            # Email template management
├── config/                   # Django configuration
│   ├── settings/            # Environment-specific settings
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py              # URL routing
│   ├── wsgi.py              # WSGI application
│   └── asgi.py              # ASGI application
├── requirements/            # Python dependencies
│   ├── base.txt
│   ├── development.txt
│   ├── production.txt
│   └── test.txt
├── logs/                    # Application logs
├── manage.py               # Django management script
└── demo.json              # Database dump for testing
```

## Technology Stack

- **Framework**: Django 5.2.6 + Django REST Framework
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: OpenID Connect (Replit), Session-based
- **Payment Processing**: Stripe
- **Email Service**: SendGrid
- **Task Scheduling**: Python Schedule (lightweight scheduler)
- **Server**: Gunicorn (production)

## Getting Started

### Prerequisites
- Python 3.11+
- PostgreSQL database
- Stripe account (for subscriptions)
- SendGrid account (for email)

### Installation

1. **Install dependencies**
   ```bash
   make install
   # or
   pip install -r requirements/development.txt
   ```

2. **Set up environment variables**
   ```bash
   cp .envs/.env.example .envs/.env.development
   # Edit .envs/.env.development with your configuration
   ```

3. **Run migrations**
   ```bash
   make migrate
   ```

4. **Start development server**
   ```bash
   make run
   # Server runs on http://localhost:8001
   ```

5. **Start background scheduler** (in separate terminal)
   ```bash
   make scheduler
   ```

## Environment Variables

Required environment variables (see `.envs/.env.example`):

```env
# Django
SECRET_KEY=your-secret-key
DEBUG=True

# Database
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=your-password
PGHOST=your-host.neon.tech
PGPORT=5432

# Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLIC_KEY=pk_test_...

# SendGrid
SENDGRID_API_KEY=SG...
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG...

# Session
SESSION_SECRET=your-session-secret
```

## Development Commands

```bash
# Database
make migrate              # Run migrations
make makemigrations      # Create new migrations

# Server
make run                 # Start development server
make scheduler           # Start background scheduler

# Testing
make test               # Run tests
make check              # Django system checks

# Code Quality
make format             # Format code
make lint               # Run linters

# Utilities
make shell              # Django shell
make dump-db            # Export database to demo.json
make load-db            # Import database from demo.json
make clean              # Clean cache files
```

## API Documentation

### Authentication
- `POST /signup/send-otp/` - Send verification OTP
- `POST /signup/verify-otp/` - Verify OTP and create account
- `POST /signin/authenticate/` - Authenticate user
- `GET /auth/user` - Get current user
- `POST /auth/logout` - Logout

### Organizations & Users
- `GET /users/` - List organization users
- `POST /invitations/` - Invite team member
- `GET /invitations/` - List invitations

### Contacts
- `GET /contacts/` - List contacts
- `POST /contacts/` - Create contact
- `POST /contacts/import/` - Import from file
- `GET /contact-groups/` - List contact groups

### Campaigns
- `GET /campaigns/` - List campaigns
- `POST /campaigns/` - Create campaign
- `POST /campaigns/{id}/send/` - Send campaign
- `GET /campaigns/{id}/analytics/` - Campaign metrics

### Templates
- `GET /templates/` - List email templates
- `POST /templates/` - Create template

### Subscriptions
- `GET /subscription/current` - Current subscription
- `GET /subscription/plans-detailed` - Available plans
- `POST /subscription/create-checkout-session/` - Start subscription
- `POST /subscription/stripe-webhook/` - Stripe webhooks

### Domains
- `GET /domains/` - List verified domains
- `POST /domains/` - Add domain
- `POST /domains/{id}/verify/` - Verify domain

### Analytics
- `GET /dashboard/stats` - Dashboard statistics
- `GET /analytics/events/` - Analytics events

## Architecture Decisions

### Modular App Structure
The backend follows a domain-driven design with 10 specialized apps, each handling a specific business domain. This provides:
- Clear separation of concerns
- Easier testing and maintenance
- Better code organization
- Independent scaling potential

### Database Design
- Multi-tenant architecture with organization-based data isolation
- All tables use explicit `db_table` names for consistency
- UUIDs for primary keys
- Proper indexing for query performance

### Authentication Flow
1. User authenticates via Replit OIDC
2. Session created in PostgreSQL
3. User profile and organization loaded
4. Subscription status verified
5. Feature access controlled by middleware

### Subscription System
- 4-tier plan structure (Free Trial, Basic, Pro, Premium)
- Stripe for payment processing
- Usage tracking and limit enforcement
- Automated notifications for subscription events
- Webhook idempotency with database tracking

## Deployment

### Docker
```bash
make docker-build
make docker-run
```

### Manual Deployment
1. Set `DJANGO_SETTINGS_MODULE=config.settings.production`
2. Run migrations: `python manage.py migrate`
3. Collect static files: `python manage.py collectstatic`
4. Start Gunicorn: `gunicorn config.wsgi:application`
5. Start scheduler: `python manage.py start_scheduler`

## Testing

```bash
# Run all tests
make test

# Run specific app tests
python manage.py test apps.accounts

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL connection string
- Check firewall/network settings
- Ensure database exists and migrations are run

### Stripe Webhooks Not Working
- Verify webhook secret matches Stripe dashboard
- Check webhook endpoint is publicly accessible
- Review webhook event logs in Stripe dashboard

### SendGrid Email Not Sending
- Verify API key is valid
- Check domain verification status
- Review SendGrid activity logs

## Contributing

1. Create feature branch from `main`
2. Make changes following code style
3. Run tests and linting
4. Submit pull request

## License

Proprietary - All rights reserved
