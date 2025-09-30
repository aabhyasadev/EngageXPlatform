# Notifications App

## Overview
Multi-channel notification system for subscription events and system alerts.

## Models
- **SubscriptionNotification**: Tracks notifications sent about subscription and usage events

## Key Features
- Multi-channel delivery (email, in-app)
- Subscription event notifications
- Usage limit alerts
- Trial expiration reminders
- Payment confirmation notifications
- Read/unread status tracking

## Notification Types
- Trial expiring (7 days, 1 day before)
- Subscription expired
- Payment successful
- Payment failed
- Plan changed
- Usage limit approaching (90% threshold)

## Notification Channels
- **Email**: Via SendGrid for important alerts
- **In-app**: Displayed in notification center

## API Endpoints
- `/subscription/notifications` - List notifications
- `/subscription/notifications/{id}/mark-read/` - Mark as read
- `/subscription/notifications/mark-all-read/` - Mark all as read
- `/subscription/notifications/unread-count/` - Get unread count
