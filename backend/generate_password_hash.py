#!/usr/bin/env python
"""
Generate Django password hash
"""
import hashlib
import base64
import secrets

def make_password(password, salt=None, hasher='pbkdf2_sha256'):
    """
    Create a Django-compatible password hash
    """
    if salt is None:
        salt = base64.b64encode(secrets.token_bytes(12)).decode('ascii')
    
    iterations = 1000000  # Django default for pbkdf2_sha256
    
    # Generate hash using pbkdf2_sha256
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), iterations)
    hash_b64 = base64.b64encode(hash_bytes).decode('ascii')
    
    return f"{hasher}${iterations}${salt}${hash_b64}"

if __name__ == '__main__':
    password = "Awarapan@#12"
    hash_result = make_password(password)
    print(f"Password: {password}")
    print(f"Hash: {hash_result}")