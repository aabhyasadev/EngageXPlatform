# Domains App

## Overview
Manages domain verification and DNS record configuration for email sending.

## Models
- **Domain**: Domain ownership and verification status

## Key Features
- Domain ownership verification
- DNS record generation (DKIM, SPF, DMARC, CNAME)
- Automated verification status tracking
- SendGrid domain integration
- Organization-specific domain management

## Verification Process
1. Add domain to organization
2. System generates DNS records
3. User configures DNS with provided records
4. System verifies DNS configuration
5. Domain marked as verified for sending

## DNS Records
- **DKIM**: Email authentication
- **SPF**: Sender policy framework
- **DMARC**: Domain-based message authentication
- **CNAME**: Domain delegation for tracking

## API Endpoints
- `/domains/` - Domain CRUD operations
- `/domains/{id}/verify/` - Trigger domain verification
- `/domains/{id}/dns-records/` - Retrieve DNS configuration
