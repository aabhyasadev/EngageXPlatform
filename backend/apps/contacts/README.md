# Contacts App

## Overview
Manages contact lists, groups, and contact data for email campaigns.

## Models
- **Contact**: Individual contact records with subscription status
- **ContactGroup**: Contact segmentation and grouping
- **ContactGroupMembership**: Many-to-many relationship between contacts and groups

## Key Features
- Contact import from CSV/Excel files
- Contact group management for segmentation
- Subscription status tracking
- Bulk operations (import, export, delete)
- Organization-based contact isolation
- Duplicate detection and handling

## Contact Management
- Add individual contacts
- Import from spreadsheets (CSV, XLSX)
- Create and manage contact groups
- Track subscription preferences
- Manage unsubscribes automatically

## API Endpoints
- `/contacts/` - Contact CRUD operations
- `/contacts/import/` - Bulk import from files
- `/contact-groups/` - Group management
- `/contact-groups/{id}/contacts/` - Group membership management
