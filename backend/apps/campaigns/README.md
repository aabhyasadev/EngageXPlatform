# Campaigns App

## Overview
Manages email marketing campaigns from creation to delivery and tracking.

## Models
- **Campaign**: Email campaign configuration and statistics
- **CampaignRecipient**: Individual recipient tracking for each campaign

## Key Features
- Campaign creation with template integration
- Contact group targeting
- Scheduled sending
- Real-time delivery tracking
- Performance metrics (open rate, click rate)
- Recipient-level status tracking

## Campaign Workflow
1. Draft creation with subject and content
2. Template selection or custom HTML/text
3. Contact group selection
4. Schedule or send immediately
5. Track delivery and engagement

## API Endpoints
- `/campaigns/` - Campaign CRUD operations
- `/campaigns/{id}/send/` - Send or schedule campaign
- `/campaigns/{id}/recipients/` - View recipient list and status
- `/campaigns/{id}/analytics/` - Campaign performance metrics
