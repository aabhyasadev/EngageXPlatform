# EngageX - Email Marketing Platform

## Overview

EngageX is a comprehensive multi-tenant email marketing platform built with a modern full-stack architecture. It provides organizations with the tools to create, manage, and track email campaigns with enterprise-grade features including domain verification, contact management, template systems, and detailed analytics.

The application serves multiple organizations with secure isolation, role-based access control, and subscription management. It supports the complete email marketing workflow from contact import and segmentation to campaign creation, sending, and performance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Modern component-based UI built with React 18 and TypeScript for type safety
- **Vite Build System**: Fast development server and optimized production builds
- **Wouter Router**: Lightweight client-side routing solution
- **shadcn/ui Components**: Professional UI component library based on Radix UI primitives
- **TanStack Query**: Server state management with caching, background updates, and error handling
- **Tailwind CSS**: Utility-first CSS framework with custom design system

### Backend Architecture
- **Express.js Server**: RESTful API server with middleware-based request processing
- **TypeScript**: End-to-end type safety across the entire stack
- **Session-based Authentication**: Secure user sessions with PostgreSQL storage
- **Modular Route Structure**: Organized API endpoints with proper error handling
- **File Upload Support**: Multer middleware for handling contact imports and file uploads

### Database Layer
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Drizzle ORM**: Type-safe database operations with schema-first approach
- **Multi-tenant Design**: Organization-based data isolation with proper foreign key relationships
- **Migration System**: Structured database schema evolution with version control

### Authentication & Authorization
- **OpenID Connect**: Integration with Replit's authentication system
- **Passport.js**: Authentication middleware with strategy pattern
- **Session Management**: PostgreSQL-backed session storage with TTL
- **Role-based Access**: Admin, campaign manager, analyst, and editor roles
- **Organization Isolation**: Secure multi-tenant data access patterns

### Subscription & Billing System
- **Stripe Payment Integration**: Complete payment processing with checkout, billing portal, and webhook handling
- **4-Tier Subscription Model**: Free Trial (14 days), Basic ($19/mo), Pro ($49/mo), Premium ($99/mo)
- **Monthly/Yearly Billing**: Flexible billing cycles with automatic discounts for annual plans
- **Access Control Middleware**: Enforces feature restrictions and usage limits based on subscription tier
- **Usage Tracking**: Monitors contacts, campaigns, and emails sent against plan limits
- **Billing History**: Invoice management with PDF downloads and payment method tracking
- **Webhook Security**: Stripe signature verification with database-backed idempotency

### Notification System
- **Multi-channel Delivery**: Email (SendGrid) and in-app notifications
- **Subscription Events**: Trial expiry reminders (7 and 1 day), payment confirmations, plan changes
- **Usage Alerts**: Automatic warnings when approaching plan limits (90% threshold)
- **Scheduled Tasks**: Lightweight Python scheduler for automated reminders (no Celery required)
- **Notification Center**: In-app dropdown with unread badge and mark-as-read functionality

### Email Infrastructure
- **SendGrid Integration**: Transactional and bulk email delivery service
- **Domain Verification**: DNS record validation for sender reputation
- **Template System**: Reusable HTML/text email templates with variable substitution
- **Campaign Management**: Scheduled sending, recipient targeting, and delivery tracking

### File Processing
- **Excel/CSV Import**: Contact list imports with validation and error reporting
- **Multer File Handling**: Secure file upload processing with memory storage
- **XLSX Processing**: Spreadsheet parsing for contact data extraction

### Analytics & Tracking
- **Campaign Metrics**: Open rates, click tracking, bounce handling, and unsubscribe monitoring
- **Performance Charts**: Time-series data visualization for campaign analysis
- **Event Logging**: Comprehensive analytics event capture and storage

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Email Services  
- **SendGrid**: Email delivery platform for transactional and marketing emails
- **Domain DNS Services**: For DKIM, SPF, DMARC, and CNAME record verification

### Authentication
- **Replit OpenID Connect**: Identity provider integration for user authentication
- **Passport.js OpenID Strategy**: Authentication middleware for OIDC flows

### UI Framework
- **Radix UI**: Headless UI components for accessibility and behavior
- **Lucide Icons**: Icon library for consistent visual elements
- **shadcn/ui**: Pre-built component library with design system

### Development Tools
- **Replit Integrations**: Development environment plugins for enhanced developer experience
- **Vite Plugins**: Development server enhancements and build optimizations

### File Processing
- **XLSX Library**: Excel file parsing for contact imports
- **Multer**: Multipart form data handling for file uploads

### State Management
- **TanStack Query**: Server state management with intelligent caching
- **React Hook Form**: Form state management with validation

The architecture emphasizes type safety, scalability, and maintainability while providing a rich feature set for email marketing operations. The multi-tenant design ensures secure data isolation between organizations while sharing common infrastructure and services.