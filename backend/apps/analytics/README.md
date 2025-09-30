# Analytics App

## Overview
Tracks and analyzes email campaign performance metrics and user engagement events.

## Models
- **AnalyticsEvent**: Captures campaign interactions (opens, clicks, bounces, unsubscribes)

## Key Features
- Real-time event tracking for email campaigns
- User agent and IP address logging for analytics
- Event metadata storage for detailed analysis
- Dashboard statistics aggregation
- Campaign performance metrics calculation

## Event Types
- Email sent
- Email opened
- Link clicked
- Email bounced
- Unsubscribed

## API Endpoints
- `/analytics/events/` - Event logging and retrieval
- `/dashboard/stats` - Aggregated statistics for dashboard views
