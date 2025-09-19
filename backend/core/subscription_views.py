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
from .models import Organization, SubscriptionPlan, User
import json

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Plan configuration with pricing and features
PLAN_CONFIG = {
    SubscriptionPlan.FREE_TRIAL: {
        'name': 'Free Trial',
        'price': 0,
        'contacts_limit': 1000,
        'campaigns_limit': 10,
        'features': ['Email campaigns', 'Basic analytics', '1000 contacts', '10 campaigns']
    },
    SubscriptionPlan.BASIC_MONTHLY: {
        'name': 'Basic Monthly',
        'price': 29,
        'contacts_limit': 5000,
        'campaigns_limit': 50,
        'features': ['Email campaigns', 'Basic analytics', '5000 contacts', '50 campaigns', 'A/B testing']
    },
    SubscriptionPlan.BASIC_YEARLY: {
        'name': 'Basic Yearly', 
        'price': 290,  # 10 months price
        'contacts_limit': 5000,
        'campaigns_limit': 50,
        'features': ['Email campaigns', 'Basic analytics', '5000 contacts', '50 campaigns', 'A/B testing']
    },
    SubscriptionPlan.PRO_MONTHLY: {
        'name': 'Pro Monthly',
        'price': 79,
        'contacts_limit': 25000,
        'campaigns_limit': 200,
        'features': ['All Basic features', 'Advanced analytics', '25000 contacts', '200 campaigns', 'Automation', 'Custom templates']
    },
    SubscriptionPlan.PRO_YEARLY: {
        'name': 'Pro Yearly',
        'price': 790,  # 10 months price
        'contacts_limit': 25000,
        'campaigns_limit': 200,
        'features': ['All Basic features', 'Advanced analytics', '25000 contacts', '200 campaigns', 'Automation', 'Custom templates']
    },
    SubscriptionPlan.PREMIUM_MONTHLY: {
        'name': 'Premium Monthly',
        'price': 149,
        'contacts_limit': 100000,
        'campaigns_limit': 1000,
        'features': ['All Pro features', 'Priority support', '100000 contacts', '1000 campaigns', 'White labeling', 'API access']
    },
    SubscriptionPlan.PREMIUM_YEARLY: {
        'name': 'Premium Yearly',
        'price': 1490,  # 10 months price
        'contacts_limit': 100000,
        'campaigns_limit': 1000,
        'features': ['All Pro features', 'Priority support', '100000 contacts', '1000 campaigns', 'White labeling', 'API access']
    }
}


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
                'contacts_limit': config['contacts_limit'],
                'campaigns_limit': config['campaigns_limit'],
                'features': config['features'],
                'is_yearly': 'yearly' in plan_key.lower()
            })
    
    return Response({'plans': plans})


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
                'is_active': org.is_subscription_active and not is_expired,
                'is_expired': is_expired,
                'contacts_limit': org.contacts_limit,
                'campaigns_limit': org.campaigns_limit,
                'features': plan_config.get('features', [])
            }
        })
        
    except Exception as e:
        return Response({
            'error': f'Error retrieving subscription: {str(e)}'
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
        subscription = stripe.Subscription.create(
            customer=org.stripe_customer_id,
            items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan_config['name'],
                    },
                    'unit_amount': plan_config['price'] * 100,  # Convert to cents
                    'recurring': {
                        'interval': 'year' if 'yearly' in plan_id else 'month',
                    },
                }
            }],
            payment_behavior='default_incomplete',
            payment_settings={'save_default_payment_method': 'on_subscription'},
            expand=['latest_invoice.payment_intent'],
        )
        
        # Update organization with subscription details
        org.stripe_subscription_id = subscription.id
        org.subscription_plan = plan_id
        org.contacts_limit = plan_config['contacts_limit']
        org.campaigns_limit = plan_config['campaigns_limit']
        org.is_subscription_active = True
        
        # Set subscription end date
        if 'yearly' in plan_id:
            org.subscription_ends_at = timezone.now() + timedelta(days=365)
        else:
            org.subscription_ends_at = timezone.now() + timedelta(days=30)
        
        org.save()
        
        return Response({
            'client_secret': subscription.latest_invoice.payment_intent.client_secret,
            'subscription_id': subscription.id
        })
        
    except stripe.error.StripeError as e:
        return Response({
            'error': f'Stripe error: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
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
        
        return Response({
            'message': 'Subscription will be canceled at the end of the billing period'
        })
        
    except stripe.error.StripeError as e:
        return Response({
            'error': f'Stripe error: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'error': f'Error canceling subscription: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        # Verify webhook signature (you should set STRIPE_WEBHOOK_SECRET)
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return JsonResponse({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({'error': 'Invalid signature'}, status=400)
    
    # Handle different event types
    if event['type'] == 'invoice.payment_succeeded':
        # Payment succeeded - activate subscription
        subscription_id = event['data']['object']['subscription']
        try:
            org = Organization.objects.get(stripe_subscription_id=subscription_id)
            org.is_subscription_active = True
            org.save()
        except Organization.DoesNotExist:
            pass
    
    elif event['type'] == 'invoice.payment_failed':
        # Payment failed - handle gracefully
        subscription_id = event['data']['object']['subscription']
        try:
            org = Organization.objects.get(stripe_subscription_id=subscription_id)
            # Give 3 days grace period before deactivating
            org.subscription_ends_at = timezone.now() + timedelta(days=3)
            org.save()
        except Organization.DoesNotExist:
            pass
    
    elif event['type'] == 'customer.subscription.deleted':
        # Subscription canceled
        subscription_id = event['data']['object']['id']
        try:
            org = Organization.objects.get(stripe_subscription_id=subscription_id)
            org.is_subscription_active = False
            org.subscription_plan = SubscriptionPlan.FREE_TRIAL
            org.trial_ends_at = timezone.now() + timedelta(days=14)  # Reset to trial
            org.contacts_limit = 1000
            org.campaigns_limit = 10
            org.save()
        except Organization.DoesNotExist:
            pass
    
    return JsonResponse({'status': 'success'})


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
            'upgrade_required': not has_access
        })
        
    except Exception as e:
        return Response({
            'error': f'Error checking access: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)