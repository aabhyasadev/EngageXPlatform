# Accounts App

## Overview
Manages user accounts, organizations, and organization memberships with role-based access control.

## Models
- **User**: Custom user model with authentication and multi-organization support
- **Organization**: Tenant entities with subscription management
- **OrganizationMembership**: Links users to organizations with specific roles
- **Invitation**: Email-based invitation system for adding team members

## Key Features
- Multi-tenant organization structure
- Role-based access control (Admin, Campaign Manager, Analyst, Editor)
- User profile management with Replit authentication integration
- Organization membership tracking and invitation system
- Subscription plan integration at organization level

## API Endpoints
- `/users/` - User management
- `/invitations/` - Team invitation handling
- Organization-related endpoints integrated with subscription app
