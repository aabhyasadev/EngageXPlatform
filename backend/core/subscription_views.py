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
from .models import Organization, SubscriptionPlan, User, SubscriptionHistory, SubscriptionEventType, SubscriptionStatus
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
                    
                    # Log subscription history
                    SubscriptionHistory.objects.create(
                        organization=org,
                        event_type=SubscriptionEventType.PAYMENT_SUCCEEDED,
                        stripe_event_id=event_id,
                        amount=Decimal(invoice['amount_paid']) / 100,
                        currency=invoice.get('currency', 'USD').upper(),
                        invoice_id=invoice['id'],
                        payment_method=invoice.get('payment_method_types', ['card'])[0] if invoice.get('payment_method_types') else 'card',
                        metadata=invoice
                    )
                    
                    logger.info(f"Payment succeeded for org {org.id}")
                    
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
                    
                    # TODO: Send payment failure notification email
                    
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
                
                # TODO: Send trial ending notification email
                
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