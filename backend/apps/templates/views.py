from rest_framework import status, filters
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from apps.common.viewsets import BaseOrganizationViewSet
from apps.templates.models import EmailTemplate
from apps.templates.serializers import EmailTemplateSerializer
from apps.subscriptions.subscription_views import (
    check_usage_limit, check_feature_available, update_usage_tracking
)


class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class EmailTemplateViewSet(BaseOrganizationViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    pagination_class = DefaultPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'subject']
    ordering = ['-created_at']
    ordering_fields = ['name', 'created_at', 'updated_at']
    
    def get_queryset(self):
        """Override to handle empty string parameters properly"""
        queryset = super().get_queryset()
        
        category = self.request.query_params.get('category', None)
        if category and category.strip():
            queryset = queryset.filter(category=category)
            
        is_default = self.request.query_params.get('is_default', None)
        if is_default is not None:
            queryset = queryset.filter(is_default=is_default.lower() == 'true')
            
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create a new template with limit check"""
        if not request.user.organization:
            return Response({
                'error': 'No organization found'
            }, status=status.HTTP_403_FORBIDDEN)
        
        limit_check = check_usage_limit(request.user.organization, 'templates')
        if not limit_check['allowed']:
            return Response({
                'error': limit_check['reason'],
                'code': 'TEMPLATE_LIMIT_REACHED',
                'current': limit_check['current'],
                'limit': limit_check['limit'],
                'upgrade_url': '/subscription/upgrade'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if request.data.get('is_custom', False):
            if not check_feature_available(request.user.organization, 'has_custom_templates'):
                return Response({
                    'error': 'Custom templates are not available in your current plan',
                    'code': 'FEATURE_NOT_AVAILABLE',
                    'feature': 'has_custom_templates',
                    'upgrade_url': '/subscription/upgrade'
                }, status=status.HTTP_403_FORBIDDEN)
        
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == 201:
            update_usage_tracking(request.user.organization, 'templates')
        
        return response

    def list(self, request, *args, **kwargs):
        """List templates and seed defaults if none exist"""
        queryset = self.get_queryset()
        
        if not queryset.exists():
            self.seed_default_templates()
            queryset = self.get_queryset()
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def seed_default_templates(self):
        """Seed default email templates for all industries"""
        if not self.request.user.organization:
            return
            
        default_templates = [
            {
                'name': 'Tech Product Launch',
                'subject': 'Introducing Our Latest Innovation - {{productName}}',
                'category': 'technology',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fb;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">🚀 {{productName}} is Here!</h1>
                        <p style="font-size: 18px; margin: 10px 0 0 0;">Revolutionary technology meets seamless user experience</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="color: #2d3748;">Hi {{firstName}},</h2>
                        <p>We're excited to announce the launch of {{productName}}, designed to transform how you work and innovate.</p>
                        <div style="background-color: #edf2f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #4a5568; margin-top: 0;">Key Features:</h3>
                            <ul style="color: #718096;">
                                <li>Advanced AI-powered automation</li>
                                <li>Real-time collaboration tools</li>
                                <li>Enterprise-grade security</li>
                                <li>Seamless API integration</li>
                            </ul>
                        </div>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{productUrl}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Explore Now</a>
                        </div>
                        <p>Best regards,<br>The {{organizationName}} Team</p>
                    </div>
                </div>''',
                'text_content': '''Hi {{firstName}},

🚀 {{productName}} is Here!

We're excited to announce the launch of {{productName}}, designed to transform how you work and innovate.

Key Features:
- Advanced AI-powered automation
- Real-time collaboration tools
- Enterprise-grade security
- Seamless API integration

Learn more: {{productUrl}}

Best regards,
The {{organizationName}} Team'''
            },
            {
                'name': 'Tech Security Alert',
                'subject': '🔒 Important Security Update for Your Account',
                'category': 'technology',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #fed7d7; border-left: 4px solid #e53e3e; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
                        <h1 style="color: #c53030; margin: 0;">🔒 Security Update Required</h1>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p>Hi {{firstName}},</p>
                        <p>We've enhanced our security systems and need you to verify your account to ensure continued protection.</p>
                        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4299e1;">
                            <h3 style="color: #2b6cb0; margin-top: 0;">Action Required:</h3>
                            <ul>
                                <li>Update your password</li>
                                <li>Enable two-factor authentication</li>
                                <li>Review login activity</li>
                            </ul>
                        </div>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{securityUrl}}" style="background: #e53e3e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Update Security Settings</a>
                        </div>
                        <p style="font-size: 14px; color: #718096;">This is an automated security message from {{organizationName}}. Please do not reply to this email.</p>
                    </div>
                </div>''',
                'text_content': '''Hi {{firstName}},

🔒 Security Update Required

We've enhanced our security systems and need you to verify your account to ensure continued protection.

Action Required:
- Update your password
- Enable two-factor authentication
- Review login activity

Update your security settings: {{securityUrl}}

This is an automated security message from {{organizationName}}. Please do not reply to this email.'''
            },
            
            {
                'name': 'Healthcare Appointment Reminder',
                'subject': 'Appointment Reminder - {{appointmentDate}}',
                'category': 'healthcare',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0f8ff;">
                    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="background: #2563eb; color: white; padding: 25px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px;">🏥 Appointment Reminder</h1>
                            <p style="margin: 10px 0 0 0; font-size: 16px;">{{organizationName}}</p>
                        </div>
                        <div style="padding: 30px;">
                            <p>Dear {{firstName}},</p>
                            <p>This is a friendly reminder about your upcoming appointment with our healthcare team.</p>
                            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #1e40af; margin-top: 0;">Appointment Details:</h3>
                                <p style="margin: 5px 0;"><strong>Date:</strong> {{appointmentDate}}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> {{appointmentTime}}</p>
                                <p style="margin: 5px 0;"><strong>Provider:</strong> {{providerName}}</p>
                                <p style="margin: 5px 0;"><strong>Location:</strong> {{clinicLocation}}</p>
                            </div>
                            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                                <h4 style="color: #92400e; margin-top: 0;">Please Remember:</h4>
                                <ul style="color: #92400e; margin: 0;">
                                    <li>Arrive 15 minutes early</li>
                                    <li>Bring your insurance card</li>
                                    <li>Bring a list of current medications</li>
                                </ul>
                            </div>
                            <div style="text-align: center; margin: 25px 0;">
                                <a href="{{confirmUrl}}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; margin-right: 10px; display: inline-block;">Confirm Appointment</a>
                                <a href="{{rescheduleUrl}}" style="background: #6b7280; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">Reschedule</a>
                            </div>
                            <p>If you have any questions, please call us at {{clinicPhone}}.</p>
                            <p>Best regards,<br>{{organizationName}}</p>
                        </div>
                    </div>
                </div>''',
                'text_content': '''Dear {{firstName}},

🏥 Appointment Reminder - {{organizationName}}

This is a friendly reminder about your upcoming appointment with our healthcare team.

Appointment Details:
- Date: {{appointmentDate}}
- Time: {{appointmentTime}}
- Provider: {{providerName}}
- Location: {{clinicLocation}}

Please Remember:
- Arrive 15 minutes early
- Bring your insurance card
- Bring a list of current medications

Confirm: {{confirmUrl}}
Reschedule: {{rescheduleUrl}}

If you have any questions, please call us at {{clinicPhone}}.

Best regards,
{{organizationName}}'''
            },
            {
                'name': 'Healthcare Wellness Newsletter',
                'subject': 'Your Monthly Wellness Update from {{organizationName}}',
                'category': 'healthcare',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">💚 Wellness Update</h1>
                        <p style="font-size: 16px; margin: 10px 0 0 0;">Your health journey matters to us</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #065f46;">Hi {{firstName}},</h2>
                        <p>Welcome to your monthly wellness update! Here are some health tips and updates from our team.</p>
                        
                        <div style="border-top: 2px solid #d1fae5; margin: 25px 0; padding-top: 20px;">
                            <h3 style="color: #047857;">🍎 This Month's Health Tip</h3>
                            <p>Stay hydrated! Aim for 8 glasses of water daily to support optimal body function and maintain energy levels throughout the day.</p>
                        </div>
                        
                        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #065f46; margin-top: 0;">📅 Upcoming Health Screenings</h3>
                            <ul style="color: #059669;">
                                <li>Annual physical exams - Schedule now</li>
                                <li>Flu vaccinations available</li>
                                <li>Blood pressure checks - Walk-ins welcome</li>
                            </ul>
                        </div>
                        
                        <div style="border-left: 4px solid #10b981; padding-left: 20px; margin: 20px 0;">
                            <h3 style="color: #065f46;">🏃‍♀️ Wellness Challenge</h3>
                            <p>Join our "10,000 Steps Challenge" this month! Track your daily steps and win prizes for reaching your goals.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{portalUrl}}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access Health Portal</a>
                        </div>
                        
                        <p>Stay healthy and take care,<br>The {{organizationName}} Team</p>
                    </div>
                </div>''',
                'text_content': '''Hi {{firstName}},

💚 Wellness Update - Your health journey matters to us

Welcome to your monthly wellness update! Here are some health tips and updates from our team.

🍎 This Month's Health Tip:
Stay hydrated! Aim for 8 glasses of water daily to support optimal body function and maintain energy levels.

📅 Upcoming Health Screenings:
- Annual physical exams - Schedule now
- Flu vaccinations available
- Blood pressure checks - Walk-ins welcome

🏃‍♀️ Wellness Challenge:
Join our "10,000 Steps Challenge" this month! Track your daily steps and win prizes for reaching your goals.

Access your health portal: {{portalUrl}}

Stay healthy and take care,
The {{organizationName}} Team'''
            },
            
            {
                'name': 'Financial Statement Ready',
                'subject': 'Your {{statementType}} Statement is Ready',
                'category': 'finance',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <div style="background: #1f2937; color: white; padding: 25px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px;">📊 Financial Statement Available</h1>
                            <p style="margin: 10px 0 0 0;">{{organizationName}}</p>
                        </div>
                        <div style="padding: 30px;">
                            <p>Dear {{firstName}},</p>
                            <p>Your {{statementType}} statement for the period ending {{periodEnd}} is now available for review.</p>
                            
                            <div style="background: #f9fafb; border: 1px solid #d1d5db; padding: 20px; border-radius: 6px; margin: 25px 0;">
                                <h3 style="color: #374151; margin-top: 0;">Statement Summary:</h3>
                                <p style="margin: 8px 0;"><strong>Account Number:</strong> {{accountNumber}}</p>
                                <p style="margin: 8px 0;"><strong>Statement Period:</strong> {{statementPeriod}}</p>
                                <p style="margin: 8px 0;"><strong>Statement Type:</strong> {{statementType}}</p>
                            </div>
                            
                            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                                <h4 style="color: #1e40af; margin-top: 0;">Important Notes:</h4>
                                <ul style="color: #1e40af; margin: 5px 0;">
                                    <li>Review all transactions carefully</li>
                                    <li>Report any discrepancies within 30 days</li>
                                    <li>Keep statements for your records</li>
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{statementUrl}}" style="background: #1f2937; color: white; padding: 15px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Download Statement</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 25px;">
                                For questions about your statement, please contact us at {{supportPhone}} or visit {{websiteUrl}}.
                            </p>
                            
                            <p>Sincerely,<br>{{organizationName}} Customer Service</p>
                        </div>
                    </div>
                </div>''',
                'text_content': '''Dear {{firstName}},

📊 Financial Statement Available - {{organizationName}}

Your {{statementType}} statement for the period ending {{periodEnd}} is now available for review.

Statement Summary:
- Account Number: {{accountNumber}}
- Statement Period: {{statementPeriod}}
- Statement Type: {{statementType}}

Important Notes:
- Review all transactions carefully
- Report any discrepancies within 30 days
- Keep statements for your records

Download your statement: {{statementUrl}}

For questions about your statement, please contact us at {{supportPhone}} or visit {{websiteUrl}}.

Sincerely,
{{organizationName}} Customer Service'''
            },
            {
                'name': 'Investment Portfolio Update',
                'subject': 'Portfolio Performance Update - {{updatePeriod}}',
                'category': 'finance',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%); color: white; padding: 30px; border-radius: 12px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">📈 Portfolio Update</h1>
                        <p style="font-size: 16px; margin: 10px 0 0 0;">Your investment performance summary</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 8px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                        <h2 style="color: #1e293b;">Hello {{firstName}},</h2>
                        <p>Here's your portfolio performance update for {{updatePeriod}}. Our team continues to monitor and optimize your investments.</p>
                        
                        <div style="display: flex; margin: 25px 0;">
                            <div style="flex: 1; background: #f0f9ff; padding: 20px; border-radius: 8px; margin-right: 10px; text-align: center;">
                                <h3 style="color: #0ea5e9; margin: 0 0 10px 0;">Portfolio Value</h3>
                                <p style="font-size: 24px; font-weight: bold; color: #0c4a6e; margin: 0;">${{portfolioValue}}</p>
                            </div>
                            <div style="flex: 1; background: #f0fdf4; padding: 20px; border-radius: 8px; margin-left: 10px; text-align: center;">
                                <h3 style="color: #22c55e; margin: 0 0 10px 0;">Period Return</h3>
                                <p style="font-size: 24px; font-weight: bold; color: #15803d; margin: 0;">{{periodReturn}}%</p>
                            </div>
                        </div>
                        
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
                            <h3 style="color: #92400e; margin-top: 0;">📊 Key Highlights:</h3>
                            <ul style="color: #92400e; margin: 0;">
                                <li>Diversified across {{assetClasses}} asset classes</li>
                                <li>{{topPerformer}} was your top performing investment</li>
                                <li>Risk level remains aligned with your goals</li>
                            </ul>
                        </div>
                        
                        <div style="border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 25px;">
                            <h3 style="color: #475569;">💡 Market Insights</h3>
                            <p>{{marketInsight}}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{dashboardUrl}}" style="background: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Full Report</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
                            Past performance is not indicative of future results. For questions, contact your advisor at {{advisorEmail}}.
                        </p>
                        
                        <p>Best regards,<br>{{organizationName}} Investment Team</p>
                    </div>
                </div>''',
                'text_content': '''Hello {{firstName}},

📈 Portfolio Update - Your investment performance summary

Here's your portfolio performance update for {{updatePeriod}}. Our team continues to monitor and optimize your investments.

Portfolio Value: ${{portfolioValue}}
Period Return: {{periodReturn}}%

📊 Key Highlights:
- Diversified across {{assetClasses}} asset classes
- {{topPerformer}} was your top performing investment
- Risk level remains aligned with your goals

💡 Market Insights:
{{marketInsight}}

View your full report: {{dashboardUrl}}

Past performance is not indicative of future results. For questions, contact your advisor at {{advisorEmail}}.

Best regards,
{{organizationName}} Investment Team'''
            },
            
            {
                'name': 'Retail Order Confirmation',
                'subject': 'Order Confirmed - #{{orderNumber}}',
                'category': 'retail',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: #10b981; color: white; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px;">✅ Order Confirmed!</h1>
                            <p style="font-size: 16px; margin: 10px 0 0 0;">Thank you for your purchase</p>
                        </div>
                        <div style="padding: 30px;">
                            <p>Hi {{firstName}},</p>
                            <p>Great news! Your order has been confirmed and is being prepared for shipment.</p>
                            
                            <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
                                <h3 style="color: #065f46; margin: 0 0 10px 0;">Order Number</h3>
                                <p style="font-size: 24px; font-weight: bold; color: #047857; margin: 0;">#{{orderNumber}}</p>
                            </div>
                            
                            <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                                <h3 style="color: #374151; margin-top: 0;">Order Details:</h3>
                                <p style="margin: 5px 0;"><strong>Order Date:</strong> {{orderDate}}</p>
                                <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${{orderTotal}}</p>
                                <p style="margin: 5px 0;"><strong>Payment Method:</strong> {{paymentMethod}}</p>
                                <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
                            </div>
                            
                            <div style="background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                                <h3 style="color: #374151; margin-top: 0;">Shipping Address:</h3>
                                <p style="margin: 0; color: #6b7280;">{{shippingAddress}}</p>
                            </div>
                            
                            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                                <h4 style="color: #1e40af; margin-top: 0;">What's Next?</h4>
                                <ul style="color: #1e40af; margin: 5px 0;">
                                    <li>You'll receive a shipping confirmation with tracking info</li>
                                    <li>Track your order anytime in your account</li>
                                    <li>Delivery typically takes 3-5 business days</li>
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{{trackingUrl}}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">Track Order</a>
                                <a href="{{orderDetailsUrl}}" style="background: #6b7280; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Details</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 25px;">
                                Questions? Contact us at {{supportEmail}} or {{supportPhone}}
                            </p>
                            
                            <p>We appreciate your business and can't wait for you to receive your order!</p>
                            <p>Happy shopping,<br>The {{organizationName}} Team</p>
                        </div>
                    </div>
                </div>''',
                'text_content': '''Hi {{firstName}},

✅ Order Confirmed! - Thank you for your purchase

Great news! Your order has been confirmed and is being prepared for shipment.

Order Number: #{{orderNumber}}

Order Details:
- Order Date: {{orderDate}}
- Total Amount: ${{orderTotal}}
- Payment Method: {{paymentMethod}}
- Estimated Delivery: {{estimatedDelivery}}

Shipping Address:
{{shippingAddress}}

What's Next?
- You'll receive a shipping confirmation with tracking info
- Track your order anytime in your account
- Delivery typically takes 3-5 business days

Track your order: {{trackingUrl}}
View order details: {{orderDetailsUrl}}

Questions? Contact us at {{supportEmail}} or {{supportPhone}}

We appreciate your business and can't wait for you to receive your order!

Happy shopping,
The {{organizationName}} Team'''
            },
            {
                'name': 'Exclusive Sale Announcement',
                'subject': '🔥 Exclusive {{salePercentage}}% Off Sale - Limited Time!',
                'category': 'retail',
                'is_default': True,
                'html_content': '''<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fef2f2;">
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; transform: rotate(45deg);"></div>
                        <h1 style="margin: 0; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🔥 EXCLUSIVE SALE</h1>
                        <p style="font-size: 24px; margin: 10px 0 0 0; font-weight: bold;">{{salePercentage}}% OFF Everything!</p>
                        <p style="font-size: 14px; margin: 10px 0 0 0; opacity: 0.9;">Limited time offer - Don't miss out!</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 8px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #7f1d1d;">Hi {{firstName}},</h2>
                        <p>We're thrilled to offer you an exclusive {{salePercentage}}% discount on our entire collection! This special sale is available for a limited time only.</p>
                        
                        <div style="background: #fee2e2; border: 2px dashed #dc2626; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
                            <h3 style="color: #7f1d1d; margin-top: 0; font-size: 18px;">🎟️ Your Exclusive Code</h3>
                            <div style="background: #7f1d1d; color: white; padding: 15px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0;">
                                {{promoCode}}
                            </div>
                            <p style="color: #7f1d1d; font-size: 14px; margin: 0;">Valid until {{expiryDate}}</p>
                        </div>
                        
                        <div style="display: flex; gap: 15px; margin: 25px 0;">
                            <div style="flex: 1; background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                                <h4 style="color: #374151; margin: 0 0 10px 0;">👔 Men's Fashion</h4>
                                <p style="font-size: 14px; color: #6b7280; margin: 0;">Suits, shirts, accessories</p>
                            </div>
                            <div style="flex: 1; background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                                <h4 style="color: #374151; margin: 0 0 10px 0;">👗 Women's Fashion</h4>
                                <p style="font-size: 14px; color: #6b7280; margin: 0;">Dresses, shoes, handbags</p>
                            </div>
                        </div>
                        
                        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
                            <h3 style="color: #92400e; margin-top: 0;">⚡ Sale Highlights:</h3>
                            <ul style="color: #92400e; margin: 0;">
                                <li>{{salePercentage}}% off sitewide - no minimum purchase</li>
                                <li>Free shipping on orders over ${{freeShippingThreshold}}</li>
                                <li>Easy returns within {{returnDays}} days</li>
                                <li>New arrivals included in sale</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{{shopUrl}}" style="background: #dc2626; color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">Shop Now & Save</a>
                        </div>
                        
                        <p style="text-align: center; font-size: 14px; color: #6b7280;">
                            Sale ends {{expiryDate}} at midnight. Cannot be combined with other offers.
                        </p>
                        
                        <p>Don't let this amazing deal slip away!</p>
                        <p>Happy shopping,<br>The {{organizationName}} Team</p>
                    </div>
                </div>''',
                'text_content': '''Hi {{firstName}},

🔥 EXCLUSIVE SALE - {{salePercentage}}% OFF Everything!

We're thrilled to offer you an exclusive {{salePercentage}}% discount on our entire collection! This special sale is available for a limited time only.

🎟️ Your Exclusive Code: {{promoCode}}
Valid until {{expiryDate}}

⚡ Sale Highlights:
- {{salePercentage}}% off sitewide - no minimum purchase
- Free shipping on orders over ${{freeShippingThreshold}}
- Easy returns within {{returnDays}} days
- New arrivals included in sale

👔 Men's Fashion: Suits, shirts, accessories
👗 Women's Fashion: Dresses, shoes, handbags

Shop now and save: {{shopUrl}}

Sale ends {{expiryDate}} at midnight. Cannot be combined with other offers.

Don't let this amazing deal slip away!

Happy shopping,
The {{organizationName}} Team'''
            }
        ]
        
        for template_data in default_templates:
            EmailTemplate.objects.get_or_create(
                organization=self.request.user.organization,
                name=template_data['name'],
                defaults=template_data
            )
