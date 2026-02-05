# 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

Complete guide to deploy your Birth Certificate WhatsApp Bot

---

## ✅ CHECKLIST - What You Need

Before starting, make sure you have:

- [x] Meta Developer account created
- [x] WhatsApp app created in Meta
- [x] Access Token (saved)
- [x] Phone Number ID (saved)
- [x] GitHub account
- [x] This bot code downloaded

---

## 📦 STEP 1: Upload Code to GitHub (10 minutes)

### Option A: Using GitHub Website (Easiest)

1. **Go to GitHub.com** and login
2. **Click "+" → "New repository"**
3. **Repository name:** `birth-certificate-bot`
4. **Set to Public** (for free hosting)
5. **Click "Create repository"**
6. **Click "uploading an existing file"**
7. **Drag and drop ALL files:**
   - `server.js`
   - `package.json`
   - `.env.example`
   - `README.md`
   - `.gitignore`
8. **Click "Commit changes"**

### Option B: Using Git Command Line

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Birth Certificate Bot"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/birth-certificate-bot.git

# Push to GitHub
git push -u origin main
```

---

## 🌐 STEP 2: Deploy to Render.com (15 minutes)

### 2.1: Create Render Account

1. **Go to:** https://render.com
2. **Click "Get Started"**
3. **Sign up with GitHub** (easiest option)
4. **Authorize Render** to access your GitHub

### 2.2: Create New Web Service

1. **Click "New +" button** (top right)
2. **Select "Web Service"**
3. **Connect your repository:**
   - Find `birth-certificate-bot`
   - Click "Connect"

### 2.3: Configure Service

Fill in these details:

**Basic Settings:**
- **Name:** `hp-birth-cert-bot` (or any name you like)
- **Region:** Singapore (closest to India)
- **Branch:** `main`
- **Root Directory:** (leave empty)
- **Runtime:** `Node`

**Build Settings:**
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Instance Type:**
- **Select:** `Free` (0$/month)

### 2.4: Add Environment Variables

**Click "Advanced" → "Add Environment Variable"**

Add these 3 variables:

| Key | Value |
|-----|-------|
| `WHATSAPP_TOKEN` | Paste your token from Meta |
| `WHATSAPP_PHONE_ID` | Paste your phone number ID |
| `WEBHOOK_VERIFY_TOKEN` | Create any random string (e.g., `MySecretToken123`) |

**Example:**
```
WHATSAPP_TOKEN = EAAG7ZBw8xxxxxxxxxxxxxxx
WHATSAPP_PHONE_ID = 123456789012345
WEBHOOK_VERIFY_TOKEN = BirthCert2024Secret
```

### 2.5: Deploy!

1. **Click "Create Web Service"**
2. **Wait 2-3 minutes** for deployment
3. **Look for "Live" status** (green dot)
4. **Copy your app URL** 
   - Example: `https://hp-birth-cert-bot.onrender.com`
   - **SAVE THIS URL!** You'll need it next

---

## 🔗 STEP 3: Connect Webhook to Meta (10 minutes)

### 3.1: Go to Meta Developer Console

1. **Open:** https://developers.facebook.com
2. **Click "My Apps"**
3. **Select your app** (e.g., "Wats Demo")
4. **Click "WhatsApp"** in left sidebar

### 3.2: Configure Webhook

1. **Click "Configuration"** (under WhatsApp)
2. **Click "Edit"** button next to Webhook
3. **Enter Callback URL:**
   ```
   https://your-render-url.onrender.com/webhook
   ```
   Replace `your-render-url` with YOUR actual Render URL!
   
4. **Enter Verify Token:**
   - Use the SAME token you set in Render environment variables
   - Example: `BirthCert2024Secret`

5. **Click "Verify and Save"**
   - If successful: ✅ Verified
   - If failed: Check URL and verify token match

### 3.3: Subscribe to Messages

1. **Scroll down to "Webhook fields"**
2. **Check the box:** `messages`
3. **Click "Save"**

---

## 🧪 STEP 4: Test Your Bot! (5 minutes)

### 4.1: Test Health Endpoint

Open in browser:
```
https://your-render-url.onrender.com/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-04T...",
  "sessions": 0,
  "applications": 0
}
```

### 4.2: Send WhatsApp Message

1. **Open WhatsApp** on your phone
2. **Send message to your WhatsApp Business number**
3. **Type:** `Hi`
4. **Bot should respond!** 🎉

**Expected Response:**
```
🏛️ Welcome to HP Birth Certificate Services

👋 Namaste! I'm your digital assistant...

Please select your preferred language:
[English] [हिंदी]
```

### 4.3: Test Complete Flow

1. Select language
2. Choose "Apply for Birth Certificate"
3. Fill in all details
4. Submit application
5. Receive Application ID

---

## 🐛 TROUBLESHOOTING

### ❌ Bot not responding?

**Check Render Logs:**
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. Look for errors

**Common Issues:**
- Environment variables not set correctly
- Webhook URL wrong
- Token expired

### ❌ Webhook verification failed?

- Verify token must EXACTLY match in:
  - Render environment variables
  - Meta webhook configuration
- URL must be HTTPS (Render provides this automatically)
- URL must end with `/webhook`

### ❌ "Application Error" in Render?

- Check you uploaded ALL files (including `package.json`)
- Check environment variables are set
- Look at logs for specific error

---

## 📊 MONITORING

### View Logs

**Render Dashboard:**
1. Go to your service
2. Click "Logs"
3. See real-time activity

**Check Applications:**
```
https://your-render-url.onrender.com/applications
```

---

## 🎉 SUCCESS CHECKLIST

- [ ] Code uploaded to GitHub
- [ ] Deployed to Render (shows "Live")
- [ ] Environment variables added
- [ ] Webhook configured in Meta
- [ ] Webhook verified successfully
- [ ] Health endpoint working
- [ ] Bot responds to WhatsApp messages
- [ ] Complete application flow tested

---

## 📝 IMPORTANT NOTES

### Free Tier Limitations

**Render Free Tier:**
- ✅ Free forever
- ⚠️ Spins down after 15 min inactivity
- ⚠️ First message may take 30 seconds to respond (while waking up)
- ✅ Auto-restarts when message received

**To prevent spin-down:**
- Upgrade to paid tier ($7/month for always-on)
- Or use a ping service to keep it alive

### Access Token Expiry

- Temporary tokens expire in 24 hours
- Create permanent token (see Step 6 in original guide)
- Store permanent token in Render environment variables

---

## 🆘 NEED HELP?

**Check these in order:**

1. **Health endpoint** - Is server running?
2. **Render logs** - Any errors?
3. **Webhook status** - Verified in Meta?
4. **Environment variables** - All set correctly?
5. **WhatsApp number** - Correct phone number ID?

**Still stuck?**
- Email: webfastitsolutions@gmail.com
- Or show me screenshots and I'll help debug!

---

## 🎊 CONGRATULATIONS!

Your WhatsApp Birth Certificate Bot is now LIVE! 🚀

Users can now apply for birth certificates directly through WhatsApp!

**Next Steps:**
- Add your real WhatsApp Business number
- Customize messages
- Add more features
- Deploy to production

---

**Built with ❤️ for HP Government Services**
