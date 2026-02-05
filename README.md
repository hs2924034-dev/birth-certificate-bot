# 🏛️ HP Birth Certificate WhatsApp Bot

A WhatsApp chatbot for Himachal Pradesh Government birth certificate applications built with Meta WhatsApp Business API.

## ✨ Features

- 🌐 **Bilingual Support** - English & Hindi
- 📝 **Complete Application Form** - Collects all required information
- ✅ **Data Validation** - Validates mobile numbers, dates, etc.
- 💬 **Interactive Buttons** - Easy-to-use WhatsApp buttons
- 🔄 **Session Management** - Remembers user progress
- 📊 **Application Tracking** - Track submitted applications
- 🛡️ **Error Handling** - Robust error handling system

## 📋 Prerequisites

- Node.js 16 or higher
- Meta Developer Account
- WhatsApp Business API access
- A phone number for WhatsApp Business

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd birth-cert-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file and add your credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values:

```env
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_ID=123456789012345
WEBHOOK_VERIFY_TOKEN=my_secret_token_123
PORT=3000
```

### 4. Run the bot locally

```bash
npm start
```

The bot will start on `http://localhost:3000`

## 🌐 Deployment

### Deploy to Render (Recommended - Free)

1. **Create account** at [render.com](https://render.com)

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository**

4. **Configure:**
   - Name: `hp-birth-cert-bot`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

5. **Add Environment Variables:**
   - `WHATSAPP_TOKEN` = Your token
   - `WHATSAPP_PHONE_ID` = Your phone number ID
   - `WEBHOOK_VERIFY_TOKEN` = Your verify token

6. **Click "Create Web Service"**

7. **Copy your app URL** (e.g., `https://hp-birth-cert-bot.onrender.com`)

### Deploy to Railway

1. **Create account** at [railway.app](https://railway.app)
2. **Click "New Project" → "Deploy from GitHub repo"**
3. **Select your repository**
4. **Add environment variables** in Settings
5. **Deploy!**

## 🔗 Connect Webhook to Meta

After deploying, configure your webhook in Meta:

1. Go to [Meta Developers](https://developers.facebook.com)
2. Select your app → WhatsApp → Configuration
3. Click "Edit" under Webhook
4. Enter:
   - **Callback URL**: `https://your-app-url.com/webhook`
   - **Verify Token**: Same as `WEBHOOK_VERIFY_TOKEN` in .env
5. Click "Verify and Save"
6. Subscribe to `messages` field

## 📱 Test Your Bot

1. **Get your test number** from Meta Developer Console
2. **Send a WhatsApp message** to your WhatsApp Business number
3. **The bot will respond!** 🎉

Test messages:
- "Hi" - Start conversation
- "MENU" - Show main menu
- "HELP" - Get help

## 🏗️ Bot Flow

```
User sends "Hi"
    ↓
Language Selection (English/Hindi)
    ↓
Main Menu
    ↓
Apply for Birth Certificate
    ↓
Collect Information:
  - Child's name
  - Date of birth
  - Gender
  - Father's name
  - Mother's name
  - Place of birth
  - Address
  - Mobile number
    ↓
Confirm Details
    ↓
Submit Application
    ↓
Receive Application ID
```

## 📝 API Endpoints

### Webhook Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive messages from WhatsApp

### Utility Endpoints

- `GET /health` - Health check
- `GET /applications` - View all applications (admin)

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WHATSAPP_TOKEN` | Your WhatsApp access token | Yes |
| `WHATSAPP_PHONE_ID` | Your phone number ID | Yes |
| `WEBHOOK_VERIFY_TOKEN` | Token for webhook verification | Yes |
| `PORT` | Server port (default: 3000) | No |

### Customization

You can customize messages in `server.js`:

- Edit `MESSAGES.en` for English messages
- Edit `MESSAGES.hi` for Hindi messages
- Modify form fields in the `MessageHandler` class

## 🔒 Security

- Webhook signature verification enabled
- Input validation for all user data
- Session management with automatic cleanup
- Environment variables for sensitive data

## 📊 Monitoring

Check bot health:
```bash
curl https://your-app-url.com/health
```

View applications:
```bash
curl https://your-app-url.com/applications
```

## 🐛 Troubleshooting

### Bot not responding?

1. Check logs in Render/Railway dashboard
2. Verify environment variables are set
3. Ensure webhook is properly configured
4. Check WhatsApp token hasn't expired

### Webhook verification failing?

- Ensure `WEBHOOK_VERIFY_TOKEN` matches in both .env and Meta console
- Check your deployment URL is accessible
- Verify HTTPS is enabled (required by Meta)

### Messages not being received?

- Check webhook subscription includes `messages` field
- Verify phone number is correctly configured
- Test with `/health` endpoint to ensure server is running

## 📚 Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/business-management-api)
- [Meta Developer Console](https://developers.facebook.com/)
- [Express.js Documentation](https://expressjs.com/)

## 🤝 Support

For issues or questions:
- Email: webfastitsolutions@gmail.com
- Create an issue on GitHub

## 📄 License

MIT License - feel free to use this for your projects!

---

**Built with ❤️ by Webfast IT Solutions**
