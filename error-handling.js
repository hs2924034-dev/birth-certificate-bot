/**
 * WhatsApp Government Services Bot - Error Handling System
 * For InstaGov (Himachal Pradesh e-Services)
 * Using Meta WhatsApp Business API
 */

// ============================================================================
// 1. ERROR CLASSES - Custom error types for different scenarios
// ============================================================================

class WhatsAppBotError extends Error {
  constructor(message, code, userMessage = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.userMessage = userMessage || 'Something went wrong. Please try again.';
    this.timestamp = new Date().toISOString();
  }
}

class MetaAPIError extends WhatsAppBotError {
  constructor(message, statusCode, errorData) {
    super(message, `META_API_${statusCode}`);
    this.statusCode = statusCode;
    this.errorData = errorData;
  }
}

class OTPError extends WhatsAppBotError {
  constructor(message, reason) {
    super(message, 'OTP_ERROR', 'OTP verification failed. Please try again.');
    this.reason = reason;
  }
}

class AuthenticationError extends WhatsAppBotError {
  constructor(message) {
    super(message, 'AUTH_ERROR', 'Authentication failed. Please login again.');
  }
}

class ValidationError extends WhatsAppBotError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}

// ============================================================================
// 2. ERROR HANDLER - Main error processing function
// ============================================================================

class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.errorCounts = new Map(); // Track error frequencies
    this.userRetryCount = new Map(); // Track user retry attempts
  }

  /**
   * Main error handler - processes all errors
   */
  async handle(error, context = {}) {
    const { userId, phone, action, language = 'en' } = context;

    // Log the error
    this.logError(error, context);

    // Track error frequency
    this.trackError(error.code);

    // Get user-friendly message
    const userMessage = this.getUserMessage(error, language);

    // Determine if we should retry or fail
    const shouldRetry = this.shouldRetry(error, userId);

    return {
      success: false,
      error: {
        code: error.code,
        message: userMessage,
        canRetry: shouldRetry,
        timestamp: error.timestamp
      }
    };
  }

  /**
   * Log errors with context
   */
  logError(error, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context,
      severity: this.getSeverity(error)
    };

    // Log to appropriate channel based on severity
    if (logEntry.severity === 'critical') {
      this.logger.error('[CRITICAL]', logEntry);
      this.alertTeam(logEntry); // Send alert to team
    } else if (logEntry.severity === 'high') {
      this.logger.error('[HIGH]', logEntry);
    } else {
      this.logger.warn('[MEDIUM]', logEntry);
    }
  }

  /**
   * Get severity level for error
   */
  getSeverity(error) {
    if (error instanceof MetaAPIError && error.statusCode >= 500) {
      return 'critical';
    }
    if (error instanceof AuthenticationError) {
      return 'high';
    }
    if (error instanceof OTPError) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get user-friendly message based on error and language
   */
  getUserMessage(error, language) {
    const messages = {
      en: {
        META_API_429: '⏳ Too many requests. Please wait a moment and try again.',
        META_API_500: '⚠️ Service temporarily unavailable. We\'re working on it!',
        META_API_401: '🔒 Session expired. Please start over by typing "Hi"',
        OTP_ERROR: '❌ Invalid OTP. Please check and enter the correct code.',
        OTP_EXPIRED: '⏰ OTP expired. Click "Get OTP" to receive a new code.',
        AUTH_ERROR: '🔐 Login failed. Please check your mobile number.',
        VALIDATION_ERROR: '⚠️ Invalid input. Please check your information.',
        NETWORK_ERROR: '📡 Connection issue. Please check your internet and try again.',
        DEFAULT: '❌ Something went wrong. Please try again or type "Help"'
      },
      hi: {
        META_API_429: '⏳ बहुत सारे अनुरोध। कृपया थोड़ी देर प्रतीक्षा करें।',
        META_API_500: '⚠️ सेवा अस्थायी रूप से अनुपलब्ध है। हम इस पर काम कर रहे हैं!',
        META_API_401: '🔒 सत्र समाप्त हो गया। कृपया "Hi" टाइप करके फिर से शुरू करें',
        OTP_ERROR: '❌ गलत OTP। कृपया सही कोड दर्ज करें।',
        OTP_EXPIRED: '⏰ OTP समाप्त हो गया। नया कोड पाने के लिए "Get OTP" पर क्लिक करें।',
        AUTH_ERROR: '🔐 लॉगिन विफल। कृपया अपना मोबाइल नंबर जांचें।',
        VALIDATION_ERROR: '⚠️ अमान्य इनपुट। कृपया अपनी जानकारी जांचें।',
        NETWORK_ERROR: '📡 कनेक्शन समस्या। कृपया अपना इंटरनेट जांचें।',
        DEFAULT: '❌ कुछ गलत हो गया। कृपया पुनः प्रयास करें या "Help" टाइप करें'
      }
    };

    const langMessages = messages[language] || messages.en;
    return langMessages[error.code] || langMessages.DEFAULT;
  }

  /**
   * Track error frequency for monitoring
   */
  trackError(errorCode) {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);

    // Alert if error frequency is too high
    if (count > 50) {
      this.logger.error(`High frequency of ${errorCode}: ${count} occurrences`);
    }
  }

  /**
   * Determine if operation should retry
   */
  shouldRetry(error, userId) {
    // Don't retry authentication or validation errors
    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      return false;
    }

    // Check user retry count
    const retryCount = this.userRetryCount.get(userId) || 0;
    if (retryCount >= 3) {
      this.userRetryCount.delete(userId);
      return false;
    }

    // Increment retry count
    this.userRetryCount.set(userId, retryCount + 1);

    // Retry for network and API errors
    return error instanceof MetaAPIError && error.statusCode >= 500;
  }

  /**
   * Alert team for critical errors
   */
  async alertTeam(logEntry) {
    // Implement your alerting mechanism here
    // Examples: Slack, email, SMS, PagerDuty, etc.
    console.error('🚨 CRITICAL ERROR ALERT:', logEntry);
  }
}

