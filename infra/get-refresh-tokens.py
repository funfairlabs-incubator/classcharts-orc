#!/usr/bin/env python3
"""
Get OAuth refresh tokens for Gmail and Google Calendar.
Run this locally — it will open a browser for consent.

Usage:
  pip install google-auth-oauthlib
  export GOOGLE_CLIENT_ID=your-client-id
  export GOOGLE_CLIENT_SECRET=your-client-secret
  python3 get-refresh-tokens.py
"""

import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

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
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

print("\n" + "="*60)
print("✅  Refresh token obtained!")
print("="*60)
print(f"\nGCAL_REFRESH_TOKEN={creds.refresh_token}")
print(f"GMAIL_REFRESH_TOKEN={creds.refresh_token}")
print("\n(Both Calendar and Gmail share the same refresh token")
print(" since we requested both scopes in one flow.)")
print("="*60 + "\n")
