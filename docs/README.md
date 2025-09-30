# EngageX Documentation

Welcome to the EngageX platform documentation. This comprehensive guide covers all aspects of the email marketing platform, from architecture to deployment.

## 📚 Documentation Index

### Core Documentation
- **[Architecture](architecture.md)** - System architecture, design patterns, and technical overview
- **[Backend](backend.md)** - Django backend API, models, and business logic
- **[Frontend](frontend.md)** - React frontend, components, and user interface
- **[Deployment](deployment.md)** - Deployment guides, infrastructure, and CI/CD

## 🎯 Quick Links

### Getting Started
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)

### For Developers
- [Backend API Documentation](backend.md#api-endpoints)
- [Frontend Component Guide](frontend.md#component-library)
- [Database Schema](backend.md#database-schema)
- [Authentication Flow](backend.md#authentication)

### For DevOps
- [Deployment Guide](deployment.md)
- [Monitoring Setup](../monitoring/README.md)
- [CI/CD Pipeline](.github/workflows/ci.yml)

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- Python 3.11 or higher
- PostgreSQL 15 or higher
- Redis 7.x (optional, for caching)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/engagex.git
   cd engagex
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements/dev.txt
   ```

4. **Configure environment variables**
   ```bash
   # Copy example environment files
   cp backend/.env.example backend/.env.development
   
   # Edit the file with your configuration
   vim backend/.env.development
   ```

5. **Set up the database**
   ```bash
   cd backend
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Load demo data (optional)**
   ```bash
   cd backend
   python manage.py loaddata demo.json
   ```

7. **Start the development servers**
   ```bash
   # From project root
   npm run dev
   ```

   This starts:
   - Frontend (Express + Vite): http://localhost:5000
   - Backend (Django): http://localhost:8001

### Environment Configuration

Create a `.env.development` file in the `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/engagex

# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Email (SendGrid)
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key

# Session
SESSION_SECRET=your-session-secret

# Redis (optional)
REDIS_URL=redis://localhost:6379/0
```

### Running the Application

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
# Build frontend
npm run build

# Start production servers
npm run start
```

## 🏗️ Project Structure

```
engagex/
├── frontend/                 # Frontend application
│   ├── client/              # React application
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── pages/       # Page components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   └── lib/         # Utilities and helpers
│   │   └── index.html
│   ├── server/              # Express BFF layer
│   │   ├── index.ts         # Server entry point
│   │   ├── routes.ts        # API routes
│   │   └── storage.ts       # Storage interface
│   ├── shared/              # Shared types/schemas
│   ├── tsconfig.json        # TypeScript configuration
│   └── tailwind.config.ts   # Tailwind CSS configuration
│
├── backend/                  # Django backend
│   ├── apps/                # Django applications
│   │   ├── accounts/        # User & organization management
│   │   ├── authentication/  # Auth flows & OIDC
│   │   ├── subscriptions/   # Billing & plans
│   │   ├── contacts/        # Contact management
│   │   ├── domains/         # Domain verification
│   │   ├── campaigns/       # Email campaigns
│   │   ├── templates/       # Email templates
│   │   ├── analytics/       # Analytics & tracking
│   │   ├── notifications/   # Notification system
│   │   └── common/          # Shared utilities
│   ├── config/              # Django configuration
│   │   ├── settings/        # Split settings files
│   │   ├── urls.py          # URL configuration
│   │   └── wsgi.py          # WSGI application
│   ├── requirements/        # Python dependencies
│   ├── manage.py            # Django management script
│   └── Dockerfile           # Backend container
│
├── monitoring/               # Monitoring infrastructure
│   ├── prometheus/          # Prometheus configuration
│   ├── grafana/             # Grafana dashboards
│   ├── alerts/              # Alert rules
│   └── docker-compose.yml   # Monitoring stack
│
├── docs/                     # Documentation
│   ├── architecture.md      # Architecture overview
│   ├── backend.md           # Backend documentation
│   ├── frontend.md          # Frontend documentation
│   └── deployment.md        # Deployment guide
│
├── .github/                  # GitHub configuration
│   ├── workflows/           # CI/CD workflows
│   └── ISSUE_TEMPLATE.md    # Issue template
│
└── package.json             # Node.js dependencies
```

## 🔑 Key Features

### Multi-Tenant Architecture
- Organization-based data isolation
- Role-based access control (RBAC)
- Team management with invitations
- Multi-organization membership support

### Email Marketing
- Campaign creation and management
- HTML/text email templates with rich text editor
- Contact list management and segmentation
- Scheduled sending with queue management
- Real-time delivery tracking

### Domain Management
- Custom domain verification
- DNS record validation (SPF, DKIM, DMARC, CNAME)
- Organization-scoped domain filtering
- Automated verification workflows

### Subscription & Billing
- 4-tier subscription model (Free Trial, Basic, Pro, Premium)
- Stripe integration for payment processing
- Usage tracking and limit enforcement
- Automated billing and invoicing
- Webhook handling for subscription events

### Analytics & Reporting
- Email open and click tracking
- Bounce and unsubscribe monitoring
- Campaign performance metrics
- Dashboard with visual analytics
- Export capabilities for reporting

### Notification System
- In-app notifications with badge
- Email notifications via SendGrid
- Subscription event notifications
- Usage limit warnings
- Trial expiry reminders

## 🔐 Security

- OpenID Connect (OIDC) authentication
- Session-based authentication with PostgreSQL storage
- Role-based access control (RBAC)
- Organization-level data isolation
- Secrets management via environment variables
- HTTPS/TLS encryption
- CSRF protection
- SQL injection prevention (ORM-based queries)

## 🧪 Testing

**Backend Tests:**
```bash
cd backend
pytest --cov=apps --cov-report=html
```

**Frontend Type Checking:**
```bash
npm run check
```

**Linting:**
```bash
# Backend
cd backend
flake8 apps/ config/
black --check apps/ config/

# Frontend
npx eslint frontend/client/src --ext .ts,.tsx
```

## 📊 Monitoring

EngageX includes a comprehensive monitoring setup with:
- Prometheus for metrics collection
- Grafana for visualization (3 pre-built dashboards)
- Alertmanager for notifications
- 32 predefined alert rules

See [Monitoring Documentation](../monitoring/README.md) for details.

## 🚢 Deployment

EngageX supports multiple deployment options:
- Docker containers
- Kubernetes
- Traditional VPS
- Platform-as-a-Service (Replit, Heroku, etc.)

See [Deployment Guide](deployment.md) for detailed instructions.

## 📝 API Documentation

The backend exposes a RESTful API at `/api/` with the following main endpoints:

- `/api/auth/*` - Authentication & user management
- `/api/organizations/*` - Organization management
- `/api/campaigns/*` - Email campaigns
- `/api/templates/*` - Email templates
- `/api/contacts/*` - Contact management
- `/api/domains/*` - Domain verification
- `/api/subscription/*` - Billing & subscriptions
- `/api/analytics/*` - Analytics & reporting

See [Backend Documentation](backend.md#api-endpoints) for complete API reference.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

- **Documentation**: This docs folder
- **Issues**: [GitHub Issues](https://github.com/your-org/engagex/issues)
- **Email**: support@engagex.com
- **Slack**: #engagex-support

## 🗺️ Roadmap

- [ ] Advanced segmentation with custom filters
- [ ] A/B testing for campaigns
- [ ] SMS marketing integration
- [ ] Advanced automation workflows
- [ ] White-label support
- [ ] API access for developers
- [ ] Mobile application (iOS/Android)

## 📚 Additional Resources

- [Architecture Deep Dive](architecture.md)
- [Backend Development Guide](backend.md)
- [Frontend Development Guide](frontend.md)
- [Deployment Best Practices](deployment.md)
- [Monitoring Setup](../monitoring/README.md)
- [CI/CD Pipeline](../.github/workflows/ci.yml)
