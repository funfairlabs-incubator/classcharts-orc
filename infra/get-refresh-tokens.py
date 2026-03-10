#!/usr/bin/env python3
"""
Get OAuth refresh tokens for Gmail and Google Calendar.
Spins up a local server on port 8080 to catch the redirect.

Usage:
  pip install google-auth-oauthlib --break-system-packages
  export GOOGLE_CLIENT_ID=your-client-id
  export GOOGLE_CLIENT_SECRET=your-client-secret
  python3 infra/get-refresh-tokens.py
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
        "redirect_uris": ["http://localhost:8080"],
    }
}

print("\nOpening browser for Google OAuth consent...")
print("If it doesn't open automatically, check the terminal for a URL.\n")

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(
    port=8080,
    prompt="consent",
    access_type="offline",
    open_browser=True,
)

print("\n" + "="*60)
print("✅  Refresh token obtained!")
print("="*60)
print(f"\nGCAL_REFRESH_TOKEN={creds.refresh_token}")
print(f"GMAIL_REFRESH_TOKEN={creds.refresh_token}")
print("\n(Both Calendar and Gmail share the same refresh token")
print(" since we requested both scopes in one flow.)")
print("="*60 + "\n")
