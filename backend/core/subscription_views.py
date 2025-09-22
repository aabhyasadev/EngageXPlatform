import stripe
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from .models import (
    Organization, SubscriptionPlan, User, SubscriptionHistory, 
    SubscriptionEventType, SubscriptionStatus, PlanFeatures, UsageTracking,
    SubscriptionNotification, NotificationChannel, NotificationType
)
from django.db.models import F
from datetime import datetime
import json
import logging
import hashlib
from decimal import Decimal

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Store processed webhook events to prevent replay attacks
processed_webhook_events = set()

# Plan configuration with pricing and features
PLAN_CONFIG = {
    SubscriptionPlan.FREE_TRIAL: {
        'name': 'Free Trial',
        'price': 0,
        'stripe_price_id': None,
        'contacts_limit': 1000,
        'campaigns_limit': 10,
        'features': ['Email campaigns', 'Basic analytics', '1000 contacts', '10 campaigns']
    },
    SubscriptionPlan.BASIC_MONTHLY: {
        'name': 'Basic Monthly',
        'price': 29,
        'stripe_price_id': settings.STRIPE_PRICE_BASIC_MONTHLY,
        'contacts_limit': 5000,
        'campaigns_limit': 50,
        'features': ['Email campaigns', 'Basic analytics', '5000 contacts', '50 campaigns', 'A/B testing']
    },
    SubscriptionPlan.BASIC_YEARLY: {
        'name': 'Basic Yearly', 
        'price': 290,  # 10 months price
        'stripe_price_id': settings.STRIPE_PRICE_BASIC_YEARLY,
        'contacts_limit': 5000,
        'campaigns_limit': 50,
        'features': ['Email campaigns', 'Basic analytics', '5000 contacts', '50 campaigns', 'A/B testing', '2 months free']
    },
    SubscriptionPlan.PRO_MONTHLY: {
        'name': 'Pro Monthly',
        'price': 79,
        'stripe_price_id': settings.STRIPE_PRICE_PRO_MONTHLY,
        'contacts_limit': 25000,
        'campaigns_limit': 200,
        'features': ['All Basic features', 'Advanced analytics', '25000 contacts', '200 campaigns', 'Automation', 'Custom templates']
    },
    SubscriptionPlan.PRO_YEARLY: {
        'name': 'Pro Yearly',
        'price': 790,  # 10 months price
        'stripe_price_id': settings.STRIPE_PRICE_PRO_YEARLY,
        'contacts_limit': 25000,
        'campaigns_limit': 200,
        'features': ['All Basic features', 'Advanced analytics', '25000 contacts', '200 campaigns', 'Automation', 'Custom templates', '2 months free']
    },
    SubscriptionPlan.PREMIUM_MONTHLY: {
        'name': 'Premium Monthly',
        'price': 149,
        'stripe_price_id': settings.STRIPE_PRICE_PREMIUM_MONTHLY,
        'contacts_limit': 100000,
        'campaigns_limit': 1000,
        'features': ['All Pro features', 'Priority support', '100000 contacts', '1000 campaigns', 'White labeling', 'API access']
    },
    SubscriptionPlan.PREMIUM_YEARLY: {
        'name': 'Premium Yearly',
        'price': 1490,  # 10 months price
        'stripe_price_id': settings.STRIPE_PRICE_PREMIUM_YEARLY,
        'contacts_limit': 100000,
        'campaigns_limit': 1000,
        'features': ['All Pro features', 'Priority support', '100000 contacts', '1000 campaigns', 'White labeling', 'API access', '2 months free']
    }
}

def get_plan_from_price_id(price_id):
    """Get plan key from Stripe price ID"""
    for plan_key, config in PLAN_CONFIG.items():
        if config.get('stripe_price_id') == price_id:
            return plan_key
    return None


