from django.urls import path
from .signup_views import (check_email, basic_info, business_info, send_otp, resend_otp, verify_otp, create_account)
from .auth_views import (auth_user, dashboard_stats, logout_view, get_csrf_token, test_connection, switch_organization)
from .signin_views import (validate_organization_email, authenticate_credentials, verify_mfa_otp_sso, forgot_account, logout_user)

urlpatterns = [
    # Test endpoint for Django-frontend connection
    path('api/test', test_connection, name='test_connection'),
    
    # Auth routes
    path('auth/user', auth_user, name='auth_user'),
    path('auth/logout', logout_view, name='logout'),
    path('auth/switch-organization', switch_organization, name='switch_organization'),
    path('auth/csrf', get_csrf_token, name='csrf_token'),
    
    # Dashboard
    path('dashboard/stats', dashboard_stats, name='dashboard_stats'),
    
    # Signup flow endpoints
    path('signup/check-email', check_email, name='signup_check_email'),
    path('signup/basic-info', basic_info, name='signup_basic_info'),
    path('signup/business-info', business_info, name='signup_business_info'),
    path('signup/send-otp', send_otp, name='signup_send_otp'),
    path('signup/resend-otp', resend_otp, name='signup_resend_otp'),
    path('signup/verify-otp', verify_otp, name='signup_verify_otp'),
    path('signup/create-account', create_account, name='signup_create_account'),
    
    # Sign-in flow endpoints
    path('signin/validate-org-email/', validate_organization_email, name='signin_validate_org_email'),
    path('signin/authenticate/', authenticate_credentials, name='signin_authenticate'),
    path('signin/verify/', verify_mfa_otp_sso, name='signin_verify'),
    path('signin/forgot-account/', forgot_account, name='signin_forgot_account'),
    path('signin/logout/', logout_user, name='signin_logout'),
]
