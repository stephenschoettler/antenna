import twilio from 'twilio';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { QueueManager } from './QueueManager.js';
import { RabbitMQSender, type DeliveryReceipt } from './RabbitMQSender.js';

export type ResponseChannel = 'sms' | 'email';
export type SMSProvider = 'twilio' | 'dekusms';

export interface ResponseMessage {
  to: string;
  text: string;
  subject?: string; // For email only
  from?: string; // Override default sender
}

export interface ResponseResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SMSConfig {
  provider: SMSProvider;
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  dekusms?: {
    rabbitmqUrl: string;
    queueName: string;
    callbackQueue: string;
  };
}

/**
 * AutoResponder handles sending automated responses via SMS and email
 */
export class AutoResponder {
  private twilioClient?: twilio.Twilio;
  private twilioPhoneNumber?: string;
  private rabbitMQSender?: RabbitMQSender;
  private smsProvider?: SMSProvider;
  private emailTransporter?: Transporter;
  private emailFrom?: string;
  private queueManager?: QueueManager;
  private smsEnabled: boolean;
  private emailEnabled: boolean;

  constructor(queueManager?: QueueManager, smsConfig?: SMSConfig) {
    this.queueManager = queueManager;
    this.smsEnabled = false;
    this.emailEnabled = false;

    this.initializeSMS(smsConfig);
    this.initializeEmail();
  }

  /**
   * Initialize SMS provider (Twilio or DekuSMS/RabbitMQ)
   */
  private initializeSMS(smsConfig?: SMSConfig): void {
    // Use config if provided, otherwise fall back to env vars
    if (smsConfig) {
      this.smsProvider = smsConfig.provider;

      if (smsConfig.provider === 'dekusms' && smsConfig.dekusms) {
        this.initializeDekuSMS(smsConfig.dekusms);
      } else if (smsConfig.provider === 'twilio' && smsConfig.twilio) {
        this.initializeTwilioFromConfig(smsConfig.twilio);
      } else {
        console.warn('[AutoResponder] SMS config incomplete, SMS disabled');
      }
    } else {
      // Fall back to env var configuration (legacy Twilio)
      this.smsProvider = 'twilio';
      this.initializeTwilioFromEnv();
    }
  }

  /**
   * Initialize DekuSMS via RabbitMQ
   */
  private initializeDekuSMS(config: NonNullable<SMSConfig['dekusms']>): void {
    try {
      this.rabbitMQSender = new RabbitMQSender({
        rabbitmqUrl: config.rabbitmqUrl,
        queueName: config.queueName,
        callbackQueue: config.callbackQueue,
      });

      // Connect asynchronously
      this.rabbitMQSender.connect().then(() => {
        this.smsEnabled = true;
        console.log('[AutoResponder] SMS (DekuSMS/RabbitMQ) initialized');
      }).catch((err) => {
        console.error('[AutoResponder] Failed to connect to RabbitMQ:', err);
        this.smsEnabled = false;
      });
    } catch (err) {
      console.error('[AutoResponder] Failed to initialize DekuSMS:', err);
      this.smsEnabled = false;
    }
  }

  /**
   * Initialize Twilio from config
   */
  private initializeTwilioFromConfig(config: NonNullable<SMSConfig['twilio']>): void {
    try {
      this.twilioClient = twilio(config.accountSid, config.authToken);
      this.twilioPhoneNumber = config.fromNumber;
      this.smsEnabled = true;
      console.log('[AutoResponder] SMS (Twilio) initialized');
    } catch (err) {
      console.error('[AutoResponder] Failed to initialize Twilio:', err);
      this.smsEnabled = false;
    }
  }

  /**
   * Initialize Twilio from environment variables (legacy)
   */
  private initializeTwilioFromEnv(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      console.warn('[AutoResponder] Twilio credentials not configured, SMS disabled');
      return;
    }

