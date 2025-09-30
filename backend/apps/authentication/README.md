# Authentication App

## Overview
Handles user authentication flows including signup, signin, and session management.

## Models
- **EmailOTP**: One-time password management for email verification
- **Session**: Custom session storage for authenticated users

## Key Features
- Replit OpenID Connect (OIDC) integration
- Email-based OTP verification
- Session management with PostgreSQL storage
- Authentication middleware and decorators
- Rate limiting for OTP attempts

## Authentication Flows
1. **Signup**: Email verification with OTP → Organization creation → User registration
2. **Signin**: OIDC authentication → Session creation → User profile retrieval

## API Endpoints
- `/signup/send-otp/` - Send verification code
- `/signup/verify-otp/` - Verify code and create account
- `/signin/authenticate/` - Authenticate with OIDC
- `/auth/user` - Get authenticated user details
- `/auth/logout` - Terminate session
