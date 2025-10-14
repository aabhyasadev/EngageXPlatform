from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Organization, User, Invitation, OrganizationMembership
from apps.common.constants import MembershipStatus, SubscriptionPlan, UserRole
from .serializers import (OrganizationSerializer, UserSerializer, InvitationSerializer, InvitationVerifySerializer)


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Organization.objects.all()
        if self.request.user.organization:
            return Organization.objects.filter(id=self.request.user.organization.id)
        return Organization.objects.none()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Get current organization from session (set by auth system)
        current_organization_id = self.request.session.get('current_organization_id')
        if not current_organization_id:
            return User.objects.none()
        
        # Get all users who are members of the current organization (both active and inactive)
        member_user_ids = OrganizationMembership.objects.filter(
            organization_id=current_organization_id
            # Remove status filter to show both active and inactive members
        ).values_list('user_id', flat=True)
        
        return User.objects.filter(id__in=member_user_ids)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['patch'])
    def update_profile(self, request):
        """Update current user profile"""
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Update user role/status in current organization"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Get current organization from session
        current_organization_id = request.session.get('current_organization_id')
        if not current_organization_id:
            return Response({
                'error': 'No organization context found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has permission to update (admin or organizer)
        if request.user.role not in ['admin', 'organizer']:
            return Response({
                'error': 'Only admin and organizer can update team members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Handle role or status updates through membership
        if 'role' in request.data or 'is_active' in request.data:
            membership = OrganizationMembership.objects.filter(
                user=instance,
                organization_id=current_organization_id
                # Remove status filter to allow updating inactive members (for reactivation)
            ).first()
            
            if not membership:
                return Response({
                    'error': 'User is not a member of this organization'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Update role in membership if provided
            if 'role' in request.data:
                membership.role = request.data['role']
                membership.save()
            
            # Update membership status if provided (organization-scoped, not global user account)
            if 'is_active' in request.data:
                new_status = MembershipStatus.ACTIVE if request.data['is_active'] else MembershipStatus.INACTIVE
                
                # Prevent deactivating the last active admin in the organization
                if new_status == MembershipStatus.INACTIVE and membership.role in ['admin', 'organizer']:
                    active_admins = OrganizationMembership.objects.filter(
                        organization_id=current_organization_id,
                        role__in=['admin', 'organizer'],
                        status=MembershipStatus.ACTIVE
                    ).exclude(id=membership.id).count()
                    
                    if active_admins == 0:
                        return Response({
                            'error': 'Cannot deactivate the last admin in the organization'
                        }, status=status.HTTP_400_BAD_REQUEST)
                
                # Update membership status (NOT global user status)
                membership.status = new_status
                membership.save()
        
        # For other user fields, use default serializer
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Remove user from current organization (not delete user)"""
        instance = self.get_object()
        
        # Get current organization from session
        current_organization_id = request.session.get('current_organization_id')
        if not current_organization_id:
            return Response({
                'error': 'No organization context found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has permission to remove members (admin or organizer)
        if request.user.role not in ['admin', 'organizer']:
            return Response({
                'error': 'Only admin and organizer can remove team members'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Cannot remove yourself
        if instance.id == request.user.id:
            return Response({
                'error': 'Cannot remove yourself from the organization'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove membership (don't delete user)
        deleted_count = OrganizationMembership.objects.filter(
            user=instance,
            organization_id=current_organization_id
        ).delete()
        
        if deleted_count[0] == 0:
            return Response({
                'error': 'User is not a member of this organization'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        """Create invitation instead of directly creating user"""
        from datetime import timedelta
        from apps.notifications.notifications import send_invitation_email
        
        if not request.user.organization:
            return Response({
                'error': 'No organization found'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if user has permission to invite (admin or organizer)
        if request.user.role not in ['admin', 'organizer']:
            return Response({
                'error': 'Only admin and organizer can invite team members'
            }, status=status.HTTP_403_FORBIDDEN)

        email = request.data.get('email')
        role = request.data.get('role', 'campaign_manager')

        if not email:
            return Response({
                'error': 'Email is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if user already exists in organization
        if User.objects.filter(email=email, organization=request.user.organization).exists():
            return Response({
                'error': 'User already exists in this organization'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if invitation already exists and is pending
        existing_invitation = Invitation.objects.filter(
            email=email,
            organization=request.user.organization,
            status='pending'
        ).first()

        if existing_invitation and not existing_invitation.is_expired():
            return Response({
                'error': 'Invitation already sent to this email address'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Revoke any existing pending invitations for this email
        Invitation.objects.filter(
            email=email,
            organization=request.user.organization,
            status='pending'
        ).update(status='revoked')

        # Create new invitation (token is auto-generated via model default)
        invitation = Invitation.objects.create(
            organization=request.user.organization,
            email=email,
            role=role,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7)
        )

        # Check if the invited email belongs to an existing user (platform-wide)
        from apps.notifications.notifications import send_team_invitation_notification
        existing_user = None
        try:
            existing_user = User.objects.get(email=email)
        except User.DoesNotExist:
            existing_user = None
        
        # Send in-app notification to existing user
        notification_sent = False
        if existing_user:
            notification_sent = send_team_invitation_notification(invitation, existing_user)
        
        # Send invitation email
        email_sent = send_invitation_email(invitation)
        
        # Determine response message based on notification and email status
        message_parts = []
        if existing_user and notification_sent:
            message_parts.append(f'In-app notification sent to {email}')
        
        if email_sent:
            message_parts.append(f'Email invitation sent to {email}')
        elif not email_sent:
            message_parts.append('Email could not be sent due to configuration issue')
        
        if not email_sent and not notification_sent:
            return Response({
                'message': f'Invitation created successfully for {email}',
                'warning': 'Neither email nor notification could be sent',
                'invitation_id': invitation.id
            }, status=status.HTTP_201_CREATED)

        return Response({
            'message': ' and '.join(message_parts) if message_parts else f'Invitation created for {email}',
            'invitation_id': invitation.id,
            'existing_user': existing_user is not None,
            'notification_sent': notification_sent,
            'email_sent': email_sent
        }, status=status.HTTP_201_CREATED)


class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'token'
    
    def get_queryset(self):
        if not self.request.user.organization:
            return Invitation.objects.none()
        return Invitation.objects.filter(organization=self.request.user.organization)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def verify(self, request, token=None):
        """Verify invitation token and return invitation details"""
        try:
            invitation = Invitation.objects.get(token=token, status='pending')
            
            if invitation.is_expired():
                invitation.status = 'expired'
                invitation.save()
                return Response({
                    'error': 'Invitation has expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = InvitationVerifySerializer(invitation)
            return Response(serializer.data)
            
        except Invitation.DoesNotExist:
            return Response({
                'error': 'Invalid invitation token'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def check_user(self, request, token=None):
        """Check if the invited email belongs to an existing user"""
        try:
            invitation = Invitation.objects.get(token=token, status='pending')
            
            if invitation.is_expired():
                return Response({
                    'error': 'Invitation has expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            existing_user = User.objects.filter(email=invitation.email).first()
            
            return Response({
                'user_exists': existing_user is not None,
                'email': invitation.email
            })
            
        except Invitation.DoesNotExist:
            return Response({
                'error': 'Invalid invitation token'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def accept(self, request, token=None):
        """Accept an invitation and create user account"""
        from django.contrib.auth import authenticate, login
        
        try:
            invitation = Invitation.objects.get(token=token, status='pending')
            
            if invitation.is_expired():
                invitation.status = 'expired'
                invitation.save()
                return Response({
                    'error': 'Invitation has expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user already exists
            existing_user = User.objects.filter(email=invitation.email).first()
            
            if existing_user:
                user = existing_user
            else:
                # For new users, profile data is required
                first_name = request.data.get('first_name', '').strip()
                last_name = request.data.get('last_name', '').strip()
                password = request.data.get('password', '')
                
                if not first_name or not last_name or not password:
                    return Response({
                        'error': 'First name, last name, and password are required for new users'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if len(password) < 8:
                    return Response({
                        'error': 'Password must be at least 8 characters long'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Create new organization for the new user
                from datetime import timedelta
                
                new_organization = Organization.objects.create(
                    name=f"{first_name} {last_name}'s Organization",
                    subscription_plan=SubscriptionPlan.FREE_TRIAL,
                    trial_ends_at=timezone.now() + timedelta(days=14),  # 14-day trial
                    industry='Not specified',  # Default value
                    employees_range='1-10',  # Default value
                    contacts_range='0-1000'  # Default value
                )
                
                # Create new user with complete profile and their own organization
                user = User.objects.create_user(
                    email=invitation.email,
                    first_name=first_name,
                    last_name=last_name,
                    password=password,
                    organization=new_organization,  # Assign to their new organization
                    role=UserRole.ORGANIZER,  # They become the organizer of their own org
                    is_active=True
                )
                
                # Send welcome/confirmation email to the new user
                self._send_new_user_confirmation_email(user, new_organization)
            
            # Check if membership already exists (shouldn't happen but safety check)
            existing_membership = OrganizationMembership.objects.filter(
                user=user,
                organization=invitation.organization
            ).first()
            
            if existing_membership:
                # Update existing membership
                existing_membership.role = invitation.role
                existing_membership.status = MembershipStatus.ACTIVE
                existing_membership.save()
            else:
                # Create new membership
                OrganizationMembership.objects.create(
                    user=user,
                    organization=invitation.organization,
                    role=invitation.role,
                    status=MembershipStatus.ACTIVE,
                    invited_by=invitation.invited_by
                )
            
            # Mark invitation as accepted
            invitation.status = 'accepted'
            invitation.accepted_at = timezone.now()
            invitation.save()
            
            # Send notification to the inviter about acceptance
            from apps.notifications.notifications import send_invitation_accepted_notification
            notification_sent = send_invitation_accepted_notification(invitation)
            
            # Mark any related "invitation received" notifications as read for the accepting user
            # This ensures their notification dropdown is cleaned up
            if user:
                from apps.accounts.models import SubscriptionNotification, NotificationType
                related_notifications = SubscriptionNotification.objects.filter(
                    user=user,
                    notification_type=NotificationType.TEAM_INVITATION_RECEIVED,
                    metadata__icontains=str(invitation.id),
                    is_read=False
                )
                related_notifications.update(is_read=True)
            
            # Return user data for frontend
            user_serializer = UserSerializer(user)
            return Response({
                'message': 'Invitation accepted successfully',
                'user': user_serializer.data,
                'organization': invitation.organization.name,
                'inviter_notified': notification_sent
            }, status=status.HTTP_200_OK)
            
        except Invitation.DoesNotExist:
            return Response({
                'error': 'Invalid invitation token'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def decline(self, request, token=None):
        """Decline an invitation"""
        try:
            invitation = Invitation.objects.get(token=token, status='pending')
            
            invitation.status = 'revoked'
            invitation.save()
            
            return Response({
                'message': 'Invitation declined'
            }, status=status.HTTP_200_OK)
            
        except Invitation.DoesNotExist:
            return Response({
                'error': 'Invalid invitation token'
            }, status=status.HTTP_404_NOT_FOUND)
    
    def _send_new_user_confirmation_email(self, user, organization):
        """Send confirmation email to new users who created an account via invitation"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        try:
            first_name = user.first_name or 'New User'
            
            html_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #007bff;">Welcome to EngageX, {first_name}! 🎉</h2>
                <p style="font-size: 16px; color: #333;">
                    Your account has been successfully created after accepting an invitation, and you're all set to start your email marketing journey!
                </p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #333; margin-top: 0;">Your Account Details:</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> {user.email}</p>
                    <p style="margin: 5px 0;"><strong>Your Organization:</strong> {organization.name}</p>
                    <p style="margin: 5px 0;"><strong>Organization ID:</strong> {organization.id}</p>
                </div>
                <p style="color: #666;">
                    We've automatically created your own organization account with a 14-day free trial. 
                    You can now log in and start creating powerful email campaigns.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{getattr(settings, 'FRONTEND_URL', 'http://localhost:5000')}/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Log In to Your Account
                    </a>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    EngageX - Professional Email Marketing Platform
                </p>
            </div>
            """
            
            plain_message = f"""
            Welcome to EngageX, {first_name}!
            
            Your account has been successfully created after accepting an invitation, and you're all set to start your email marketing journey!
            
            Your Account Details:
            Email: {user.email}
            Your Organization: {organization.name}
            Organization ID: {organization.id}
            
            We've automatically created your own organization account with a 14-day free trial. 
            You can now log in and start creating powerful email campaigns.
            
            EngageX - Professional Email Marketing Platform
            """
            
            send_mail(
                subject=f'Welcome to EngageX, {first_name}!',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            
            return True
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send confirmation email to {user.email}: {str(e)}")
            return False
