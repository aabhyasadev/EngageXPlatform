#!/usr/bin/env python
"""
Script to set the correct password for test user
"""
import os
import sys
import django

# Setup Django
sys.path.append('/home/runner/workspace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.hashers import make_password
from core.models import User

def fix_test_user_password():
    """Set the correct password for the test user"""
    try:
        user = User.objects.get(email='abhishek.dubey@aabhyasa.com')
        
        # Set the password to "Awarapan@#12"
        password = "Awarapan@#12"
        hashed_password = make_password(password)
        
        print(f"Setting password for user: {user.email}")
        print(f"New password hash: {hashed_password}")
        
        user.password = hashed_password
        user.save()
        
        print("✅ Password updated successfully!")
        
        # Verify the password works
        if user.check_password(password):
            print("✅ Password verification successful!")
        else:
            print("❌ Password verification failed!")
            
    except User.DoesNotExist:
        print("❌ User not found!")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    fix_test_user_password()