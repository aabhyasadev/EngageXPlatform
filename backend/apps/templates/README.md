# Templates App

## Overview
Email template management system with pre-built templates and custom template support.

## Models
- **EmailTemplate**: Reusable email templates with HTML and text content

## Key Features
- Pre-built professional email templates
- Custom HTML/text template creation
- Template categorization
- Variable substitution support
- Organization-specific templates
- Default template system

## Template Categories
- Marketing
- Transactional
- Newsletter
- Announcement
- Promotional
- Welcome
- Reminder

## Template Variables
Templates support dynamic content through variable substitution:
- `{{recipientName}}` - Contact name
- `{{companyName}}` - Organization name
- `{{unsubscribeLink}}` - Unsubscribe URL
- Custom variables defined per campaign

## API Endpoints
- `/templates/` - Template CRUD operations
- `/templates/{id}/preview/` - Preview template with sample data
- `/templates/categories/` - List available categories