@api_view(['GET'])
@permission_classes([AllowAny])
def get_subscription_plans(request):
    """Get available subscription plans with pricing and features"""
    plans = []
    for plan_key, config in PLAN_CONFIG.items():
        if plan_key != SubscriptionPlan.FREE_TRIAL:
            plans.append({
                'id': plan_key,
                'name': config['name'],
                'price': config['price'],
                'stripe_price_id': config.get('stripe_price_id'),
                'contacts_limit': config['contacts_limit'],
                'campaigns_limit': config['campaigns_limit'],
                'features': config['features'],
                'is_yearly': 'yearly' in plan_key.lower()
            })
    
    return Response({'plans': plans})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_plans_detailed(request):
    """Get detailed subscription plans with all features and pricing"""
    try:
        user = request.user
        current_plan = None
        if user.organization:
            current_plan = user.organization.subscription_plan
        
        plans = []
        for plan_key, config in PLAN_CONFIG.items():
            plan_detail = {
                'id': plan_key,
                'name': config['name'],
                'price': config['price'],
                'stripe_price_id': config.get('stripe_price_id'),
                'contacts_limit': config['contacts_limit'],
                'campaigns_limit': config['campaigns_limit'],
                'features': config['features'],
                'is_yearly': 'yearly' in plan_key.lower(),
                'is_current': plan_key == current_plan,
                'billing_period': 'yearly' if 'yearly' in plan_key.lower() else 'monthly',
                'savings': '2 months free' if 'yearly' in plan_key.lower() else None
            }
            
            # Add comparison to current plan
            if current_plan and plan_key != current_plan:
                current_config = PLAN_CONFIG.get(current_plan, {})
                plan_detail['comparison'] = {
                    'contacts_diff': config['contacts_limit'] - current_config.get('contacts_limit', 0),
                    'campaigns_diff': config['campaigns_limit'] - current_config.get('campaigns_limit', 0),
                    'price_diff': config['price'] - current_config.get('price', 0)
                }
            
            plans.append(plan_detail)
        
        return Response({
            'plans': plans,
            'current_plan': current_plan
        })
        
    except Exception as e:
        logger.error(f"Error getting detailed plans: {str(e)}")
        return Response({
            'error': f'Error retrieving plans: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_subscription(request):
    """Get current user's subscription details"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        plan_config = PLAN_CONFIG.get(org.subscription_plan, {})
        
        # Check if trial or subscription expired
        is_expired = False
        if org.subscription_plan == SubscriptionPlan.FREE_TRIAL and org.trial_ends_at:
            is_expired = timezone.now() > org.trial_ends_at
        elif org.subscription_ends_at:
            is_expired = timezone.now() > org.subscription_ends_at
        
        return Response({
            'subscription': {
                'plan': org.subscription_plan,
                'plan_name': plan_config.get('name', 'Unknown'),
                'is_trial': org.subscription_plan == SubscriptionPlan.FREE_TRIAL,
                'trial_ends_at': org.trial_ends_at.isoformat() if org.trial_ends_at else None,
                'subscription_ends_at': org.subscription_ends_at.isoformat() if org.subscription_ends_at else None,
                'current_period_end': org.current_period_end.isoformat() if org.current_period_end else None,
                'cancel_at_period_end': org.cancel_at_period_end,
                'is_active': org.is_subscription_active and not is_expired,
                'is_expired': is_expired,
                'contacts_limit': org.contacts_limit,
                'campaigns_limit': org.campaigns_limit,
                'features': plan_config.get('features', []),
                'stripe_customer_id': org.stripe_customer_id,
                'stripe_subscription_id': org.stripe_subscription_id
            }
        })
        
    except Exception as e:
        logger.error(f"Error retrieving subscription: {str(e)}")
        return Response({
            'error': f'Error retrieving subscription: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_billing_history(request):
    """Get billing history from both Stripe and local SubscriptionHistory"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', 10))
        
        billing_items = []
        
        # Fetch from Stripe if customer ID exists
        if org.stripe_customer_id:
            try:
                # Fetch invoices from Stripe
                stripe_invoices = stripe.Invoice.list(
                    customer=org.stripe_customer_id,
                    limit=100,  # Get more to ensure we have enough data
                    expand=['data.payment_intent', 'data.charge']
                )
                
                for invoice in stripe_invoices.data:
                    payment_method_details = None
                    if invoice.payment_intent and hasattr(invoice.payment_intent, 'payment_method_details'):
                        payment_method_details = invoice.payment_intent.payment_method_details
                    elif invoice.charge and hasattr(invoice.charge, 'payment_method_details'):
                        payment_method_details = invoice.charge.payment_method_details
                    
                    billing_item = {
                        'id': invoice.id,
                        'date': datetime.fromtimestamp(invoice.created).isoformat(),
                        'amount': invoice.amount_paid / 100,  # Convert from cents to dollars
                        'status': 'succeeded' if invoice.paid else 'failed',
                        'description': invoice.description or f"{invoice.lines.data[0].description if invoice.lines.data else 'Subscription payment'}",
                        'invoice_url': invoice.hosted_invoice_url,
                        'invoice_pdf': invoice.invoice_pdf,
                        'payment_method': None
                    }
                    
                    # Extract payment method info
                    if payment_method_details:
                        if hasattr(payment_method_details, 'card'):
                            billing_item['payment_method'] = {
                                'brand': payment_method_details.card.brand,
                                'last4': payment_method_details.card.last4
                            }
                        elif hasattr(payment_method_details, 'type'):
                            billing_item['payment_method'] = {
                                'brand': payment_method_details.type,
                                'last4': '****'
                            }
                    
                    billing_items.append(billing_item)
                    
            except Exception as stripe_error:
                logger.warning(f"Error fetching Stripe invoices: {str(stripe_error)}")
        
        # Fetch from local SubscriptionHistory
        local_history = SubscriptionHistory.objects.filter(
            organization=org,
            event_type__in=[
                SubscriptionEventType.PAYMENT_SUCCEEDED,
                SubscriptionEventType.PAYMENT_FAILED,
                SubscriptionEventType.RENEWED
            ]
        ).order_by('-created_at')
        
        # Add local history items that aren't already in Stripe results
        stripe_invoice_ids = {item['id'] for item in billing_items}
        
        for history_item in local_history:
            if history_item.invoice_id and history_item.invoice_id not in stripe_invoice_ids:
                billing_item = {
                    'id': history_item.invoice_id or str(history_item.id),
                    'date': history_item.created_at.isoformat(),
                    'amount': float(history_item.amount) if history_item.amount else 0,
                    'status': 'succeeded' if history_item.event_type == SubscriptionEventType.PAYMENT_SUCCEEDED else 'failed',
                    'description': f"{history_item.new_plan.replace('_', ' ').title() if history_item.new_plan else 'Subscription payment'}",
                    'invoice_url': history_item.invoice_pdf_url,
                    'invoice_pdf': history_item.invoice_pdf_url,
                    'payment_method': None
                }
                
                if history_item.payment_method_brand and history_item.payment_method_last4:
                    billing_item['payment_method'] = {
                        'brand': history_item.payment_method_brand,
                        'last4': history_item.payment_method_last4
                    }
                
                billing_items.append(billing_item)
        
        # Sort by date (newest first)
        billing_items.sort(key=lambda x: x['date'], reverse=True)
        
        # Apply pagination
        start = (page - 1) * limit
        end = start + limit
        paginated_items = billing_items[start:end]
        
        return Response({
            'items': paginated_items,
            'total': len(billing_items),
            'page': page,
            'limit': limit,
            'has_more': end < len(billing_items)
        })
        
    except Exception as e:
        logger.error(f"Error retrieving billing history: {str(e)}")
        return Response({
            'error': f'Error retrieving billing history: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """Create Stripe checkout session for new subscriptions"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        plan_id = request.data.get('plan_id')
        success_url = request.data.get('success_url', f"{request.build_absolute_uri('/')}/subscription/success")
        cancel_url = request.data.get('cancel_url', f"{request.build_absolute_uri('/')}/subscription")
        
        if not plan_id or plan_id not in PLAN_CONFIG:
            return Response({
                'error': 'Invalid plan selected'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan_id == SubscriptionPlan.FREE_TRIAL:
            return Response({
                'error': 'Cannot create checkout session for free trial'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        plan_config = PLAN_CONFIG[plan_id]
        
        # Create or get Stripe customer
        if not org.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=org.name,
                metadata={
                    'organization_id': str(org.id),
                    'user_id': str(user.id)
                }
            )
            org.stripe_customer_id = customer.id
            org.save()
        
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=org.stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': plan_config['stripe_price_id'],
                'quantity': 1,
            }] if plan_config.get('stripe_price_id') else [{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan_config['name'],
                        'description': ', '.join(plan_config['features'][:3])
                    },
                    'unit_amount': int(plan_config['price'] * 100),
                    'recurring': {
                        'interval': 'year' if 'yearly' in plan_id.lower() else 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=str(org.id),
            metadata={
                'plan_id': plan_id,
                'organization_id': str(org.id),
                'user_id': str(user.id)
            }
        )
        
        logger.info(f"Created checkout session {checkout_session.id} for org {org.id}")
        
        return Response({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        })
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        return Response({
            'error': f'Error creating checkout session: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manage_subscription(request):
    """Manage subscription - upgrade/downgrade/cancel/resume"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        action = request.data.get('action')  # 'upgrade', 'downgrade', 'cancel', 'resume'
        new_plan_id = request.data.get('new_plan_id')
        immediate = request.data.get('immediate', False)
        
        if action not in ['upgrade', 'downgrade', 'cancel', 'resume']:
            return Response({
                'error': 'Invalid action. Must be upgrade, downgrade, cancel, or resume'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not org.stripe_subscription_id and action != 'upgrade':
            return Response({
                'error': 'No active subscription found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if action in ['upgrade', 'downgrade']:
            if not new_plan_id or new_plan_id not in PLAN_CONFIG:
                return Response({
                    'error': 'Invalid new plan selected'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            new_config = PLAN_CONFIG[new_plan_id]
            old_plan = org.subscription_plan
            
            # Get current subscription
            subscription = stripe.Subscription.retrieve(org.stripe_subscription_id)
            
            # Update subscription with new price
            updated_subscription = stripe.Subscription.modify(
                org.stripe_subscription_id,
                cancel_at_period_end=False,
                proration_behavior='create_prorations' if immediate else 'none',
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'price': new_config['stripe_price_id'] if new_config.get('stripe_price_id') else None,
                    'price_data': {
                        'currency': 'usd',
                        'product': subscription['items']['data'][0]['price']['product'],
                        'unit_amount': int(new_config['price'] * 100),
                        'recurring': {
                            'interval': 'year' if 'yearly' in new_plan_id.lower() else 'month',
                        },
                    } if not new_config.get('stripe_price_id') else None,
                }]
            )
            
            # Update organization
            org.subscription_plan = new_plan_id
            org.contacts_limit = new_config['contacts_limit']
            org.campaigns_limit = new_config['campaigns_limit']
            org.stripe_price_id = new_config.get('stripe_price_id')
            org.save()
            
            # Log subscription history
            SubscriptionHistory.objects.create(
                organization=org,
                event_type=SubscriptionEventType.PLAN_CHANGED,
                old_plan=old_plan,
                new_plan=new_plan_id,
                metadata={
                    'action': action,
                    'immediate': immediate
                }
            )
            
            logger.info(f"Subscription {action}d for org {org.id} from {old_plan} to {new_plan_id}")
            
            return Response({
                'message': f'Subscription {action}d successfully',
                'new_plan': new_plan_id,
                'subscription_id': updated_subscription.id
            })
        
        elif action == 'cancel':
            # Cancel subscription
            stripe.Subscription.modify(
                org.stripe_subscription_id,
                cancel_at_period_end=not immediate,
                cancel_at=int(timezone.now().timestamp()) if immediate else None
            )
            
            org.cancel_at_period_end = True
            if immediate:
                org.is_subscription_active = False
                org.subscription_ends_at = timezone.now()
            org.save()
            
            # Log subscription history
            SubscriptionHistory.objects.create(
                organization=org,
                event_type=SubscriptionEventType.CANCELED,
                old_plan=org.subscription_plan,
                metadata={
                    'immediate': immediate
                }
            )
            
            logger.info(f"Subscription canceled for org {org.id}")
            
            return Response({
                'message': 'Subscription canceled successfully' if immediate else 'Subscription will be canceled at the end of the billing period',
                'cancel_at_period_end': not immediate
            })
        
        elif action == 'resume':
            # Resume canceled subscription
            if not org.cancel_at_period_end:
                return Response({
                    'error': 'Subscription is not scheduled for cancellation'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            stripe.Subscription.modify(
                org.stripe_subscription_id,
                cancel_at_period_end=False
            )
            
            org.cancel_at_period_end = False
            org.save()
            
            # Log subscription history
            SubscriptionHistory.objects.create(
                organization=org,
                event_type=SubscriptionEventType.UPDATED,
                new_plan=org.subscription_plan,
                metadata={
                    'action': 'resumed'
                }
            )
            
            logger.info(f"Subscription resumed for org {org.id}")
            
            return Response({
                'message': 'Subscription resumed successfully'
            })
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        return Response({
            'error': f'Stripe error: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error managing subscription: {str(e)}")
        return Response({
            'error': f'Error managing subscription: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_billing_portal_session(request):
    """Create Stripe billing portal session for customers to manage their subscription"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        if not org.stripe_customer_id:
            return Response({
                'error': 'No Stripe customer found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return_url = request.data.get('return_url', f"{request.build_absolute_uri('/')}/subscription")
        
        # Create billing portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=org.stripe_customer_id,
            return_url=return_url,
        )
        
        logger.info(f"Created billing portal session for org {org.id}")
        
        return Response({
            'portal_url': portal_session.url
        })
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        return Response({
            'error': f'Stripe error: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error creating billing portal: {str(e)}")
        return Response({
            'error': f'Error creating billing portal: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_subscription(request):
    """Create or update Stripe subscription"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        plan_id = request.data.get('plan_id')
        if not plan_id or plan_id not in PLAN_CONFIG:
            return Response({
                'error': 'Invalid plan selected'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if plan_id == SubscriptionPlan.FREE_TRIAL:
            return Response({
                'error': 'Cannot create subscription for free trial'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        plan_config = PLAN_CONFIG[plan_id]
        
        # Create or get Stripe customer
        if not org.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=org.name,
                metadata={
                    'organization_id': str(org.id),
                    'user_id': str(user.id)
                }
            )
            org.stripe_customer_id = customer.id
            org.save()
        
        # Create Stripe subscription
        try:
            subscription = stripe.Subscription.create(
                customer=org.stripe_customer_id,
                items=[{
                    'price': plan_config['stripe_price_id'] if plan_config.get('stripe_price_id') else None,
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': plan_config['name'],
                        },
                        'unit_amount': plan_config['price'] * 100,  # Convert to cents
                        'recurring': {
                            'interval': 'year' if 'yearly' in plan_id else 'month',
                        },
                    } if not plan_config.get('stripe_price_id') else None
                }],
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                expand=['latest_invoice.payment_intent'],
            )
        except Exception as stripe_error:
            logger.error(f"Stripe subscription creation failed: {str(stripe_error)}")
            return Response({
                'error': f'Failed to create subscription: {str(stripe_error)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update organization with subscription details
        org.stripe_subscription_id = subscription.id
        org.subscription_plan = plan_id
        org.contacts_limit = plan_config['contacts_limit']
        org.campaigns_limit = plan_config['campaigns_limit']
        org.is_subscription_active = True
        org.stripe_price_id = plan_config.get('stripe_price_id')
        
        # Set subscription end date
        if 'yearly' in plan_id:
            org.subscription_ends_at = timezone.now() + timedelta(days=365)
        else:
            org.subscription_ends_at = timezone.now() + timedelta(days=30)
        
        org.save()
        
        # Log subscription history
        SubscriptionHistory.objects.create(
            organization=org,
            event_type=SubscriptionEventType.CREATED,
            new_plan=plan_id,
            new_status=SubscriptionStatus.ACTIVE,
            amount=Decimal(plan_config['price']),
            metadata={
                'subscription_id': subscription.id
            }
        )
        
        # Safely access the client_secret from payment_intent
        client_secret = None
        if hasattr(subscription, 'latest_invoice') and subscription.latest_invoice:
            if hasattr(subscription.latest_invoice, 'payment_intent') and subscription.latest_invoice.payment_intent:
                client_secret = subscription.latest_invoice.payment_intent.client_secret
        
        logger.info(f"Created subscription {subscription.id} for org {org.id}")
        
        return Response({
            'client_secret': client_secret,
            'subscription_id': subscription.id
        })
        
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}")
        return Response({
            'error': f'Error creating subscription: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    """Cancel current subscription"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        if not org.stripe_subscription_id:
            return Response({
                'error': 'No active subscription found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cancel Stripe subscription
        stripe.Subscription.modify(
            org.stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        org.cancel_at_period_end = True
        org.save()
        
        # Log subscription history
        SubscriptionHistory.objects.create(
            organization=org,
            event_type=SubscriptionEventType.CANCELED,
            old_plan=org.subscription_plan,
            metadata={
                'cancel_at_period_end': True
            }
        )
        
        logger.info(f"Subscription scheduled for cancellation for org {org.id}")
        
        return Response({
            'message': 'Subscription will be canceled at the end of the billing period'
        })
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        return Response({
            'error': f'Stripe error: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        return Response({
            'error': f'Error canceling subscription: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt  # Webhook must be exempt from CSRF protection
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events with comprehensive event processing"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {str(e)}")
        return JsonResponse({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid webhook signature: {str(e)}")
        return JsonResponse({'error': 'Invalid signature'}, status=400)
    
    # Check for duplicate event processing (idempotency)
    event_id = event.get('id')
    if event_id:
        # Check if we've already processed this event
        if SubscriptionHistory.objects.filter(stripe_event_id=event_id).exists():
            logger.info(f"Duplicate webhook event {event_id} - skipping")
            return JsonResponse({'status': 'duplicate'})
    
    # Process different event types
    event_type = event['type']
    event_object = event['data']['object']
    
    logger.info(f"Processing webhook event: {event_type} - {event_id}")
    
    try:
        if event_type == 'customer.subscription.created':
            # New subscription created
            subscription = event_object
            customer_id = subscription['customer']
            
            try:
                org = Organization.objects.get(stripe_customer_id=customer_id)
                
                # Determine plan from price ID
                price_id = subscription['items']['data'][0]['price']['id']
                new_plan = get_plan_from_price_id(price_id)
                
                if new_plan:
                    plan_config = PLAN_CONFIG[new_plan]
                    org.stripe_subscription_id = subscription['id']
                    org.subscription_plan = new_plan
                    org.subscription_status = SubscriptionStatus.ACTIVE
                    org.contacts_limit = plan_config['contacts_limit']
                    org.campaigns_limit = plan_config['campaigns_limit']
                    org.is_subscription_active = True
                    org.stripe_price_id = price_id
                    org.current_period_end = timezone.datetime.fromtimestamp(
                        subscription['current_period_end'],
                        tz=timezone.utc
                    )
                    org.save()
                    
                    # Log subscription history
                    SubscriptionHistory.objects.create(
                        organization=org,
                        event_type=SubscriptionEventType.CREATED,
                        stripe_event_id=event_id,
                        new_plan=new_plan,
                        new_status=SubscriptionStatus.ACTIVE,
                        metadata=subscription
                    )
                    
                    logger.info(f"Subscription created for org {org.id}")
                    
            except Organization.DoesNotExist:
                logger.error(f"Organization not found for customer {customer_id}")
        
        elif event_type == 'customer.subscription.updated':
            # Subscription updated (upgrade/downgrade/renewal)
            subscription = event_object
            subscription_id = subscription['id']
            
            try:
                org = Organization.objects.get(stripe_subscription_id=subscription_id)
                old_plan = org.subscription_plan
                old_status = org.subscription_status
                
                # Determine new plan from price ID
                price_id = subscription['items']['data'][0]['price']['id']
                new_plan = get_plan_from_price_id(price_id)
                
                if new_plan and new_plan != old_plan:
                    plan_config = PLAN_CONFIG[new_plan]
                    org.subscription_plan = new_plan
                    org.contacts_limit = plan_config['contacts_limit']
                    org.campaigns_limit = plan_config['campaigns_limit']
                    org.stripe_price_id = price_id
                
                # Update subscription status
                org.subscription_status = subscription['status'].upper() if subscription['status'] in ['active', 'past_due', 'canceled', 'trialing'] else SubscriptionStatus.ACTIVE
                org.current_period_end = timezone.datetime.fromtimestamp(
                    subscription['current_period_end'],
                    tz=timezone.utc
                )
                org.cancel_at_period_end = subscription.get('cancel_at_period_end', False)
                org.save()
                
                # Log subscription history
                SubscriptionHistory.objects.create(
                    organization=org,
                    event_type=SubscriptionEventType.UPDATED if new_plan == old_plan else SubscriptionEventType.PLAN_CHANGED,
                    stripe_event_id=event_id,
                    old_plan=old_plan,
                    new_plan=new_plan or old_plan,
                    old_status=old_status,
                    new_status=org.subscription_status,
                    metadata=subscription
                )
                
                logger.info(f"Subscription updated for org {org.id}")
                
                # Send notification if plan changed
                if new_plan and new_plan != old_plan:
                    from .notifications import send_subscription_changed_notification
                    send_subscription_changed_notification(org, old_plan, new_plan)
                
            except Organization.DoesNotExist:
                logger.error(f"Organization not found for subscription {subscription_id}")
        
        elif event_type == 'customer.subscription.deleted':
            # Subscription canceled
            subscription = event_object
            subscription_id = subscription['id']
            
            try:
                org = Organization.objects.get(stripe_subscription_id=subscription_id)
                old_plan = org.subscription_plan
                
                org.is_subscription_active = False
                org.subscription_status = SubscriptionStatus.CANCELED
                org.subscription_plan = SubscriptionPlan.FREE_TRIAL
                org.trial_ends_at = timezone.now() + timedelta(days=14)  # Reset to trial
                org.contacts_limit = 1000
                org.campaigns_limit = 10
                org.cancel_at_period_end = False
                org.save()
                
                # Log subscription history
                SubscriptionHistory.objects.create(
                    organization=org,
                    event_type=SubscriptionEventType.CANCELED,
                    stripe_event_id=event_id,
                    old_plan=old_plan,
                    new_plan=SubscriptionPlan.FREE_TRIAL,
                    old_status=SubscriptionStatus.ACTIVE,
                    new_status=SubscriptionStatus.CANCELED,
                    metadata=subscription
                )
                
                logger.info(f"Subscription canceled for org {org.id}")
                
                # Send cancellation notification
                from .notifications import send_cancellation_notification
                send_cancellation_notification(org)
                
            except Organization.DoesNotExist:
                logger.error(f"Organization not found for subscription {subscription_id}")
        
        elif event_type == 'invoice.payment_succeeded':
            # Payment succeeded
            invoice = event_object
            subscription_id = invoice.get('subscription')
            
            if subscription_id:
                try:
                    org = Organization.objects.get(stripe_subscription_id=subscription_id)
                    org.is_subscription_active = True
                    org.subscription_status = SubscriptionStatus.ACTIVE
                    
                    # Update payment method if present
                    if invoice.get('payment_intent'):
                        payment_intent = stripe.PaymentIntent.retrieve(invoice['payment_intent'])
                        if payment_intent.get('payment_method'):
                            org.stripe_payment_method_id = payment_intent['payment_method']
                    
                    org.save()
                    
                    # Log subscription history with invoice details
                    history_entry = SubscriptionHistory.objects.create(
                        organization=org,
                        event_type=SubscriptionEventType.PAYMENT_SUCCEEDED,
                        stripe_event_id=event_id,
                        amount=Decimal(invoice['amount_paid']) / 100,
                        currency=invoice.get('currency', 'USD').upper(),
                        invoice_id=invoice['id'],
                        invoice_pdf_url=invoice.get('invoice_pdf'),
                        receipt_number=invoice.get('receipt_number') or invoice.get('number'),
                        payment_method=invoice.get('payment_method_types', ['card'])[0] if invoice.get('payment_method_types') else 'card',
                        metadata=invoice
                    )
                    
                    # Try to get payment method details
                    if invoice.get('payment_intent'):
                        try:
                            payment_intent = stripe.PaymentIntent.retrieve(
                                invoice['payment_intent'], 
                                expand=['payment_method']
                            )
                            if payment_intent.payment_method and hasattr(payment_intent.payment_method, 'card'):
                                card = payment_intent.payment_method.card
                                history_entry.payment_method_brand = card.brand
                                history_entry.payment_method_last4 = card.last4
                                history_entry.save()
                        except Exception as e:
                            logger.warning(f"Could not retrieve payment method details: {str(e)}")
                    
                    logger.info(f"Payment succeeded for org {org.id}")
                    
                    # Send payment success notification
                    from .notifications import send_payment_success_notification
                    send_payment_success_notification(
                        organization=org,
                        amount=Decimal(invoice['amount_paid']) / 100,
                        invoice_id=invoice['id']
                    )
                    
                except Organization.DoesNotExist:
                    logger.error(f"Organization not found for subscription {subscription_id}")
        
        elif event_type == 'invoice.payment_failed':
            # Payment failed
            invoice = event_object
            subscription_id = invoice.get('subscription')
            
            if subscription_id:
                try:
                    org = Organization.objects.get(stripe_subscription_id=subscription_id)
                    
                    # Update status to past due
                    org.subscription_status = SubscriptionStatus.PAST_DUE
                    
                    # Give grace period before deactivating (3 days)
                    if not org.subscription_ends_at or org.subscription_ends_at > timezone.now():
                        org.subscription_ends_at = timezone.now() + timedelta(days=3)
                    
                    org.save()
                    
                    # Log subscription history
                    SubscriptionHistory.objects.create(
                        organization=org,
                        event_type=SubscriptionEventType.PAYMENT_FAILED,
                        stripe_event_id=event_id,
                        amount=Decimal(invoice['amount_due']) / 100,
                        currency=invoice.get('currency', 'USD').upper(),
                        invoice_id=invoice['id'],
                        failure_reason=invoice.get('failure_message', 'Unknown'),
                        metadata=invoice
                    )
                    
                    logger.warning(f"Payment failed for org {org.id}")
                    
                    # Send payment failure notification
                    from .notifications import send_payment_failed_notification
                    send_payment_failed_notification(
                        organization=org,
                        reason=invoice.get('failure_message', 'Payment could not be processed'),
                        amount=Decimal(invoice['amount_due']) / 100
                    )
                    
                except Organization.DoesNotExist:
                    logger.error(f"Organization not found for subscription {subscription_id}")
        
        elif event_type == 'customer.subscription.trial_will_end':
            # Trial ending soon (3 days before)
            subscription = event_object
            subscription_id = subscription['id']
            
            try:
                org = Organization.objects.get(stripe_subscription_id=subscription_id)
                
                # Log notification
                SubscriptionHistory.objects.create(
                    organization=org,
                    event_type=SubscriptionEventType.TRIAL_ENDED,
                    stripe_event_id=event_id,
                    metadata=subscription
                )
                
                logger.info(f"Trial ending soon for org {org.id}")
                
                # Send trial ending notification
                from .notifications import send_trial_expiry_reminder
                trial_end = subscription.get('trial_end')
                if trial_end:
                    days_remaining = (datetime.fromtimestamp(trial_end) - datetime.now()).days
                    send_trial_expiry_reminder(org, days_remaining)
                
            except Organization.DoesNotExist:
                logger.error(f"Organization not found for subscription {subscription_id}")
        
        else:
            logger.info(f"Unhandled webhook event type: {event_type}")
        
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        logger.error(f"Error processing webhook event {event_type}: {str(e)}")
        return JsonResponse({'error': 'Processing failed'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_subscription_access(request):
    """Check if user has access to specific features"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        feature = request.data.get('feature')
        
        # Check if subscription is active
        is_expired = False
        if org.subscription_plan == SubscriptionPlan.FREE_TRIAL and org.trial_ends_at:
            is_expired = timezone.now() > org.trial_ends_at
        elif org.subscription_ends_at:
            is_expired = timezone.now() > org.subscription_ends_at
        
        has_access = org.is_subscription_active and not is_expired
        
        return Response({
            'has_access': has_access,
            'is_expired': is_expired,
            'subscription_plan': org.subscription_plan,
            'subscription_status': org.subscription_status,
            'upgrade_required': not has_access
        })
        
    except Exception as e:
        logger.error(f"Error checking access: {str(e)}")
        return Response({
            'error': f'Error checking access: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Helper functions for subscription validation and usage tracking
def check_subscription_active(organization):
    """Check if organization's subscription is active"""
    if not organization:
        return False
    
    now = timezone.now()
    
    # Check subscription status
    if organization.subscription_status in [SubscriptionStatus.CANCELED, SubscriptionStatus.PAST_DUE]:
        return False
    
    # Check expiration based on plan type
    if organization.subscription_plan == SubscriptionPlan.FREE_TRIAL:
        if organization.trial_ends_at and now > organization.trial_ends_at:
            return False
    else:
        if organization.subscription_ends_at and now > organization.subscription_ends_at:
            return False
    
    return organization.is_subscription_active


def check_feature_available(organization, feature_name):
    """Check if a specific feature is available for the organization's plan"""
    if not organization:
        return False
    
    # First check if subscription is active
    if not check_subscription_active(organization):
        return False
    
    try:
        plan_features = PlanFeatures.objects.get(plan=organization.subscription_plan)
        return getattr(plan_features, feature_name, False)
    except PlanFeatures.DoesNotExist:
        # Default to basic features only
        basic_features = ['has_email_campaigns', 'has_basic_analytics']
        return feature_name in basic_features


def check_usage_limit(organization, resource_type):
    """Check if usage limit has been reached for a specific resource type"""
    if not organization:
        return {'allowed': False, 'reason': 'No organization'}
    
    # Get plan features and limits
    try:
        plan_features = PlanFeatures.objects.get(plan=organization.subscription_plan)
    except PlanFeatures.DoesNotExist:
        # Use default limits from organization
        plan_features = None
    
    # Get current usage
    usage = get_current_usage(organization)
    
    # Check specific resource limits
    if resource_type == 'campaigns':
        limit = plan_features.campaigns_limit if plan_features else organization.campaigns_limit
        current = organization.campaigns.count()
        return {
            'allowed': current < limit,
            'current': current,
            'limit': limit,
            'reason': f'Campaign limit reached ({current}/{limit})' if current >= limit else None
        }
    
    elif resource_type == 'contacts':
        limit = plan_features.contacts_limit if plan_features else organization.contacts_limit
        current = organization.contacts.count()
        return {
            'allowed': current < limit,
            'current': current,
            'limit': limit,
            'reason': f'Contact limit reached ({current}/{limit})' if current >= limit else None
        }
    
    elif resource_type == 'emails':
        limit = plan_features.emails_per_month if plan_features else organization.emails_per_month_limit
        current = usage['emails_sent']
        return {
            'allowed': current < limit,
            'current': current,
            'limit': limit,
            'reason': f'Monthly email limit reached ({current}/{limit})' if current >= limit else None
        }
    
    elif resource_type == 'templates':
        # Premium plans have unlimited custom templates
        if plan_features and plan_features.has_custom_templates:
            return {'allowed': True, 'current': None, 'limit': None, 'reason': None}
        
        # Basic plans have limited templates
        limit = 10 if 'basic' in organization.subscription_plan.lower() else 50
        current = organization.email_templates.count()
        return {
            'allowed': current < limit,
            'current': current,
            'limit': limit,
            'reason': f'Template limit reached ({current}/{limit})' if current >= limit else None
        }
    
    elif resource_type == 'domains':
        # Check if multi-domain is supported
        if plan_features and plan_features.has_white_labeling:
            return {'allowed': True, 'current': None, 'limit': None, 'reason': None}
        
        # Basic plans support limited domains
        limit = 1 if 'basic' in organization.subscription_plan.lower() else 3
        current = organization.domains.count()
        return {
            'allowed': current < limit,
            'current': current,
            'limit': limit,
            'reason': f'Domain limit reached ({current}/{limit})' if current >= limit else None
        }
    
    return {'allowed': False, 'reason': f'Unknown resource type: {resource_type}'}


def get_current_usage(organization):
    """Get current month's usage statistics for organization"""
    if not organization:
        return {}
    
    now = timezone.now()
    month_start = datetime(now.year, now.month, 1).date()
    
    # Get or create usage tracking for current month
    usage, created = UsageTracking.objects.get_or_create(
        organization=organization,
        month=month_start,
        defaults={
            'emails_sent': 0,
            'campaigns_created': 0,
            'contacts_imported': 0,
            'templates_created': 0,
            'domains_verified': 0,
            'api_calls': 0,
            'ab_tests_created': 0,
        }
    )
    
    # Get current counts from database
    return {
        'month': month_start.isoformat(),
        'emails_sent': usage.emails_sent,
        'campaigns_created': usage.campaigns_created,
        'contacts_imported': usage.contacts_imported,
        'templates_created': usage.templates_created,
        'domains_verified': usage.domains_verified,
        'api_calls': usage.api_calls,
        'ab_tests_created': usage.ab_tests_created,
        # Current totals
        'total_contacts': organization.contacts.count(),
        'total_campaigns': organization.campaigns.count(),
        'total_templates': organization.email_templates.count(),
        'total_domains': organization.domains.count(),
    }


def update_usage_tracking(organization, resource_type, increment=1):
    """Update usage tracking for a specific resource"""
    if not organization:
        return
    
    now = timezone.now()
    month_start = datetime(now.year, now.month, 1).date()
    
    # Get or create usage tracking for current month
    usage, created = UsageTracking.objects.get_or_create(
        organization=organization,
        month=month_start
    )
    
    # Map resource types to fields
    field_map = {
        'emails': 'emails_sent',
        'campaigns': 'campaigns_created',
        'contacts': 'contacts_imported',
        'templates': 'templates_created',
        'domains': 'domains_verified',
        'api': 'api_calls',
        'ab_tests': 'ab_tests_created',
    }
    
    if resource_type in field_map:
        field_name = field_map[resource_type]
        UsageTracking.objects.filter(
            organization=organization,
            month=month_start
        ).update(**{field_name: F(field_name) + increment})


def get_subscription_details(organization):
    """Get comprehensive subscription details for an organization"""
    if not organization:
        return None
    
    now = timezone.now()
    
    # Check if subscription is active
    is_active = check_subscription_active(organization)
    
    # Calculate days remaining
    days_remaining = None
    if organization.subscription_plan == SubscriptionPlan.FREE_TRIAL:
        if organization.trial_ends_at:
            days_remaining = (organization.trial_ends_at - now).days
    else:
        if organization.subscription_ends_at:
            days_remaining = (organization.subscription_ends_at - now).days
    
    # Get plan features
    try:
        plan_features = PlanFeatures.objects.get(plan=organization.subscription_plan)
        features = {
            'contacts_limit': plan_features.contacts_limit,
            'campaigns_limit': plan_features.campaigns_limit,
            'emails_per_month': plan_features.emails_per_month,
            'has_advanced_analytics': plan_features.has_advanced_analytics,
            'has_ab_testing': plan_features.has_ab_testing,
            'has_api_access': plan_features.has_api_access,
            'has_automation': plan_features.has_automation,
            'has_white_labeling': plan_features.has_white_labeling,
            'has_custom_templates': plan_features.has_custom_templates,
            'has_priority_support': plan_features.has_priority_support,
        }
    except PlanFeatures.DoesNotExist:
        features = {
            'contacts_limit': organization.contacts_limit,
            'campaigns_limit': organization.campaigns_limit,
            'emails_per_month': organization.emails_per_month_limit,
        }
    
    # Get current usage
    usage = get_current_usage(organization)
    
    return {
        'plan': organization.subscription_plan,
        'status': organization.subscription_status,
        'is_active': is_active,
        'is_trial': organization.subscription_plan == SubscriptionPlan.FREE_TRIAL,
        'days_remaining': days_remaining,
        'trial_ends_at': organization.trial_ends_at.isoformat() if organization.trial_ends_at else None,
        'subscription_ends_at': organization.subscription_ends_at.isoformat() if organization.subscription_ends_at else None,
        'features': features,
        'usage': usage,
        'billing_cycle': organization.billing_cycle,
        'cancel_at_period_end': organization.cancel_at_period_end,
    }


# Notification API endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    """Get user's notification history"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get query parameters
        limit = int(request.GET.get('limit', 50))
        offset = int(request.GET.get('offset', 0))
        unread_only = request.GET.get('unread_only', 'false').lower() == 'true'
        channel = request.GET.get('channel', None)  # 'email', 'in_app', or None for all
        
        # Build query
        query = SubscriptionNotification.objects.filter(
            organization=user.organization
        )
        
        # Filter by channel if specified
        if channel:
            query = query.filter(channel=channel)
        
        # Filter by unread if requested
        if unread_only:
            query = query.filter(is_read=False)
        
        # Get total count before pagination
        total_count = query.count()
        unread_count = query.filter(is_read=False).count() if not unread_only else total_count
        
        # Apply pagination
        notifications = query.order_by('-created_at')[offset:offset + limit]
        
        # Serialize notifications
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'id': str(notification.id),
                'type': notification.notification_type,
                'channel': notification.channel,
                'status': notification.status,
                'is_read': notification.is_read,
                'sent_at': notification.sent_at.isoformat() if notification.sent_at else None,
                'read_at': notification.read_at.isoformat() if notification.read_at else None,
                'created_at': notification.created_at.isoformat(),
                'metadata': notification.metadata or {},
                'error_message': notification.error_message,
            })
        
        return Response({
            'notifications': notifications_data,
            'total_count': total_count,
            'unread_count': unread_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count
        })
        
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        return Response({
            'error': f'Error fetching notifications: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request):
    """Mark notification(s) as read"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        notification_ids = request.data.get('notification_ids', [])
        mark_all = request.data.get('mark_all', False)
        
        if mark_all:
            # Mark all unread notifications as read
            notifications = SubscriptionNotification.objects.filter(
                organization=user.organization,
                is_read=False
            )
            updated_count = notifications.update(
                is_read=True,
                read_at=timezone.now()
            )
            
            return Response({
                'success': True,
                'updated_count': updated_count,
                'message': f'Marked {updated_count} notifications as read'
            })
        
        elif notification_ids:
            # Mark specific notifications as read
            notifications = SubscriptionNotification.objects.filter(
                id__in=notification_ids,
                organization=user.organization,
                is_read=False
            )
            
            updated_count = 0
            for notification in notifications:
                notification.mark_as_read()
                updated_count += 1
            
            return Response({
                'success': True,
                'updated_count': updated_count,
                'message': f'Marked {updated_count} notifications as read'
            })
        
        else:
            return Response({
                'error': 'No notification IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error marking notifications as read: {str(e)}")
        return Response({
            'error': f'Error marking notifications as read: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_notification_preferences(request):
    """Update notification preferences for the organization"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get preferences from request
        preferences = request.data.get('preferences', {})
        
        # Valid preference keys
        valid_keys = [
            'email_trial_reminders',
            'email_payment_notifications',
            'email_subscription_changes',
            'email_usage_alerts',
            'in_app_notifications',
            'webhook_notifications',
            'notification_frequency',  # 'immediate', 'daily_digest', 'weekly_digest'
        ]
        
        # Filter and validate preferences
        filtered_prefs = {k: v for k, v in preferences.items() if k in valid_keys}
        
        # Store preferences in organization metadata
        org = user.organization
        if not hasattr(org, 'metadata') or org.metadata is None:
            org.metadata = {}
        
        # Update notification preferences
        if 'notification_preferences' not in org.metadata:
            org.metadata['notification_preferences'] = {}
        
        org.metadata['notification_preferences'].update(filtered_prefs)
        
        # Save the organization
        org.save(update_fields=['metadata', 'updated_at'])
        
        # Log the preference update
        logger.info(f"Updated notification preferences for org {org.id}: {filtered_prefs}")
        
        return Response({
            'success': True,
            'preferences': org.metadata.get('notification_preferences', {}),
            'message': 'Notification preferences updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating notification preferences: {str(e)}")
        return Response({
            'error': f'Error updating notification preferences: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification_preferences(request):
    """Get current notification preferences"""
    try:
        user = request.user
        if not user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        org = user.organization
        
        # Default preferences
        default_prefs = {
            'email_trial_reminders': True,
            'email_payment_notifications': True,
            'email_subscription_changes': True,
            'email_usage_alerts': True,
            'in_app_notifications': True,
            'webhook_notifications': False,
            'notification_frequency': 'immediate',
        }
        
        # Get stored preferences or use defaults
        if hasattr(org, 'metadata') and org.metadata:
            stored_prefs = org.metadata.get('notification_preferences', {})
            preferences = {**default_prefs, **stored_prefs}
        else:
            preferences = default_prefs
        
        return Response({
            'preferences': preferences
        })
        
    except Exception as e:
        logger.error(f"Error fetching notification preferences: {str(e)}")
        return Response({
            'error': f'Error fetching notification preferences: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)