// ============================================================================
// 3. META API ERROR HANDLING - Wrapper for WhatsApp API calls
// ============================================================================

class MetaAPIHandler {
  constructor(accessToken, phoneNumberId) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.baseURL = 'https://graph.facebook.com/v18.0';
  }

  /**
   * Send message with error handling
   */
  async sendMessage(to, message, retryCount = 0) {
    try {
      const response = await fetch(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            ...message
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new MetaAPIError(
          data.error?.message || 'API request failed',
          response.status,
          data.error
        );
      }

      return data;

    } catch (error) {
      if (error instanceof MetaAPIError) {
        // Handle specific Meta API errors
        return this.handleMetaAPIError(error, to, message, retryCount);
      }
      
      // Network or other errors
      if (retryCount < 3) {
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.sendMessage(to, message, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Handle Meta API specific errors
   */
  async handleMetaAPIError(error, to, message, retryCount) {
    switch (error.statusCode) {
      case 429: // Rate limit
        if (retryCount < 3) {
          await this.delay(5000); // Wait 5 seconds
          return this.sendMessage(to, message, retryCount + 1);
        }
        throw error;

      case 401: // Invalid token
      case 403: // Forbidden
        throw new AuthenticationError('Invalid access token or permissions');

      case 500:
      case 502:
      case 503:
      case 504: // Server errors
        if (retryCount < 3) {
          await this.delay(2000 * (retryCount + 1));
          return this.sendMessage(to, message, retryCount + 1);
        }
        throw error;

      default:
        throw error;
    }
  }

  /**
   * Delay utility for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 4. MESSAGE VALIDATORS - Validate user inputs
// ============================================================================

class MessageValidator {
  /**
   * Validate mobile number (Indian format)
   */
  static validateMobileNumber(number) {
    const cleanNumber = number.replace(/\D/g, '');
    
    if (cleanNumber.length !== 10) {
      throw new ValidationError('Mobile number must be 10 digits', 'mobile');
    }

    if (!cleanNumber.match(/^[6-9]\d{9}$/)) {
      throw new ValidationError('Invalid mobile number format', 'mobile');
    }

    return cleanNumber;
  }

  /**
   * Validate OTP
   */
  static validateOTP(otp) {
    const cleanOTP = otp.trim();

    if (cleanOTP.length !== 6) {
      throw new OTPError('OTP must be 6 digits', 'INVALID_LENGTH');
    }

    if (!cleanOTP.match(/^\d{6}$/)) {
      throw new OTPError('OTP must contain only numbers', 'INVALID_FORMAT');
    }

    return cleanOTP;
  }

  /**
   * Validate language selection
   */
  static validateLanguage(lang) {
    const validLanguages = ['en', 'hi'];
    
    if (!validLanguages.includes(lang)) {
      throw new ValidationError('Invalid language selection', 'language');
    }

    return lang;
  }
}

// ============================================================================
// 5. RETRY MECHANISM - Automatic retries with exponential backoff
// ============================================================================

class RetryHandler {
  /**
   * Retry function with exponential backoff
   */
  static async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = () => true
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// ============================================================================
// 6. USAGE EXAMPLE - How to implement in your bot
// ============================================================================

// Initialize
const errorHandler = new ErrorHandler(console);
const metaAPI = new MetaAPIHandler(
  process.env.WHATSAPP_ACCESS_TOKEN,
  process.env.WHATSAPP_PHONE_NUMBER_ID
);

/**
 * Example: Handle incoming message
 */
async function handleIncomingMessage(message, userContext) {
  try {
    const { from, text, type } = message;
    const { language = 'en' } = userContext;

    // Validate and process based on conversation state
    if (userContext.state === 'WAITING_FOR_MOBILE') {
      // Validate mobile number
      const mobile = MessageValidator.validateMobileNumber(text.body);
      
      // Send OTP
      await sendOTP(mobile, language);
      
      return { success: true };
    }

    if (userContext.state === 'WAITING_FOR_OTP') {
      // Validate OTP
      const otp = MessageValidator.validateOTP(text.body);
      
      // Verify OTP
      const verified = await verifyOTP(from, otp);
      
      if (!verified) {
        throw new OTPError('OTP verification failed', 'INVALID_OTP');
      }
      
      return { success: true };
    }

  } catch (error) {
    // Handle error and send user-friendly message
    const errorResult = await errorHandler.handle(error, {
      userId: message.from,
      phone: message.from,
      action: userContext.state,
      language: userContext.language
    });

    // Send error message to user
    await metaAPI.sendMessage(message.from, {
      type: 'text',
      text: { body: errorResult.error.message }
    });

    return errorResult;
  }
}

/**
 * Example: Send OTP with retry
 */
async function sendOTP(mobile, language) {
  return await RetryHandler.retry(
    async () => {
      // Your OTP sending logic here
      const response = await fetch('https://your-otp-service.com/send', {
        method: 'POST',
        body: JSON.stringify({ mobile })
      });

      if (!response.ok) {
        throw new Error('Failed to send OTP');
      }

      return response.json();
    },
    {
      maxAttempts: 3,
      shouldRetry: (error) => !error.message.includes('Invalid mobile')
    }
  );
}

/**
 * Example: Verify OTP with timeout
 */
async function verifyOTP(userId, otp, timeout = 300000) {
  try {
    // Check OTP expiry (5 minutes)
    const otpData = await getStoredOTP(userId);
    
    if (!otpData) {
      throw new OTPError('No OTP found', 'NOT_FOUND');
    }

    if (Date.now() - otpData.timestamp > timeout) {
      throw new OTPError('OTP expired', 'EXPIRED');
    }

    if (otpData.otp !== otp) {
      throw new OTPError('Invalid OTP', 'MISMATCH');
    }

    return true;

  } catch (error) {
    if (error instanceof OTPError && error.reason === 'EXPIRED') {
      error.userMessage = '⏰ OTP expired. Click "Get OTP" to receive a new code.';
    }
    throw error;
  }
}

// ============================================================================
// 7. WEBHOOK ERROR HANDLING - For Meta webhook endpoints
// ============================================================================

function webhookErrorMiddleware(req, res, next) {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!verifyWebhookSignature(req.body, signature)) {
      throw new AuthenticationError('Invalid webhook signature');
    }

    next();

  } catch (error) {
    errorHandler.handle(error, {
      endpoint: 'webhook',
      ip: req.ip
    });

    res.status(403).json({ error: 'Forbidden' });
  }
}

function verifyWebhookSignature(payload, signature) {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_VERIFY_TOKEN)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ErrorHandler,
  MetaAPIHandler,
  MessageValidator,
  RetryHandler,
  WhatsAppBotError,
  MetaAPIError,
  OTPError,
  AuthenticationError,
  ValidationError,
  webhookErrorMiddleware
};