    try {
      this.twilioClient = twilio(accountSid, authToken);
      this.twilioPhoneNumber = phoneNumber;
      this.smsEnabled = true;
      console.log('[AutoResponder] SMS (Twilio) initialized');
    } catch (err) {
      console.error('[AutoResponder] Failed to initialize Twilio:', err);
      this.smsEnabled = false;
    }
  }

  /**
   * Initialize email transporter
   */
  private initializeEmail(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !emailFrom) {
      console.warn('[AutoResponder] SMTP credentials not configured, email disabled');
      return;
    }

    try {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.parseInt(smtpPort, 10),
        secure: Number.parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.emailFrom = emailFrom;
      this.emailEnabled = true;
      console.log('[AutoResponder] Email (SMTP) initialized');
    } catch (err) {
      console.error('[AutoResponder] Failed to initialize email:', err);
      this.emailEnabled = false;
    }
  }

  /**
   * Send an SMS response
   */
  async sendSMS(message: ResponseMessage): Promise<ResponseResult> {
    if (!this.smsEnabled) {
      const error = 'SMS not configured or disabled';
      console.error(`[AutoResponder] ${error}`);
      return { success: false, error };
    }

    // Route to appropriate provider
    if (this.smsProvider === 'dekusms') {
      return this.sendViaDekuSMS(message);
    }
    
    return this.sendViaTwilio(message);
  }

  /**
   * Send SMS via DekuSMS/RabbitMQ
   */
  private async sendViaDekuSMS(message: ResponseMessage): Promise<ResponseResult> {
    if (!this.rabbitMQSender) {
      const error = 'RabbitMQ sender not initialized';
      console.error(`[AutoResponder] ${error}`);
      return { success: false, error };
    }

    try {
      // Set up delivery tracking
      let messageDbId: number | undefined;

      const result = await this.rabbitMQSender.sendSMS(
        message.to,
        message.text,
        undefined,
        (receipt: DeliveryReceipt) => {
          console.log(`[AutoResponder] Delivery receipt for ${message.to}:`, receipt);

          // Update message status in queue
          if (this.queueManager && messageDbId) {
            if (receipt.status === 'delivered') {
              this.queueManager.markResolved(messageDbId);
            } else if (receipt.status === 'failed') {
              this.queueManager.markFailed(messageDbId);
            }
          }
        }
      );

      if (result.success) {
        console.log(`[AutoResponder] SMS sent to ${message.to} via DekuSMS (ID: ${result.messageId})`);

        // Track in queue DB if available
        if (this.queueManager) {
          messageDbId = this.queueManager.addToQueue(
            message.text,
            'normal',
            'auto-respond',
            message.to,
            {
              channel: 'sms',
              provider: 'dekusms',
              messageSid: result.messageId,
              status: 'pending',
            }
          );
          
          this.queueManager.markProcessing(messageDbId);
        }
      }

      return result;
    } catch (err) {
      const error = err as Error;
      console.error('[AutoResponder] Failed to send SMS via DekuSMS:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(message: ResponseMessage): Promise<ResponseResult> {
    if (!this.twilioClient || !this.twilioPhoneNumber) {
      const error = 'Twilio not configured';
      console.error(`[AutoResponder] ${error}`);
      return { success: false, error };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message.text,
        from: message.from || this.twilioPhoneNumber,
        to: message.to,
      });

      console.log(`[AutoResponder] SMS sent to ${message.to} (SID: ${result.sid})`);

      // Track in queue DB if available
      if (this.queueManager) {
        this.queueManager.addToQueue(
          message.text,
          'normal',
          'auto-respond',
          message.to,
          {
            channel: 'sms',
            provider: 'twilio',
            messageSid: result.sid,
            status: result.status,
          }
        );
      }

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[AutoResponder] Failed to send SMS via Twilio:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send an email response
   */
  async sendEmail(message: ResponseMessage): Promise<ResponseResult> {
    if (!this.emailEnabled || !this.emailTransporter || !this.emailFrom) {
      const error = 'Email not configured or disabled';
      console.error(`[AutoResponder] ${error}`);
      return { success: false, error };
    }

    try {
      const result = await this.emailTransporter.sendMail({
        from: message.from || this.emailFrom,
        to: message.to,
        subject: message.subject || 'Automated Response',
        text: message.text,
      });

      console.log(`[AutoResponder] Email sent to ${message.to} (ID: ${result.messageId})`);

      // Track in queue DB if available
      if (this.queueManager) {
        this.queueManager.addToQueue(
          message.text,
          'normal',
          'auto-respond',
          message.to,
          {
            channel: 'email',
            messageId: result.messageId,
            subject: message.subject,
          }
        );
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[AutoResponder] Failed to send email:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a response via the specified channel
   */
  async sendResponse(
    message: ResponseMessage,
    channel: ResponseChannel
  ): Promise<ResponseResult> {
    console.log(`[AutoResponder] Sending ${channel} response to ${message.to}`);

    switch (channel) {
      case 'sms':
        return this.sendSMS(message);
      case 'email':
        return this.sendEmail(message);
      default:
        return {
          success: false,
          error: `Unknown channel: ${channel}`,
        };
    }
  }

  /**
   * Send a templated response
   */
  async sendTemplatedResponse(
    to: string,
    template: string,
    variables: Record<string, string>,
    channel: ResponseChannel,
    subject?: string
  ): Promise<ResponseResult> {
    // Simple template replacement: {{variable}} -> value
    let text = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      text = text.replace(new RegExp(placeholder, 'g'), value);
    }

    return this.sendResponse({ to, text, subject }, channel);
  }

  /**
   * Check if SMS is enabled
   */
  isSMSEnabled(): boolean {
    return this.smsEnabled;
  }

  /**
   * Check if email is enabled
   */
  isEmailEnabled(): boolean {
    return this.emailEnabled;
  }

  /**
   * Get status of all channels
   */
  getStatus(): Record<ResponseChannel, boolean> & { smsProvider?: SMSProvider } {
    return {
      sms: this.smsEnabled,
      email: this.emailEnabled,
      smsProvider: this.smsProvider,
    };
  }

  /**
   * Get RabbitMQ sender status (if using DekuSMS)
   */
  getRabbitMQStatus() {
    return this.rabbitMQSender?.getStatus();
  }

  /**
   * Gracefully close connections
   */
  async close(): Promise<void> {
    if (this.rabbitMQSender) {
      await this.rabbitMQSender.close();
    }
    
    if (this.emailTransporter) {
      this.emailTransporter.close();
    }

    console.log('[AutoResponder] Connections closed');
  }

  /**
   * Verify email configuration by sending a test email
   */
  async verifyEmail(testRecipient: string): Promise<boolean> {
    if (!this.emailEnabled || !this.emailTransporter) {
      console.error('[AutoResponder] Email not configured');
      return false;
    }

    try {
      await this.emailTransporter.verify();
      console.log('[AutoResponder] Email transporter verified');

      // Optionally send a test email
      if (testRecipient) {
        const result = await this.sendEmail({
          to: testRecipient,
          text: 'This is a test email from Antenna AutoResponder.',
          subject: 'Antenna Test Email',
        });
        
        return result.success;
      }

      return true;
    } catch (err) {
      console.error('[AutoResponder] Email verification failed:', err);
      return false;
    }
  }
}
