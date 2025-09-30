# EngageX Monitoring Setup

Comprehensive monitoring infrastructure for the EngageX email marketing platform using Prometheus, Grafana, and Alertmanager.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Django API    │────▶│  Prometheus  │────▶│   Grafana   │
│   (Port 8001)   │     │  (Port 9090) │     │ (Port 3000) │
└─────────────────┘     └──────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Alertmanager │
                        │  (Port 9093) │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Alerts     │
                        │ Email/Slack  │
                        └──────────────┘
```

## Components

### Prometheus
- **Purpose**: Time-series metrics collection and storage
- **Port**: 9090
- **Configuration**: `prometheus/prometheus.yml`
- **Data Sources**:
  - Django backend metrics
  - Express frontend metrics
  - PostgreSQL database metrics
  - Redis cache metrics
  - System metrics (CPU, memory, disk)
  - Email delivery metrics (SendGrid)

### Grafana
- **Purpose**: Metrics visualization and dashboards
- **Port**: 3000
- **Default Credentials**: admin/admin (change on first login)
- **Dashboards**:
  - **Platform Overview**: System health, request rates, error rates, response times
  - **Email Campaigns**: Delivery rates, opens, clicks, bounces, unsubscribes
  - **Subscriptions & Billing**: MRR, churn, plan distribution, payment success rates

### Alertmanager
- **Purpose**: Alert routing and notification management
- **Port**: 9093
- **Configuration**: `alertmanager/alertmanager.yml`
- **Notification Channels**:
  - Email (via SendGrid)
  - Slack webhooks (configure your webhook URL)

### Exporters
- **Node Exporter** (9100): System-level metrics
- **PostgreSQL Exporter** (9187): Database metrics
- **Redis Exporter** (9121): Cache metrics

## Alert Rules

### Critical Alerts (Immediate Response Required)
- **HighErrorRate**: 5xx error rate > 5% for 5 minutes
- **DatabaseConnectionPoolExhausted**: Connection pool > 90% capacity
- **EmailDeliveryFailureRate**: Email failures > 10%
- **SendGridAPIErrors**: SendGrid API error rate spike
- **StripeWebhookFailures**: Stripe webhook processing failures
- **ServiceDown**: Any service unavailable for 2+ minutes
- **PostgresDown**: Database unavailable

### Warning Alerts (Investigation Recommended)
- **HighResponseTime**: 95th percentile > 2 seconds
- **HighMemoryUsage**: Memory usage > 85%
- **HighCPUUsage**: CPU usage > 80% for 10 minutes
- **EmailBounceRateHigh**: Bounce rate > 5%
- **FailedPayments**: High rate of payment failures
- **UsageLimitApproaching**: Organization at 95% of plan limit
- **SlowQueries**: Database query performance degradation

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Environment variables configured (see below)

### Environment Variables

Create a `.env` file in the `monitoring/` directory:

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SENDGRID_API_KEY=your_sendgrid_key
GRAFANA_ADMIN_PASSWORD=secure_password

# Optional
REDIS_URL=redis://redis:6379
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

### Starting the Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### Accessing Services

- **Grafana**: http://localhost:3000
  - Login: admin / [GRAFANA_ADMIN_PASSWORD]
  - Dashboards are pre-configured and auto-loaded

- **Prometheus**: http://localhost:9090
  - Query interface and metric explorer
  - View active alerts and targets

- **Alertmanager**: http://localhost:9093
  - View active alerts
  - Silence alerts if needed

### Stopping the Stack

```bash
cd monitoring
docker-compose down
```

To remove all data:
```bash
docker-compose down -v
```

## Dashboard Descriptions

### 1. Platform Overview
Provides high-level health metrics for the entire platform:
- Request rates and response times
- Error rates by status code
- CPU and memory utilization
- Database connection pool usage
- Active organizations and users

**Use Case**: First dashboard to check during incidents or daily health checks.

### 2. Email Campaigns & Delivery
Monitors email sending performance and engagement:
- Email delivery success rate
- Open and click-through rates
- Bounce and unsubscribe rates
- Campaign processing queue status
- SendGrid API performance

**Use Case**: Monitor email deliverability and campaign performance.

### 3. Subscriptions & Billing
Tracks revenue and subscription metrics:
- Monthly Recurring Revenue (MRR)
- Active subscriptions by plan
- Churn rate and trial conversions
- Payment success/failure rates
- Usage vs limits by organization
- Stripe webhook reliability

**Use Case**: Business metrics tracking and billing health monitoring.

## Integrating Application Metrics

### Django Metrics Setup

Install the Prometheus Django exporter:
```bash
pip install django-prometheus
```

Add to `INSTALLED_APPS` in Django settings:
```python
INSTALLED_APPS = [
    'django_prometheus',
    # ... other apps
]
```

Add middleware:
```python
MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    # ... other middleware
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]
```

Add metrics endpoint to URLs:
```python
urlpatterns = [
    path('', include('django_prometheus.urls')),
    # ... other URLs
]
```

### Custom Metrics Example

```python
from prometheus_client import Counter, Histogram, Gauge

