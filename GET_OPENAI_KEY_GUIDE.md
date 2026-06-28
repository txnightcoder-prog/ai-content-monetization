# 🔑 How to Get Your OpenAI API Key

Follow these steps to get your OpenAI API key for the AI Content Monetization system.

---

## Step 1: Create an OpenAI Account

1. **Go to OpenAI Platform:**
   - Visit: https://platform.openai.com/signup
   
2. **Sign Up:**
   - Click "Sign up"
   - Use your email, Google, or Microsoft account
   - Verify your email if required

3. **Complete Profile:**
   - Add your phone number (required for verification)
   - Enter verification code sent via SMS

---

## Step 2: Add Payment Method

⚠️ **Important:** OpenAI requires a payment method to use the API (even for testing)

1. **Go to Billing:**
   - Visit: https://platform.openai.com/account/billing/overview
   
2. **Add Payment Method:**
   - Click "Add payment method"
   - Enter credit/debit card details
   
3. **Set Usage Limits (Recommended):**
   - Click "Usage limits"
   - Set a monthly budget (e.g., $10-$20 for testing)
   - This prevents unexpected charges

---

## Step 3: Create API Key

1. **Go to API Keys Page:**
   - Visit: https://platform.openai.com/api-keys
   - Or click your profile → "API keys"

2. **Create New Key:**
   - Click "+ Create new secret key"
   - Give it a name (e.g., "AI Content Monetization")
   - Click "Create secret key"

3. **Copy Your Key:**
   - **IMPORTANT:** Copy the key immediately!
   - It looks like: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - You won't be able to see it again after closing the dialog
   - Store it securely (don't share it publicly)

---

## Step 4: Add Key to Your Project

1. **Open Your .env File:**
   ```
   C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend\.env
   ```

2. **Replace the Placeholder:**
   
   Change this line:
   ```
   OPENAI_API_KEY=sk-proj-replace-with-your-actual-openai-api-key
   ```
   
   To this (with your actual key):
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Save the File**

---

## Step 5: Restart Backend Server

1. **Stop the Backend:**
   - Press `Ctrl+C` in the terminal running the backend

2. **Restart:**
   ```powershell
   cd C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend
   uvicorn app.main:app --reload
   ```

3. **Verify:**
   - You should see: "OpenAI service initialized successfully"
   - No more "MOCK MODE" warnings

---

## Step 6: Test the API

Test the script generation endpoint:

```powershell
# PowerShell
Invoke-WebRequest -Uri "http://localhost:8000/api/v1/scripts/generate?topic=How%20to%20Make%20Money%20with%20AI&niche=AI%20tools" -Method POST
```

You should now get a real AI-generated script! 🎉

---

## 💰 Pricing Information

**GPT-4 Pricing (as of 2024):**
- Input: $0.03 per 1K tokens (~750 words)
- Output: $0.06 per 1K tokens (~750 words)

**Estimated Costs:**
- Script generation (60-second video): ~$0.01-0.03 per script
- 100 scripts: ~$1-3
- 1000 scripts: ~$10-30

**Tips to Save Money:**
- Use GPT-3.5-turbo instead of GPT-4 (10x cheaper)
- Set usage limits in OpenAI dashboard
- Monitor usage regularly

---

## 🔒 Security Best Practices

1. **Never commit .env file to Git**
   - Already in .gitignore ✓

2. **Don't share your API key**
   - Treat it like a password

3. **Rotate keys regularly**
   - Create new keys every few months
   - Delete old keys

4. **Use environment variables**
   - Never hardcode keys in source code

5. **Set usage limits**
   - Prevents unexpected charges if key is compromised

---

## 🆘 Troubleshooting

### "Insufficient credits" error
- Add payment method in billing settings
- Add credits to your account

### "Invalid API key" error
- Check for extra spaces in .env file
- Make sure you copied the entire key
- Verify key is active in OpenAI dashboard

### "Rate limit exceeded" error
- You're making too many requests
- Wait a few seconds between requests
- Upgrade to paid tier for higher limits

### Still getting 500 errors?
- Check backend terminal for specific error message
- Verify .env file is in correct location
- Make sure you restarted the backend after adding key

---

## 📚 Additional Resources

- **OpenAI Documentation:** https://platform.openai.com/docs
- **API Reference:** https://platform.openai.com/docs/api-reference
- **Pricing:** https://openai.com/pricing
- **Usage Dashboard:** https://platform.openai.com/usage

---

## ✅ Quick Checklist

- [ ] Created OpenAI account
- [ ] Verified phone number
- [ ] Added payment method
- [ ] Set usage limits
- [ ] Created API key
- [ ] Copied key to .env file
- [ ] Restarted backend server
- [ ] Tested API endpoint
- [ ] Confirmed real AI responses (no "MOCK MODE")

---

**Need Help?** 
If you encounter any issues, share the error message and I'll help you troubleshoot!