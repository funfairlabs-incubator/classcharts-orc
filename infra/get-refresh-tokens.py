#!/usr/bin/env python3
"""
Get OAuth refresh tokens for Gmail and Google Calendar.
Uses manual copy/paste flow — no redirect URI required.

Usage:
  pip install google-auth-oauthlib --break-system-packages
  export GOOGLE_CLIENT_ID=your-client-id
  export GOOGLE_CLIENT_SECRET=your-client-secret
  python3 infra/get-refresh-tokens.py
"""

import os
import sys
from google_auth_oauthlib.flow import Flow

CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first")
    sys.exit(1)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
]

client_config = {
    "web": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"],
    }
}

flow = Flow.from_client_config(
    client_config,
    scopes=SCOPES,
    redirect_uri="urn:ietf:wg:oauth:2.0:oob",
)

auth_url, _ = flow.authorization_url(
    access_type="offline",
    prompt="consent",
)

print("\n1. Open this URL in your browser:\n")
print(auth_url)
print("\n2. Sign in and grant access")
print("3. Copy the code shown and paste it below\n")

code = input("Enter the authorisation code: ").strip()
flow.fetch_token(code=code)
creds = flow.credentials

print("\n" + "="*60)
print("✅  Refresh token obtained!")
print("="*60)
print(f"\nGCAL_REFRESH_TOKEN={creds.refresh_token}")
print(f"GMAIL_REFRESH_TOKEN={creds.refresh_token}")
print("\n(Both Calendar and Gmail share the same refresh token")
print(" since we requested both scopes in one flow.)")
print("="*60 + "\n")
