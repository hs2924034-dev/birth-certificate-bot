/**
 * WhatsApp Birth Certificate Bot V2 - UPGRADED
 * Professional UI with Interactive Lists & Buttons
 * HP Government e-Services
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

// In-memory storage
const userSessions = new Map();
const applications = new Map();

// =============================================================================
// WHATSAPP API HELPER - UPGRADED
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

  static async sendInteractiveButtons(to, bodyText, buttons, headerText = null, footerText = null) {
    const message = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn, idx) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${idx}`,
              title: btn.title.substring(0, 20) // Max 20 chars
            }
          }))
        }
      }
    };

    if (headerText) {
      message.interactive.header = {
        type: 'text',
        text: headerText
      };
    }

    if (footerText) {
      message.interactive.footer = {
        text: footerText
      };
    }

    return this.sendMessage(to, message);
  }

  static async sendInteractiveList(to, bodyText, buttonText, sections, headerText = null, footerText = null) {
    const message = {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };

    if (headerText) {
      message.interactive.header = {
        type: 'text',
        text: headerText
      };
    }

    if (footerText) {
      message.interactive.footer = {
        text: footerText
      };
    }

    return this.sendMessage(to, message);
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

class SessionManager {
  static getSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        state: 'INITIAL',
        language: 'en',
        data: {},
        consentGiven: false,
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
// MESSAGE TEMPLATES - UPGRADED
// =============================================================================

const MESSAGES = {
  en: {
    welcome: `🏛️ *Welcome to HP Birth Certificate Services*

👋 Namaste! I'm your digital assistant for birth certificate applications.

*Powered by InstaGov - HP Government e-Services*

Please select your preferred language:`,

    data_consent: `📋 *DATA CONSENT REQUIRED*

To process your birth certificate application, we need to collect and process your personal information.

*We will collect:*
• Child's personal details
• Parents' information
• Contact details
• Address information

*Your data will be:*
✅ Kept confidential
✅ Used only for birth certificate processing
✅ Protected as per data protection laws

Do you consent to data collection?`,

    documents_required: `📄 *Documents Required*

To complete your birth certificate application, please keep these documents ready in digital format (image/PDF/DigiLocker):

📸 *Required Documents:*
• Hospital discharge certificate / Birth proof
• Parents' ID proof (Aadhaar/Voter ID/Driving License)
• Address proof (Aadhaar/Utility bill)
• Parents' marriage certificate (if applicable)

📝 *Optional Documents:*
• Medical records from hospital
• Declaration affidavit (if home birth)

Click below when ready:`,

    main_menu: `📋 *Main Menu*

What would you like to do?

*Available Services:*
1️⃣ Apply for New Birth Certificate
2️⃣ Check Application Status
3️⃣ Download Certificate
4️⃣ Help & Support

Please select from the menu below:`,

    start_application: `📝 *New Birth Certificate Application*

*Application Process:*
Step 1️⃣ Personal Details
Step 2️⃣ Parents Information
Step 3️⃣ Birth Details
Step 4️⃣ Verification & Submit

⏱️ Estimated time: 5 minutes
📋 Processing time: 7-10 working days

Let's begin!

*Please enter the FULL NAME of the child:*

(Example: Rahul Kumar Sharma)`,

    ask_dob: `📅 *Date of Birth*

Please enter the child's date of birth:

*Format:* DD/MM/YYYY
*Example:* 15/01/2024

⚠️ Make sure the date is correct as per hospital records.`,

    ask_gender: `👶 *Gender Selection*

Please select the gender of the child from the list below:`,

    ask_father_name: `👨 *Father's Information*

Please enter the *father's full name*:

(Example: Rajesh Kumar Sharma)`,

    ask_mother_name: `👩 *Mother's Information*

Please enter the *mother's full name*:

(Example: Priya Sharma)`,

    ask_place_of_birth: `🏥 *Place of Birth*

Where was the child born?

Please select from the options below:`,

    ask_hospital_name: `🏥 *Hospital Details*

Please enter the *complete name of the hospital*:

(Example: IGMC Hospital, Shimla)`,

    ask_address: `🏠 *Residential Address*

Please enter your *complete residential address*:

*Include:*
• House/Flat Number
• Street/Area Name
• Locality
• City/Town
• District
• PIN Code

*Example:*
House No. 123, Green Park Colony
Near City Mall, Shimla
District: Shimla, HP - 171001`,

    ask_mobile: `📱 *Mobile Number*

Please enter your *10-digit mobile number*:

This number will be used for:
✅ Application updates
✅ OTP verification
✅ Certificate delivery notification

*Example:* 9876543210

⚠️ Make sure the number is active.`,

    confirm_details: `✅ *VERIFY YOUR DETAILS*

Please review the information carefully:

┌─────────────────────────────
│ 👶 *CHILD DETAILS*
├─────────────────────────────
│ Name: {childName}
│ DOB: {dob}
│ Gender: {gender}
├─────────────────────────────
│ 👨👩 *PARENTS DETAILS*
├─────────────────────────────
│ Father: {fatherName}
│ Mother: {motherName}
├─────────────────────────────
│ 🏥 *BIRTH DETAILS*
├─────────────────────────────
│ Place: {placeOfBirth}
├─────────────────────────────
│ 🏠 *CONTACT DETAILS*
├─────────────────────────────
│ Address: {address}
│ Mobile: {mobile}
└─────────────────────────────

⚠️ *Important:* Details cannot be changed after submission.

Is all information correct?`,

    application_submitted: `🎉 *APPLICATION SUBMITTED SUCCESSFULLY!*

┌─────────────────────────────
│ 📋 *APPLICATION DETAILS*
├─────────────────────────────
│ Application ID: *{applicationId}*
│ Date: {date}
│ Status: ✅ Submitted
├─────────────────────────────
│ 📧 *CONFIRMATION*
├─────────────────────────────
│ SMS sent to: {mobile}
│ Confirmation email sent
└─────────────────────────────

⏱️ *Processing Time:* 7-10 working days

📱 *Track Status:*
You can check application status anytime by selecting "Check Status" from main menu.

📄 *Next Steps:*
• Verification by department
• Document verification
• Certificate generation
• SMS notification on completion

💡 *Note:* Save your Application ID: *{applicationId}*

Type *MENU* to return to main menu.`,

    invalid_input: `❌ *Invalid Input*

Please enter the information in the correct format.

Need help? Type *HELP* for assistance.`,

    help: `ℹ️ *Help & Support*

*📝 How to Apply:*
1. Select language preference
2. Give data consent
3. Choose "Apply for Certificate"
4. Fill all required details
5. Review and submit

*⏱️ Processing Time:*
7-10 working days from submission

*📞 Customer Support:*
🕐 Mon-Fri: 9:00 AM - 5:00 PM
📞 Helpline: 1800-XXX-XXXX
📧 Email: support@hpgov.in

*🌐 Portal:*
Visit: https://eseva.hp.gov.in

Type *MENU* to return to main menu.`
  },
  
  hi: {
    welcome: `🏛️ *हिमाचल प्रदेश जन्म प्रमाण पत्र सेवा में आपका स्वागत है*

👋 नमस्ते! मैं जन्म प्रमाण पत्र आवेदन के लिए आपका डिजिटल सहायक हूं।

*InstaGov द्वारा संचालित - HP सरकार ई-सेवाएं*

कृपया अपनी पसंदीदा भाषा चुनें:`,

    data_consent: `📋 *डेटा सहमति आवश्यक*

आपके जन्म प्रमाण पत्र आवेदन को संसाधित करने के लिए, हमें आपकी व्यक्तिगत जानकारी एकत्र करनी होगी।

*हम एकत्र करेंगे:*
• बच्चे का व्यक्तिगत विवरण
• माता-पिता की जानकारी
• संपर्क विवरण
• पता जानकारी

*आपका डेटा होगा:*
✅ गोपनीय रखा जाएगा
✅ केवल जन्म प्रमाण पत्र के लिए उपयोग किया जाएगा
✅ डेटा सुरक्षा कानूनों के अनुसार सुरक्षित

क्या आप डेटा संग्रह के लिए सहमत हैं?`,

    documents_required: `📄 *आवश्यक दस्तावेज*

अपना जन्म प्रमाण पत्र आवेदन पूरा करने के लिए, कृपया ये दस्तावेज डिजिटल प्रारूप में तैयार रखें:

📸 *आवश्यक दस्तावेज:*
• अस्पताल डिस्चार्ज प्रमाण पत्र / जन्म प्रमाण
• माता-पिता का ID प्रमाण (आधार/वोटर ID)
• पता प्रमाण (आधार/उपयोगिता बिल)
• माता-पिता का विवाह प्रमाण पत्र (यदि लागू हो)

तैयार होने पर नीचे क्लिक करें:`,

    main_menu: `📋 *मुख्य मेनू*

आप क्या करना चाहेंगे?

*उपलब्ध सेवाएं:*
1️⃣ नया जन्म प्रमाण पत्र के लिए आवेदन करें
2️⃣ आवेदन की स्थिति जांचें
3️⃣ प्रमाण पत्र डाउनलोड करें
4️⃣ सहायता और समर्थन

कृपया नीचे दिए गए मेनू से चुनें:`,

    start_application: `📝 *नया जन्म प्रमाण पत्र आवेदन*

*आवेदन प्रक्रिया:*
चरण 1️⃣ व्यक्तिगत विवरण
चरण 2️⃣ माता-पिता की जानकारी
चरण 3️⃣ जन्म विवरण
चरण 4️⃣ सत्यापन और सबमिट

⏱️ अनुमानित समय: 5 मिनट
📋 प्रसंस्करण समय: 7-10 कार्य दिवस

आइए शुरू करें!

*कृपया बच्चे का पूरा नाम दर्ज करें:*

(उदाहरण: राहुल कुमार शर्मा)`,

    ask_dob: `📅 *जन्म तिथि*

कृपया बच्चे की जन्म तिथि दर्ज करें:

*प्रारूप:* DD/MM/YYYY
*उदाहरण:* 15/01/2024

⚠️ सुनिश्चित करें कि तिथि अस्पताल रिकॉर्ड के अनुसार सही है।`,

    ask_gender: `👶 *लिंग चयन*

कृपया नीचे दी गई सूची से बच्चे का लिंग चुनें:`,

    ask_father_name: `👨 *पिता की जानकारी*

कृपया *पिता का पूरा नाम* दर्ज करें:

(उदाहरण: राजेश कुमार शर्मा)`,

    ask_mother_name: `👩 *माता की जानकारी*

कृपया *माता का पूरा नाम* दर्ज करें:

(उदाहरण: प्रिया शर्मा)`,

    ask_place_of_birth: `🏥 *जन्म स्थान*

बच्चे का जन्म कहाँ हुआ था?

कृपया नीचे दिए गए विकल्पों में से चुनें:`,

    ask_hospital_name: `🏥 *अस्पताल विवरण*

कृपया *अस्पताल का पूरा नाम* दर्ज करें:

(उदाहरण: IGMC अस्पताल, शिमला)`,

    ask_address: `🏠 *आवासीय पता*

कृपया अपना *पूरा आवासीय पता* दर्ज करें:

*शामिल करें:*
• मकान/फ्लैट नंबर
• गली/क्षेत्र का नाम
• इलाका
• शहर
• जिला
• पिन कोड

*उदाहरण:*
मकान नंबर 123, ग्रीन पार्क कॉलोनी
सिटी मॉल के पास, शिमला
जिला: शिमला, HP - 171001`,

    ask_mobile: `📱 *मोबाइल नंबर*

कृपया अपना *10 अंकों का मोबाइल नंबर* दर्ज करें:

इस नंबर का उपयोग किया जाएगा:
✅ आवेदन अपडेट के लिए
✅ OTP सत्यापन के लिए
✅ प्रमाण पत्र वितरण सूचना

*उदाहरण:* 9876543210

⚠️ सुनिश्चित करें कि नंबर सक्रिय है।`,

    confirm_details: `✅ *अपने विवरण सत्यापित करें*

कृपया जानकारी की ध्यानपूर्वक समीक्षा करें:

┌─────────────────────────────
│ 👶 *बच्चे का विवरण*
├─────────────────────────────
│ नाम: {childName}
│ जन्मतिथि: {dob}
│ लिंग: {gender}
├─────────────────────────────
│ 👨👩 *माता-पिता का विवरण*
├─────────────────────────────
│ पिता: {fatherName}
│ माता: {motherName}
├─────────────────────────────
│ 🏥 *जन्म विवरण*
├─────────────────────────────
│ स्थान: {placeOfBirth}
├─────────────────────────────
│ 🏠 *संपर्क विवरण*
├─────────────────────────────
│ पता: {address}
│ मोबाइल: {mobile}
└─────────────────────────────

⚠️ *महत्वपूर्ण:* सबमिशन के बाद विवरण नहीं बदला जा सकता।

क्या सभी जानकारी सही है?`,

    application_submitted: `🎉 *आवेदन सफलतापूर्वक जमा किया गया!*

┌─────────────────────────────
│ 📋 *आवेदन विवरण*
├─────────────────────────────
│ आवेदन ID: *{applicationId}*
│ तिथि: {date}
│ स्थिति: ✅ जमा किया गया
├─────────────────────────────
│ 📧 *पुष्टि*
├─────────────────────────────
│ SMS भेजा गया: {mobile}
│ पुष्टि ईमेल भेजा गया
└─────────────────────────────

⏱️ *प्रसंस्करण समय:* 7-10 कार्य दिवस

📱 *स्थिति ट्रैक करें:*
आप मुख्य मेनू से "स्थिति जांचें" चुनकर किसी भी समय आवेदन स्थिति जांच सकते हैं।

💡 *नोट:* अपना आवेदन ID सहेजें: *{applicationId}*

मुख्य मेनू पर वापस जाने के लिए *MENU* टाइप करें।`,

    invalid_input: `❌ *अमान्य इनपुट*

कृपया सही प्रारूप में जानकारी दर्ज करें।

सहायता चाहिए? सहायता के लिए *HELP* टाइप करें।`,

    help: `ℹ️ *सहायता और समर्थन*

*📝 आवेदन कैसे करें:*
1. भाषा प्राथमिकता चुनें
2. डेटा सहमति दें
3. "प्रमाण पत्र के लिए आवेदन करें" चुनें
4. सभी आवश्यक विवरण भरें
5. समीक्षा करें और जमा करें

*⏱️ प्रसंस्करण समय:*
जमा करने से 7-10 कार्य दिवस

*📞 ग्राहक सहायता:*
🕐 सोम-शुक्र: 9:00 AM - 5:00 PM
📞 हेल्पलाइन: 1800-XXX-XXXX
📧 ईमेल: support@hpgov.in

मुख्य मेनू पर वापस जाने के लिए *MENU* टाइप करें।`
  }
};

// =============================================================================
// MESSAGE HANDLER - UPGRADED
// =============================================================================

class MessageHandler {
  static async handle(from, message, messageType = 'text') {
    const session = SessionManager.getSession(from);
    const lang = session.language;
    const messages = MESSAGES[lang];

    console.log(`Processing from ${from}, State: ${session.state}, Type: ${messageType}`);

    try {
      // Handle button/list responses
      if (messageType === 'interactive') {
        return await this.handleInteractive(from, message, session);
      }

      // Handle text messages
      const messageText = message.toLowerCase().trim();

      // Global commands
      if (messageText === 'menu') {
        return await this.showMainMenu(from, session);
      }

      if (messageText === 'help') {
        await WhatsAppAPI.sendTextMessage(from, messages.help);
        return;
      }

      // State machine
      switch (session.state) {
        case 'INITIAL':
          await this.handleInitial(from, session);
          break;

        case 'LANGUAGE_SELECTION':
          await this.handleLanguageSelection(from, message, session);
          break;

        case 'DATA_CONSENT':
          await this.handleDataConsent(from, message, session);
          break;

        case 'DOCUMENTS_INFO':
          await this.handleDocumentsInfo(from, message, session);
          break;

        case 'MAIN_MENU':
          await this.handleMainMenuSelection(from, message, session);
          break;

        case 'COLLECT_CHILD_NAME':
          await this.handleChildName(from, message, session);
          break;

        case 'COLLECT_DOB':
          await this.handleDOB(from, message, session);
          break;

        case 'COLLECT_GENDER':
          await this.handleGenderSelection(from, message, session);
          break;

        case 'COLLECT_FATHER_NAME':
          await this.handleFatherName(from, message, session);
          break;

        case 'COLLECT_MOTHER_NAME':
          await this.handleMotherName(from, message, session);
          break;

        case 'COLLECT_PLACE_OF_BIRTH':
          await this.handlePlaceSelection(from, message, session);
          break;

        case 'COLLECT_HOSPITAL_NAME':
          await this.handleHospitalName(from, message, session);
          break;

        case 'COLLECT_ADDRESS':
          await this.handleAddress(from, message, session);
          break;

        case 'COLLECT_MOBILE':
          await this.handleMobile(from, message, session);
          break;

        case 'CONFIRM_DETAILS':
          await this.handleConfirmation(from, message, session);
          break;

        default:
          await this.handleInitial(from, session);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      await WhatsAppAPI.sendTextMessage(
        from,
        lang === 'hi'
          ? '❌ कुछ गलत हो गया। कृपया पुनः प्रयास करें या HELP टाइप करें।'
          : '❌ Something went wrong. Please try again or type HELP.'
      );
    }
  }

  static async handleInteractive(from, interactiveData, session) {
    const buttonId = interactiveData.button_reply?.id || interactiveData.list_reply?.id;
    
    console.log(`Interactive response: ${buttonId}`);

    // Map button/list IDs to actions
    if (buttonId === 'lang_en' || buttonId === 'lang_english') {
      await this.setLanguage(from, 'en', session);
    } else if (buttonId === 'lang_hi' || buttonId === 'lang_hindi') {
      await this.setLanguage(from, 'hi', session);
    } else if (buttonId === 'consent_yes') {
      await this.giveConsent(from, session);
    } else if (buttonId === 'consent_no') {
      await this.declineConsent(from, session);
    } else if (buttonId === 'docs_ready') {
      await this.showMainMenu(from, session);
    } else if (buttonId === 'menu_apply') {
      await this.startApplication(from, session);
    } else if (buttonId === 'menu_status') {
      await this.checkStatus(from, session);
    } else if (buttonId === 'menu_help') {
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].help);
    } else if (buttonId === 'gender_male' || buttonId === 'gender_female' || buttonId === 'gender_other') {
      await this.handleGenderSelection(from, buttonId, session);
    } else if (buttonId === 'place_hospital' || buttonId === 'place_home' || buttonId === 'place_other') {
      await this.handlePlaceSelection(from, buttonId, session);
    } else if (buttonId === 'confirm_yes') {
      await this.submitApplication(from, session);
    } else if (buttonId === 'confirm_no') {
      await this.cancelApplication(from, session);
    }
  }

  static async handleInitial(from, session) {
    await WhatsAppAPI.sendInteractiveButtons(
      from,
      MESSAGES.en.welcome,
      [
        { id: 'lang_english', title: '🇬🇧 English' },
        { id: 'lang_hindi', title: '🇮🇳 हिंदी' }
      ],
      '🏛️ HP Government',
      'Select language to continue'
    );
    SessionManager.updateSession(from, { state: 'LANGUAGE_SELECTION' });
  }

  static async setLanguage(from, language, session) {
    SessionManager.updateSession(from, { 
      language: language,
      state: 'DATA_CONSENT'
    });

    const messages = MESSAGES[language];

    await WhatsAppAPI.sendInteractiveButtons(
      from,
      messages.data_consent,
      [
        { id: 'consent_yes', title: language === 'hi' ? '✅ हां, सहमत हूं' : '✅ Yes, I Consent' },
        { id: 'consent_no', title: language === 'hi' ? '❌ नहीं, जारी न रखें' : '❌ No, Don\'t Continue' }
      ],
      '📋 Data Consent',
      'Your privacy is protected'
    );
  }

  static async giveConsent(from, session) {
    SessionManager.updateSession(from, { 
      consentGiven: true,
      state: 'DOCUMENTS_INFO'
    });

    const messages = MESSAGES[session.language];

    await WhatsAppAPI.sendInteractiveButtons(
      from,
      messages.documents_required,
      [
        { id: 'docs_ready', title: session.language === 'hi' ? '✅ तैयार हूं' : '✅ I\'m Ready' }
      ],
      '📄 Documents',
      'Keep documents ready before proceeding'
    );
  }

  static async declineConsent(from, session) {
    const lang = session.language;
    await WhatsAppAPI.sendTextMessage(
      from,
      lang === 'hi'
        ? '❌ आवेदन रद्द कर दिया गया। डेटा सहमति के बिना हम आगे नहीं बढ़ सकते। यदि आप बदलते हैं तो कभी भी वापस आएं।'
        : '❌ Application cancelled. We cannot proceed without data consent. Feel free to return anytime if you change your mind.'
    );
    SessionManager.resetSession(from);
  }

  static async showMainMenu(from, session) {
    SessionManager.updateSession(from, { state: 'MAIN_MENU' });
    const messages = MESSAGES[session.language];

    await WhatsAppAPI.sendInteractiveList(
      from,
      messages.main_menu,
      session.language === 'hi' ? 'सेवा चुनें' : 'Select Service',
      [
        {
          title: session.language === 'hi' ? '📋 सेवाएं' : '📋 Services',
          rows: [
            {
              id: 'menu_apply',
              title: session.language === 'hi' ? '📝 नया आवेदन' : '📝 New Application',
              description: session.language === 'hi' ? 'जन्म प्रमाण पत्र के लिए आवेदन करें' : 'Apply for birth certificate'
            },
            {
              id: 'menu_status',
              title: session.language === 'hi' ? '🔍 स्थिति जांचें' : '🔍 Check Status',
              description: session.language === 'hi' ? 'आवेदन की स्थिति देखें' : 'View application status'
            },
            {
              id: 'menu_help',
              title: session.language === 'hi' ? 'ℹ️ सहायता' : 'ℹ️ Help',
              description: session.language === 'hi' ? 'सहायता और समर्थन प्राप्त करें' : 'Get help and support'
            }
          ]
        }
      ],
      '🏛️ HP e-Services',
      'Powered by InstaGov'
    );
  }

  static async startApplication(from, session) {
    SessionManager.updateSession(from, { 
      state: 'COLLECT_CHILD_NAME',
      data: {}
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].start_application);
  }

  static async checkStatus(from, session) {
    await WhatsAppAPI.sendTextMessage(
      from,
      session.language === 'hi'
        ? '🔍 स्थिति जांच सुविधा जल्द आ रही है!\n\nकृपया अपना आवेदन ID भेजें।'
        : '🔍 Status check feature coming soon!\n\nPlease send your Application ID.'
    );
  }

  static async handleChildName(from, message, session) {
    session.data.childName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_DOB',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_dob);
  }

  static async handleDOB(from, message, session) {
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(message)) {
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].invalid_input);
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_dob);
      return;
    }

    session.data.dob = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_GENDER',
      data: session.data
    });

    const lang = session.language;
    await WhatsAppAPI.sendInteractiveList(
      from,
      MESSAGES[lang].ask_gender,
      lang === 'hi' ? 'लिंग चुनें' : 'Select Gender',
      [
        {
          title: lang === 'hi' ? '👶 लिंग' : '👶 Gender',
          rows: [
            {
              id: 'gender_male',
              title: lang === 'hi' ? '👦 पुरुष' : '👦 Male',
              description: ''
            },
            {
              id: 'gender_female',
              title: lang === 'hi' ? '👧 महिला' : '👧 Female',
              description: ''
            },
            {
              id: 'gender_other',
              title: lang === 'hi' ? '👶 अन्य' : '👶 Other',
              description: ''
            }
          ]
        }
      ],
      '👶 Child Details'
    );
  }

  static async handleGenderSelection(from, genderId, session) {
    const lang = session.language;
    let gender;

    if (genderId.includes('male') && !genderId.includes('female')) {
      gender = lang === 'hi' ? 'पुरुष' : 'Male';
    } else if (genderId.includes('female')) {
      gender = lang === 'hi' ? 'महिला' : 'Female';
    } else {
      gender = lang === 'hi' ? 'अन्य' : 'Other';
    }

    session.data.gender = gender;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_FATHER_NAME',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_father_name);
  }

  static async handleFatherName(from, message, session) {
    session.data.fatherName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_MOTHER_NAME',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_mother_name);
  }

  static async handleMotherName(from, message, session) {
    session.data.motherName = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_PLACE_OF_BIRTH',
      data: session.data
    });

    const lang = session.language;
    await WhatsAppAPI.sendInteractiveList(
      from,
      MESSAGES[lang].ask_place_of_birth,
      lang === 'hi' ? 'स्थान चुनें' : 'Select Place',
      [
        {
          title: lang === 'hi' ? '🏥 जन्म स्थान' : '🏥 Birth Place',
          rows: [
            {
              id: 'place_hospital',
              title: lang === 'hi' ? '🏥 अस्पताल' : '🏥 Hospital',
              description: lang === 'hi' ? 'अस्पताल में जन्म' : 'Born in hospital'
            },
            {
              id: 'place_home',
              title: lang === 'hi' ? '🏠 घर' : '🏠 Home',
              description: lang === 'hi' ? 'घर पर जन्म' : 'Born at home'
            },
            {
              id: 'place_other',
              title: lang === 'hi' ? '📍 अन्य' : '📍 Other',
              description: lang === 'hi' ? 'अन्य स्थान' : 'Other location'
            }
          ]
        }
      ],
      '🏥 Birth Location'
    );
  }

  static async handlePlaceSelection(from, placeId, session) {
    const lang = session.language;
    let place;

    if (placeId.includes('hospital')) {
      place = lang === 'hi' ? 'अस्पताल' : 'Hospital';
      session.data.placeOfBirth = place;
      SessionManager.updateSession(from, { 
        state: 'COLLECT_HOSPITAL_NAME',
        data: session.data
      });
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_hospital_name);
    } else {
      place = placeId.includes('home') 
        ? (lang === 'hi' ? 'घर' : 'Home')
        : (lang === 'hi' ? 'अन्य' : 'Other');
      
      session.data.placeOfBirth = place;
      SessionManager.updateSession(from, { 
        state: 'COLLECT_ADDRESS',
        data: session.data
      });
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[lang].ask_address);
    }
  }

  static async handleHospitalName(from, message, session) {
    session.data.hospitalName = message;
    session.data.placeOfBirth += ` - ${message}`;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_ADDRESS',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_address);
  }

  static async handleAddress(from, message, session) {
    session.data.address = message;
    SessionManager.updateSession(from, { 
      state: 'COLLECT_MOBILE',
      data: session.data
    });
    await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_mobile);
  }

  static async handleMobile(from, message, session) {
    const mobileRegex = /^[6-9]\d{9}$/;
    const cleanMobile = message.replace(/\D/g, '');
    
    if (!mobileRegex.test(cleanMobile)) {
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].invalid_input);
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].ask_mobile);
      return;
    }

    session.data.mobile = cleanMobile;
    SessionManager.updateSession(from, { 
      state: 'CONFIRM_DETAILS',
      data: session.data
    });

    const lang = session.language;
    const confirmMsg = MESSAGES[lang].confirm_details
      .replace('{childName}', session.data.childName)
      .replace('{dob}', session.data.dob)
      .replace('{gender}', session.data.gender)
      .replace('{fatherName}', session.data.fatherName)
      .replace('{motherName}', session.data.motherName)
      .replace('{placeOfBirth}', session.data.placeOfBirth)
      .replace('{address}', session.data.address)
      .replace('{mobile}', session.data.mobile);

    await WhatsAppAPI.sendInteractiveButtons(
      from,
      confirmMsg,
      [
        { id: 'confirm_yes', title: lang === 'hi' ? '✅ हां, सबमिट करें' : '✅ Yes, Submit' },
        { id: 'confirm_no', title: lang === 'hi' ? '❌ नहीं, रद्द करें' : '❌ No, Cancel' }
      ],
      '✅ Final Verification',
      'Review carefully before submitting'
    );
  }

  static async submitApplication(from, session) {
    const applicationId = `BC${Date.now()}`;
    const date = new Date().toLocaleDateString('en-IN');
    
    applications.set(applicationId, {
      id: applicationId,
      userId: from,
      data: session.data,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    });

    const lang = session.language;
    const confirmMsg = MESSAGES[lang].application_submitted
      .replace(/{applicationId}/g, applicationId)
      .replace('{date}', date)
      .replace('{mobile}', session.data.mobile);
    
    await WhatsAppAPI.sendTextMessage(from, confirmMsg);

    SessionManager.updateSession(from, { 
      state: 'MAIN_MENU',
      data: {}
    });

    console.log('Application submitted:', applications.get(applicationId));
  }

  static async cancelApplication(from, session) {
    SessionManager.resetSession(from);
    const lang = session.language;
    await WhatsAppAPI.sendTextMessage(
      from,
      lang === 'hi'
        ? '🔄 आवेदन रद्द कर दिया गया। फिर से शुरू करने के लिए MENU टाइप करें।'
        : '🔄 Application cancelled. Type MENU to start over.'
    );
  }

  static async handleMainMenuSelection(from, message, session) {
    if (message === '1' || message.toLowerCase().includes('apply')) {
      await this.startApplication(from, session);
    } else if (message === '2' || message.toLowerCase().includes('status')) {
      await this.checkStatus(from, session);
    } else {
      await WhatsAppAPI.sendTextMessage(from, MESSAGES[session.language].help);
    }
  }
}

// =============================================================================
// WEBHOOK ENDPOINTS
// =============================================================================

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

app.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const message = change.value.messages?.[0];
            
            if (!message) continue;

            const from = message.from;

            if (message.type === 'text') {
              const messageText = message.text.body;
              console.log(`📩 Text from ${from}: ${messageText}`);
              await MessageHandler.handle(from, messageText, 'text');
            } else if (message.type === 'interactive') {
              const interactive = message.interactive;
              console.log(`📩 Interactive from ${from}:`, interactive);
              await MessageHandler.handle(from, interactive, 'interactive');
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '2.0 - Professional Edition',
    timestamp: new Date().toISOString(),
    sessions: userSessions.size,
    applications: applications.size
  });
});

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
  console.log('🚀 Birth Certificate Bot V2 is running!');
  console.log('🎨 Professional Edition with Interactive UI');
  console.log(`📡 Server listening on port ${CONFIG.PORT}`);
  console.log(`🔗 Webhook URL: https://your-domain.com/webhook`);
  console.log(`✅ Ready to receive messages!`);
  
  if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_ID) {
    console.warn('⚠️ WARNING: WhatsApp credentials not set');
  }
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});
