"""
YouTube API Token Generator
This script helps you get the refresh token needed for YouTube API access.
"""

from google_auth_oauthlib.flow import InstalledAppFlow
import json
import os
import sys

# Scopes required for YouTube API
SCOPES = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
]

def get_refresh_token():
    """Get YouTube API refresh token"""
    
    print("=" * 70)
    print(" " * 20 + "YouTube API Token Generator")
    print("=" * 70)
    print()
    
    # Check if client_secret.json exists
    if not os.path.exists('client_secret.json'):
        print("❌ ERROR: client_secret.json not found!")
        print()
        print("Please follow these steps:")
        print("1. Go to https://console.cloud.google.com")
        print("2. Create OAuth credentials (Desktop app)")
        print("3. Download the JSON file")
        print("4. Save it as 'client_secret.json' in this folder")
        print()
        print("See YOUTUBE_API_SETUP.md for detailed instructions.")
        input("\nPress Enter to exit...")
        return
    
    try:
        with open('client_secret.json', 'r') as f:
            client_config = json.load(f)
    except json.JSONDecodeError:
        print("❌ ERROR: client_secret.json is not valid JSON!")
        print("Please download it again from Google Cloud Console.")
        input("\nPress Enter to exit...")
        return
    
    print("✅ Found client_secret.json")
    print()
    print("Starting OAuth authorization flow...")
    print()
    print("📌 IMPORTANT:")
    print("   A browser window will open in a few seconds.")
    print("   Please follow these steps:")
    print()
    print("   1. Log in with your Google account (the one with your YouTube channel)")
    print("   2. You'll see a warning: 'Google hasn't verified this app'")
    print("      → Click 'Advanced'")
    print("      → Click 'Go to AI Content System (unsafe)'")
    print("      → This is YOUR app, so it's safe!")
    print("   3. Check ALL permission boxes")
    print("   4. Click 'Continue'")
    print()
    input("Press Enter when ready to open browser...")
    print()
    print("Opening browser...")
    
    try:
        # Run OAuth flow
        flow = InstalledAppFlow.from_client_secrets_file(
            'client_secret.json',
            scopes=SCOPES
        )
        
        credentials = flow.run_local_server(
            port=8080,
            prompt='consent',
            success_message='✅ Authorization successful! You can close this window and return to the terminal.'
        )
        
        # Extract credentials
        client_id = client_config['installed']['client_id']
        client_secret = client_config['installed']['client_secret']
        refresh_token = credentials.refresh_token
        
        if not refresh_token:
            print()
            print("❌ ERROR: No refresh token received!")
            print("This might happen if you've authorized this app before.")
            print()
            print("To fix:")
            print("1. Go to https://myaccount.google.com/permissions")
            print("2. Find 'AI Content System' and remove it")
            print("3. Run this script again")
            input("\nPress Enter to exit...")
            return
        
        print()
        print("=" * 70)
        print(" " * 25 + "✅ SUCCESS!")
        print("=" * 70)
        print()
        print("Your YouTube API credentials are ready!")
        print()
        print("📋 Copy these lines to your .env file:")
        print("-" * 70)
        print()
        print(f"YOUTUBE_CLIENT_ID={client_id}")
        print(f"YOUTUBE_CLIENT_SECRET={client_secret}")
        print(f"YOUTUBE_REFRESH_TOKEN={refresh_token}")
        print()
        print("-" * 70)
        print()
        
        # Save to file for easy copying
        with open('youtube_credentials.txt', 'w') as f:
            f.write("# YouTube API Credentials\n")
            f.write("# Copy these lines to your .env file\n\n")
            f.write(f"YOUTUBE_CLIENT_ID={client_id}\n")
            f.write(f"YOUTUBE_CLIENT_SECRET={client_secret}\n")
            f.write(f"YOUTUBE_REFRESH_TOKEN={refresh_token}\n")
        
        print("✅ Credentials also saved to: youtube_credentials.txt")
        print()
        print("Next steps:")
        print("1. Open your .env file")
        print("2. Find the YouTube section")
        print("3. Paste the three lines above")
        print("4. Save the file")
        print("5. Restart your backend server")
        print()
        print("=" * 70)
        
    except Exception as e:
        print()
        print("=" * 70)
        print("❌ ERROR during authorization:")
        print("=" * 70)
        print()
        print(str(e))
        print()
        print("Common issues:")
        print("• Make sure you completed all authorization steps")
        print("• Check that you granted all permissions")
        print("• Try running the script again")
        print("• See YOUTUBE_API_SETUP.md for troubleshooting")
        print()
    
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    try:
        get_refresh_token()
    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

# Made with Bob
