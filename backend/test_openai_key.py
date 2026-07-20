"""
Quick test script to verify your OpenAI API key is working correctly.
Run this before starting the full backend server.
"""
import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

def test_openai_key():
    """Test if OpenAI API key is valid and working"""
    
    print("=" * 60)
    print("🔑 Testing OpenAI API Key")
    print("=" * 60)
    
    # Check if key exists
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("❌ ERROR: OPENAI_API_KEY not found in environment variables")
        print("\n📝 To fix:")
        print("1. Make sure .env file exists in backend/ directory")
        print("2. Add this line to .env:")
        print("   OPENAI_API_KEY=sk-proj-your-actual-key-here")
        return False
    
    # Check if it's a placeholder
    if api_key.startswith("sk-proj-replace") or api_key == "your-openai-api-key-here":
        print("WARNING: Using placeholder API key")
        print("   Current key: [REDACTED]")
        print("\nTo fix:")
        print("1. Get your real API key from https://platform.openai.com/api-keys")
        print("2. Replace the placeholder in .env file")
        return False

    print(f"API key found: [REDACTED - {len(api_key)} chars]")
    print(f"   Length: {len(api_key)} characters")
    
    # Test the API key with a simple request
    print("\n🧪 Testing API connection...")
    
    try:
        client = OpenAI(api_key=api_key)
        
        # Make a simple test request
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Using cheaper model for testing
            messages=[
                {"role": "user", "content": "Say 'Hello! API key is working!' in exactly 5 words."}
            ],
            max_tokens=20
        )
        
        result = response.choices[0].message.content.strip()
        
        print(f"✅ API Response: {result}")
        print(f"   Model used: {response.model}")
        print(f"   Tokens used: {response.usage.total_tokens}")
        print(f"   Estimated cost: ${response.usage.total_tokens * 0.000002:.6f}")
        
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! Your OpenAI API key is working correctly!")
        print("=" * 60)
        print("\n✅ You can now start the backend server:")
        print("   uvicorn app.main:app --reload")
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: API request failed")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        
        if "authentication" in str(e).lower() or "api key" in str(e).lower():
            print("\n📝 This looks like an authentication error.")
            print("   Possible causes:")
            print("   1. Invalid API key")
            print("   2. API key has been revoked")
            print("   3. Extra spaces in the key")
            print("\n   Solution:")
            print("   1. Go to https://platform.openai.com/api-keys")
            print("   2. Create a new API key")
            print("   3. Copy it carefully (no extra spaces)")
            print("   4. Update .env file")
        
        elif "insufficient" in str(e).lower() or "quota" in str(e).lower():
            print("\n📝 This looks like a billing/quota error.")
            print("   Solution:")
            print("   1. Go to https://platform.openai.com/account/billing")
            print("   2. Add a payment method")
            print("   3. Add credits to your account")
        
        elif "rate limit" in str(e).lower():
            print("\n📝 Rate limit exceeded.")
            print("   Solution: Wait a few seconds and try again")
        
        else:
            print("\n📝 Unexpected error. Check your internet connection.")
        
        return False

if __name__ == "__main__":
    print("\n")
    success = test_openai_key()
    print("\n")
    
    if not success:
        exit(1)  # Exit with error code
    else:
        exit(0)  # Exit successfully

# Made with Bob
