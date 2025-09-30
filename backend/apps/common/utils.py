"""
Common utility functions used across the EngageX application.
"""
import secrets


def generate_invitation_token():
    """Generate a secure token for invitations"""
    return secrets.token_urlsafe(32)