# Email delivery metrics
email_delivery_total = Counter(
    'email_delivery_total',
    'Total emails sent',
    ['campaign_id', 'organization']
)

email_delivery_failed_total = Counter(
    'email_delivery_failed_total',
    'Failed email deliveries',
    ['reason', 'campaign_id']
)

# Campaign metrics
campaign_queue_size = Gauge(
    'campaign_queue_size',
    'Number of campaigns in queue'
)

# Usage in code
email_delivery_total.labels(
    campaign_id=campaign.id,
    organization=campaign.organization.name
).inc()
```

## Alert Configuration

### Adding Custom Alerts

Edit `alerts/engagex-alerts.yml` and add your rule:

```yaml
- alert: CustomAlert
  expr: your_metric > threshold
  for: 5m
  labels:
    severity: warning
    component: your_component
  annotations:
    summary: "Alert description"
    description: "Detailed description with {{ $value }}"
```

Reload Prometheus configuration:
```bash
curl -X POST http://localhost:9090/-/reload
```

### Configuring Slack Notifications

1. Create a Slack webhook URL
2. Update `alertmanager/alertmanager.yml`:
```yaml
webhook_configs:
  - url: 'YOUR_SLACK_WEBHOOK_URL'
    send_resolved: true
```

3. Restart Alertmanager:
```bash
docker-compose restart alertmanager
```

## Retention and Storage

### Prometheus Data Retention
Default: 15 days

To change retention period, modify `docker-compose.yml`:
```yaml
command:
  - '--storage.tsdb.retention.time=30d'
```

### Disk Space Monitoring

Monitor volume usage:
```bash
docker system df -v
```

## Troubleshooting

### Prometheus Not Scraping Targets

Check target status:
1. Open http://localhost:9090/targets
2. Verify all targets show "UP" status
3. Check network connectivity if targets are down

### Grafana Dashboards Not Loading

Verify datasource connection:
1. Grafana → Configuration → Data Sources
2. Test Prometheus connection
3. Check Prometheus is accessible from Grafana container

### Alerts Not Firing

Debug checklist:
1. Check alert rules: http://localhost:9090/alerts
2. Verify metric data exists in Prometheus
3. Check Alertmanager is receiving alerts
4. Verify email/Slack configuration in Alertmanager

### High Memory Usage

If Prometheus uses too much memory:
1. Reduce retention period
2. Decrease scrape frequency
3. Use recording rules for complex queries

## Production Considerations

### Security
- [ ] Change default Grafana admin password
- [ ] Enable HTTPS/TLS for all services
- [ ] Restrict network access (firewall rules)
- [ ] Use secrets management (Vault, etc.)
- [ ] Enable authentication on Prometheus/Alertmanager

### High Availability
- [ ] Deploy multiple Prometheus instances
- [ ] Use Thanos for long-term storage
- [ ] Run Alertmanager in cluster mode
- [ ] Use remote storage for Prometheus

### Performance
- [ ] Use recording rules for expensive queries
- [ ] Configure appropriate scrape intervals
- [ ] Implement metric relabeling to reduce cardinality
- [ ] Monitor monitoring stack resource usage

## Maintenance

### Regular Tasks

**Daily**:
- Check dashboard alerts
- Review critical alerts

**Weekly**:
- Review warning alerts trends
- Check disk space usage
- Validate backup procedures

**Monthly**:
- Review and update alert thresholds
- Audit dashboard relevance
- Update monitoring stack versions

### Backup Strategy

Backup Prometheus data:
```bash
docker run --rm \
  -v monitoring_prometheus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz /data
```

Backup Grafana data:
```bash
docker run --rm \
  -v monitoring_grafana-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/grafana-$(date +%Y%m%d).tar.gz /data
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Support

For issues or questions:
- Create an issue in the project repository
- Contact: ops@engagex.com
- Slack: #monitoring channel
