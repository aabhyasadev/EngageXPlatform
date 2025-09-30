# Common App

## Overview
Shared utilities, constants, middleware, and background tasks used across the application.

## Components

### Constants (`constants.py`)
- User roles and permissions
- Campaign and recipient statuses
- Subscription plans and billing cycles
- Notification types and channels
- Domain verification statuses

### Middleware
- **SubscriptionAccessMiddleware**: Enforces subscription-based feature access
- **FeatureLimitMiddleware**: Monitors usage limits based on subscription tier

### Utilities (`utils.py`)
- Token generation for invitations
- Common helper functions

### Background Tasks (`tasks.py`)
- Trial expiration notifications
- Subscription expiration checks
- Usage limit monitoring
- Scheduled email reminders

### Management Commands
- `start_scheduler`: Runs background task scheduler

## Key Features
- Centralized constants for consistent data across apps
- Subscription enforcement at middleware level
- Automated notification system for subscription events
- Shared utility functions to avoid code duplication
