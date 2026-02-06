/**
 * WhatsApp Birth Certificate Bot
 * HP Government e-Services
 * Built with Meta WhatsApp Business API
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  PORT: process.env.PORT || 3000,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_123',
  META_API_VERSION: 'v18.0'
};

// In-memory storage (replace with database in production)
const userSessions = new Map();
const applications = new Map();

// =============================================================================
// WHATSAPP API HELPER
// =============================================================================

class WhatsAppAPI {
  static async sendMessage(to, message) {
    try {
      const url = `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${CONFIG.WHATSAPP_PHONE_ID}/messages`;
      
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: to,
          ...message
        },
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  static async sendTextMessage(to, text) {
    return this.sendMessage(to, {
      type: 'text',
      text: { body: text }
    });
  }

  static async sendButtonMessage(to, text, buttons) {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: text },
        action: {
          buttons: buttons.map((btn, idx) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${idx}`,
              title: btn.title
            }
          }))
        }
      }
    });
  }

  static async sendListMessage(to, text, buttonText, sections) {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: text },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    });
  }
}

// =============================================================================
// USER SESSION MANAGEMENT
// =============================================================================

class SessionManager {
  static getSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        state: 'INITIAL',
        language: 'en',
        data: {},
        createdAt: Date.now()
      });
    }
    return userSessions.get(userId);
  }

  static updateSession(userId, updates) {
    const session = this.getSession(userId);
    Object.assign(session, updates);
    userSessions.set(userId, session);
    return session;
  }

  static resetSession(userId) {
    userSessions.delete(userId);
    return this.getSession(userId);
  }
}

// =============================================================================
// MESSAGE TEMPLATES
// =============================================================================

const MESSAGES = {
  en: {
    welcome: `🏛️ *Welcome to HP Birth Certificate Services*

👋 Namaste! I'm your digital assistant for birth certificate applications.

Please select your preferred language to continue:`,
    
    main_menu: `📋 *Main Menu*

What would you like to do?

1️⃣ Apply for New Birth Certificate
2️⃣ Check Application Status
3️⃣ Download Certificate
4️⃣ Help & Support

Reply with the number of your choice.`,

    start_application: `📝 *New Birth Certificate Application*

I'll help you apply for a birth certificate. Please have the following information ready:

✅ Child's details (Name, DOB, Gender)
✅ Parents' details
✅ Place of birth
✅ Contact information

Let's begin! 

What is the *full name of the child*?`,

    ask_dob: `📅 What is the *date of birth* of the child?

Please enter in format: DD/MM/YYYY
Example: 15/01/2024`,

    ask_gender: `👶 What is the *gender* of the child?

Reply with:
1️⃣ Male
2️⃣ Female
3️⃣ Other`,

    ask_father_name: `👨 What is the *father's full name*?`,

    ask_mother_name: `👩 What is the *mother's full name*?`,

    ask_place_of_birth: `🏥 Where was the child born?

Reply with:
1️⃣ Hospital
2️⃣ Home
3️⃣ Other`,

    ask_hospital_name: `🏥 What is the *name of the hospital*?`,

    ask_address: `🏠 What is your *complete address*?

Include: House/Flat No., Street, Area, City, PIN Code`,

    ask_mobile: `📱 What is your *mobile number*?

This will be used for updates and OTP verification.`,

    confirm_details: `✅ *Please confirm your details:*

👶 Child Name: {childName}
📅 Date of Birth: {dob}
👤 Gender: {gender}
👨 Father's Name: {fatherName}
👩 Mother's Name: {motherName}
🏥 Place of Birth: {placeOfBirth}
🏠 Address: {address}
📱 Mobile: {mobile}

Is this information correct?

1️⃣ Yes, Submit Application
2️⃣ No, Start Over`,

    application_submitted: `🎉 *Application Submitted Successfully!*

Your application ID: *{applicationId}*

✅ Your birth certificate application has been received
📧 Confirmation sent to your mobile
⏱️ Processing time: 7-10 working days

You can check your application status anytime by selecting "Check Status" from the main menu.

Type *MENU* to return to main menu.`,

    invalid_input: `❌ Invalid input. Please try again.`,

    help: `ℹ️ *Help & Support*

*How to apply:*
1. Select language
2. Choose "Apply for New Certificate"
3. Fill in all required details
4. Submit application

*Processing time:* 7-10 working days

*For technical support:*
📞 Call: 1800-XXX-XXXX
📧 Email: support@hpgov.in

Type *MENU* to return to main menu.`
  },
  
  hi: {
    welcome: `🏛️ *हिमाचल प्रदेश जन्म प्रमाण पत्र सेवा में आपका स्वागत है*

👋 नमस्ते! मैं जन्म प्रमाण पत्र आवेदन के लिए आपका डिजिटल सहायक हूं।

कृपया जारी रखने के लिए अपनी पसंदीदा भाषा चुनें:`,

    main_menu: `📋 *मुख्य मेनू*

आप क्या करना चाहेंगे?

1️⃣ नया जन्म प्रमाण पत्र के लिए आवेदन करें
2️⃣ आवेदन की स्थिति जांचें
3️⃣ प्रमाण पत्र डाउनलोड करें
4️⃣ सहायता और समर्थन

अपनी पसंद का नंबर भेजें।`,

    start_application: `📝 *नया जन्म प्रमाण पत्र आवेदन*

मैं आपको जन्म प्रमाण पत्र के लिए आवेदन करने में मदद करूंगा। कृपया निम्नलिखित जानकारी तैयार रखें:

✅ बच्चे का विवरण (नाम, जन्मतिथि, लिंग)
✅ माता-पिता का विवरण
✅ जन्म स्थान
✅ संपर्क जानकारी

आइए शुरू करें!

बच्चे का *पूरा नाम* क्या है?`,

    ask_dob: `📅 बच्चे की *जन्म तिथि* क्या है?

कृपया इस प्रारूप में दर्ज करें: DD/MM/YYYY
उदाहरण: 15/01/2024`,

    ask_gender: `👶 बच्चे का *लिंग* क्या है?

जवाब दें:
1️⃣ पुरुष
2️⃣ महिला
3️⃣ अन्य`,

    ask_father_name: `👨 पिता का *पूरा नाम* क्या है?`,

    ask_mother_name: `👩 माता का *पूरा नाम* क्या है?`,

    ask_place_of_birth: `🏥 बच्चे का जन्म कहाँ हुआ था?

जवाब दें:
1️⃣ अस्पताल
2️⃣ घर
3️⃣ अन्य`,

    ask_hospital_name: `🏥 *अस्पताल का नाम* क्या है?`,

    ask_address: `🏠 आपका *पूरा पता* क्या है?

शामिल करें: मकान/फ्लैट नंबर, गली, क्षेत्र, शहर, पिन कोड`,

    ask_mobile: `📱 आपका *मोबाइल नंबर* क्या है?

इसका उपयोग अपडेट और OTP सत्यापन के लिए किया जाएगा।`,

    confirm_details: `✅ *कृपया अपने विवरण की पुष्टि करें:*

👶 बच्चे का नाम: {childName}
📅 जन्म तिथि: {dob}
👤 लिंग: {gender}
👨 पिता का नाम: {fatherName}
👩 माता का नाम: {motherName}
🏥 जन्म स्थान: {placeOfBirth}
🏠 पता: {address}
📱 मोबाइल: {mobile}

क्या यह जानकारी सही है?

1️⃣ हां, आवेदन जमा करें
2️⃣ नहीं, फिर से शुरू करें`,

    application_submitted: `🎉 *आवेदन सफलतापूर्वक जमा किया गया!*

आपका आवेदन ID: *{applicationId}*

✅ आपका जन्म प्रमाण पत्र आवेदन प्राप्त हो गया है
📧 आपके मोबाइल पर पुष्टि भेजी गई
⏱️ प्रक्रिया समय: 7-10 कार्य दिवस

आप मुख्य मेनू से "स्थिति जांचें" चुनकर किसी भी समय अपने आवेदन की स्थिति जांच सकते हैं।

मुख्य मेनू पर वापस जाने के लिए *MENU* टाइप करें।`,

    invalid_input: `❌ अमान्य इनपुट। कृपया पुनः प्रयास करें।`,

    help: `ℹ️ *सहायता और समर्थन*

*आवेदन कैसे करें:*
1. भाषा चुनें
2. "नया प्रमाण पत्र के लिए आवेदन करें" चुनें
3. सभी आवश्यक विवरण भरें
4. आवेदन जमा करें

*प्रक्रिया समय:* 7-10 कार्य दिवस

*तकनीकी सहायता के लिए:*
📞 कॉल करें: 1800-XXX-XXXX
📧 ईमेल: support@hpgov.in

मुख्य मेनू पर वापस जाने के लिए *MENU* टाइप करें।`
  }
};

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

class MessageHandler {
  static async handle(from, messageText, messageType = 'text') {
    const session = SessionManager.getSession(from);
    const lang = session.language;
    const messages = MESSAGES[lang];

    console.log(`Processing message from ${from}, State: ${session.state}, Message: ${messageText}`);

    try {
      // Check for menu command
      if (messageText.toUpperCase() === 'MENU') {
        SessionManager.updateSession(from, { state: 'MAIN_MENU' });
        await WhatsAppAPI.sendTextMessage(from, messages.main_menu);
        return;
      }

      // Check for help command
      if (messageText.toUpperCase() === 'HELP') {
        await WhatsAppAPI.sendTextMessage(from, messages.help);
        return;
      }

      // State machine
      switch (session.state) {
        case 'INITIAL':
          await this.handleInitial(from, session);
          break;

        case 'LANGUAGE_SELECTION':
          await this.handleLanguageSelection(from, messageText, session);
          break;

        case 'MAIN_MENU':
          await this.handleMainMenu(from, messageText, session);
          break;

        case 'COLLECT_CHILD_NAME':
          await this.handleChildName(from, messageText, session);
          break;

        case 'COLLECT_DOB':
          await this.handleDOB(from, messageText, session);
          break;

        case 'COLLECT_GENDER':
          await this.handleGender(from, messageText, session);
          break;

        case 'COLLECT_FATHER_NAME':
          await this.handleFatherName(from, messageText, session);
          break;

        case 'COLLECT_MOTHER_NAME':
          await this.handleMotherName(from, messageText, session);
          break;

        case 'COLLECT_PLACE_OF_BIRTH':
          await this.handlePlaceOfBirth(from, messageText, session);
          break;

        case 'COLLECT_HOSPITAL_NAME':
          await this.handleHospitalName(from, messageText, session);
          break;

        case 'COLLECT_ADDRESS':
          await this.handleAddress(from, messageText, session);
          break;

        case 'COLLECT_MOBILE':
          await this.handleMobile(from, messageText, session);
          break;

        case 'CONFIRM_DETAILS':
          await this.handleConfirmation(from, messageText, session);
          break;

        default:
          await this.handleInitial(from, session);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      await WhatsAppAPI.sendTextMessage(
        from,
        lang === 'hi' 
          ? '❌ कुछ गलत हो गया। कृपया पुनः प्रयास करें।'
          : '❌ Something went wrong. Please try again.'
      );
    }
  }

  static async handleInitial(from, session) {
    await WhatsAppAPI.sendButtonMessage(
      from,
      MESSAGES.en.welcome,
      [
        { id: 'lang_en', title: '🇬🇧 English' },
        { id: 'lang_hi', title: '🇮🇳 हिंदी' }
      ]
    );
    SessionManager.updateSession(from, { state: 'LANGUAGE_SELECTION' });
  }

  static async handleLanguageSelection(from, message, session) {
    let language = 'en';
    
    if (message.toLowerCase().includes('hindi') || message.toLowerCase().includes('हिंदी') || message === '2') {
      language = 'hi';
    }

    SessionManager.updateSession(from, { 
      language: language,
      state: 'MAIN_MENU'
    });

    await WhatsAppAPI.sendTextMessage(from, MESSAGES[language].main_menu);
  }

  static async handleMainMenu(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    if (message === '1' || message.toLowerCase().includes('apply')) {
      // Send web form link instead of text-based form
      const formUrl = `https://birth-certificate-bot.onrender.com/form/birth-certificate?phone=${from}`;
      
      const formMessage = lang === 'hi'
        ? `📝 *जन्म प्रमाण पत्र आवेदन*

कृपया नीचे दिए गए लिंक पर क्लिक करें और फॉर्म भरें:

${formUrl}

📱 फॉर्म आपके ब्राउज़र में खुलेगा
✅ सभी आवश्यक जानकारी भरें
🔒 आपका डेटा सुरक्षित है

फॉर्म जमा करने के बाद आपको WhatsApp पर पुष्टि मिलेगी।`
        : `📝 *Birth Certificate Application*

Please click the link below to fill the application form:

${formUrl}

📱 Form will open in your browser
✅ Fill all required information
🔒 Your data is secure

You'll receive confirmation on WhatsApp after submitting.`;

      await WhatsAppAPI.sendTextMessage(from, formMessage);
      
      SessionManager.updateSession(from, { state: 'WAITING_FOR_FORM' });
    } else if (message === '2' || message.toLowerCase().includes('status')) {
      await WhatsAppAPI.sendTextMessage(
        from,
        lang === 'hi'
          ? '🔍 स्थिति जांच सुविधा जल्द आ रही है!'
          : '🔍 Status check feature coming soon!'
      );
    } else if (message === '3' || message.toLowerCase().includes('download')) {
      await WhatsAppAPI.sendTextMessage(
        from,
        lang === 'hi'
          ? '📥 डाउनलोड सुविधा जल्द आ रही है!'
          : '📥 Download feature coming soon!'
      );
    } else if (message === '4' || message.toLowerCase().includes('help')) {
      await WhatsAppAPI.sendTextMessage(from, messages.help);
    } else {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
      await WhatsAppAPI.sendTextMessage(from, messages.main_menu);
    }
  }

  static async handleChildName(from, message, session) {
    const lang = session.language;
    session.data.childName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_DOB',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_dob);
  }

  static async handleDOB(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    // Basic date validation
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(message)) {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
      await WhatsAppAPI.sendTextMessage(from, messages.ask_dob);
      return;
    }

    session.data.dob = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_GENDER',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, messages.ask_gender);
  }

  static async handleGender(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    let gender;
    if (message === '1' || message.toLowerCase().includes('male') || message.toLowerCase().includes('पुरुष')) {
      gender = lang === 'hi' ? 'पुरुष' : 'Male';
    } else if (message === '2' || message.toLowerCase().includes('female') || message.toLowerCase().includes('महिला')) {
      gender = lang === 'hi' ? 'महिला' : 'Female';
    } else if (message === '3' || message.toLowerCase().includes('other') || message.toLowerCase().includes('अन्य')) {
      gender = lang === 'hi' ? 'अन्य' : 'Other';
    } else {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
      await WhatsAppAPI.sendTextMessage(from, messages.ask_gender);
      return;
    }

    session.data.gender = gender;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_FATHER_NAME',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, messages.ask_father_name);
  }

  static async handleFatherName(from, message, session) {
    const lang = session.language;
    session.data.fatherName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_MOTHER_NAME',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_mother_name);
  }

  static async handleMotherName(from, message, session) {
    const lang = session.language;
    session.data.motherName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_PLACE_OF_BIRTH',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_place_of_birth);
  }

  static async handlePlaceOfBirth(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    let place;
    if (message === '1' || message.toLowerCase().includes('hospital') || message.toLowerCase().includes('अस्पताल')) {
      place = lang === 'hi' ? 'अस्पताल' : 'Hospital';
      session.data.placeOfBirth = place;
      SessionManager.updateSession(from, { 
        state: 'COLLECT_HOSPITAL_NAME',
        data: session.data
      });
      await WhatsAppAPI.sendTextMessage(from, messages.ask_hospital_name);
    } else if (message === '2' || message.toLowerCase().includes('home') || message.toLowerCase().includes('घर')) {
      place = lang === 'hi' ? 'घर' : 'Home';
      session.data.placeOfBirth = place;
      SessionManager.updateSession(from, { 
        state: 'COLLECT_ADDRESS',
        data: session.data
      });
      await WhatsAppAPI.sendTextMessage(from, messages.ask_address);
    } else if (message === '3' || message.toLowerCase().includes('other') || message.toLowerCase().includes('अन्य')) {
      place = lang === 'hi' ? 'अन्य' : 'Other';
      session.data.placeOfBirth = place;
      SessionManager.updateSession(from, { 
        state: 'COLLECT_ADDRESS',
        data: session.data
      });
      await WhatsAppAPI.sendTextMessage(from, messages.ask_address);
    } else {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
      await WhatsAppAPI.sendTextMessage(from, messages.ask_place_of_birth);
    }
  }

  static async handleHospitalName(from, message, session) {
    const lang = session.language;
    session.data.hospitalName = message;
    session.data.placeOfBirth += ` - ${message}`;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_ADDRESS',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_address);
  }

  static async handleAddress(from, message, session) {
    const lang = session.language;
    session.data.address = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_MOBILE',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_mobile);
  }

  static async handleMobile(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    // Basic mobile validation (10 digits)
    const mobileRegex = /^[6-9]\d{9}$/;
    const cleanMobile = message.replace(/\D/g, '');
    
    if (!mobileRegex.test(cleanMobile)) {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
      await WhatsAppAPI.sendTextMessage(from, messages.ask_mobile);
      return;
    }

    session.data.mobile = cleanMobile;
    SessionManager.updateSession(from, { 
      state: 'CONFIRM_DETAILS',
      data: session.data
    });

    // Show confirmation
    const confirmMsg = messages.confirm_details
      .replace('{childName}', session.data.childName)
      .replace('{dob}', session.data.dob)
      .replace('{gender}', session.data.gender)
      .replace('{fatherName}', session.data.fatherName)
      .replace('{motherName}', session.data.motherName)
      .replace('{placeOfBirth}', session.data.placeOfBirth)
      .replace('{address}', session.data.address)
      .replace('{mobile}', session.data.mobile);

    await WhatsAppAPI.sendTextMessage(from, confirmMsg);
  }

  static async handleConfirmation(from, message, session) {
    const lang = session.language;
    const messages = MESSAGES[lang];

    if (message === '1' || message.toLowerCase().includes('yes') || message.toLowerCase().includes('हां')) {
      // Generate application ID
      const applicationId = `BC${Date.now()}`;
      
      // Save application
      applications.set(applicationId, {
        id: applicationId,
        userId: from,
        data: session.data,
        status: 'submitted',
        submittedAt: new Date().toISOString()
      });

      // Send confirmation
      const confirmMsg = messages.application_submitted
        .replace('{applicationId}', applicationId);
      
      await WhatsAppAPI.sendTextMessage(from, confirmMsg);

      // Reset to main menu
      SessionManager.updateSession(from, { 
        state: 'MAIN_MENU',
        data: {}
      });

      console.log('Application submitted:', applications.get(applicationId));

    } else if (message === '2' || message.toLowerCase().includes('no') || message.toLowerCase().includes('नहीं')) {
      SessionManager.resetSession(from);
      await WhatsAppAPI.sendTextMessage(
        from,
        lang === 'hi'
          ? '🔄 आवेदन रद्द कर दिया गया। फिर से शुरू करने के लिए MENU टाइप करें।'
          : '🔄 Application cancelled. Type MENU to start over.'
      );
    } else {
      await WhatsAppAPI.sendTextMessage(from, messages.invalid_input);
    }
  }
}

// =============================================================================
// FORM ENDPOINTS
// =============================================================================

// Serve the birth certificate form
app.get('/form/birth-certificate', (req, res) => {
  res.sendFile(__dirname + '/birth-certificate-form.html');
});

// API endpoint to handle form submissions
app.post('/api/submit-application', express.json(), async (req, res) => {
  try {
    const formData = req.body;
    const phoneNumber = formData.phoneNumber;
    
    // Generate application ID
    const applicationId = `BC${Date.now()}`;
    
    // Save application
    applications.set(applicationId, {
      id: applicationId,
      userId: phoneNumber,
      data: formData,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    });

    console.log('✅ Application submitted via form:', applicationId);

    // Send confirmation message to WhatsApp
    if (phoneNumber && phoneNumber !== 'unknown') {
      const confirmationMsg = `🎉 *Application Submitted Successfully!*

Your application ID: *${applicationId}*

✅ Birth certificate application received
📧 Confirmation details:
   Child: ${formData.childName}
   DOB: ${formData.dob}
   District: ${formData.district}

⏱️ Processing time: 7-10 working days

Type *MENU* to return to main menu.`;

      await WhatsAppAPI.sendTextMessage(phoneNumber, confirmationMsg);
    }

    res.json({
      success: true,
      applicationId: applicationId,
      message: 'Application submitted successfully'
    });

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application. Please try again.'
    });
  }
});

// =============================================================================
// WEBHOOK ENDPOINTS
// =============================================================================

// Webhook verification (required by Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook for receiving messages
app.post('/webhook', async (req, res) => {
  try {
    // Quick response to Meta
    res.sendStatus(200);

    const body = req.body;

    // Verify webhook signature (security) - TEMPORARILY DISABLED FOR TESTING
    // const signature = req.headers['x-hub-signature-256'];
    // if (signature) {
    //   const expectedSignature = crypto
    //     .createHmac('sha256', CONFIG.WHATSAPP_TOKEN)
    //     .update(JSON.stringify(body))
    //     .digest('hex');
    //   
    //   if (`sha256=${expectedSignature}` !== signature) {
    //     console.error('Invalid webhook signature');
    //     return;
    //   }
    // }

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const message = change.value.messages?.[0];
            
            if (message && message.type === 'text') {
              const from = message.from;
              const messageText = message.text.body;

              console.log(`📩 Received message from ${from}: ${messageText}`);

              // Process message
              await MessageHandler.handle(from, messageText);
            } else if (message && message.type === 'interactive') {
              const from = message.from;
              const buttonReply = message.interactive.button_reply?.id || 
                                 message.interactive.list_reply?.id;

              console.log(`📩 Received button click from ${from}: ${buttonReply}`);

              // Handle button clicks
              if (buttonReply === 'lang_en') {
                await MessageHandler.handleLanguageSelection(from, 'english', SessionManager.getSession(from));
              } else if (buttonReply === 'lang_hi') {
                await MessageHandler.handleLanguageSelection(from, 'hindi', SessionManager.getSession(from));
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sessions: userSessions.size,
    applications: applications.size
  });
});

// Get all applications (admin endpoint)
app.get('/applications', (req, res) => {
  res.json({
    total: applications.size,
    applications: Array.from(applications.values())
  });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(CONFIG.PORT, () => {
  console.log('🚀 Birth Certificate Bot is running!');
  console.log(`📡 Server listening on port ${CONFIG.PORT}`);
  console.log(`🔗 Webhook URL: https://your-domain.com/webhook`);
  console.log(`✅ Ready to receive messages!`);
  
  if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_ID) {
    console.warn('⚠️ WARNING: WhatsApp credentials not set in environment variables');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});
