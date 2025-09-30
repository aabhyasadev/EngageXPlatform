# Subscriptions App

## Overview
Manages subscription plans, billing, Stripe integration, and usage tracking.

## Models
- **SubscriptionHistory**: Audit trail of subscription changes
- **ProcessedWebhookEvent**: Idempotent webhook processing
- **PlanFeatures**: Feature configuration for each plan tier
- **UsageTracking**: Monthly usage metrics per organization
- **Card**: Payment method storage

## Subscription Tiers
1. **Free Trial**: 14 days, 1,000 contacts, 10 campaigns, 10,000 emails/month
2. **Basic**: $19/month, 5,000 contacts, 50 campaigns, 50,000 emails/month
3. **Pro**: $49/month, 25,000 contacts, 200 campaigns, 250,000 emails/month
4. **Premium**: $99/month, 100,000 contacts, unlimited campaigns, 1M emails/month

## Key Features
- Stripe payment integration
- Subscription lifecycle management
- Usage limit enforcement
- Webhook idempotency with database tracking
- Billing history and invoice management
- Payment method management
- Automatic plan upgrades/downgrades
- Usage-based notifications

## API Endpoints
- `/subscription/current` - Current subscription details
- `/subscription/plans-detailed` - Available plans and features
- `/subscription/billing-history` - Invoice history
- `/subscription/create-checkout-session/` - Initiate subscription
- `/subscription/cancel/` - Cancel subscription
- `/subscription/stripe-webhook/` - Stripe event handling
- `/cards/` - Payment method management
