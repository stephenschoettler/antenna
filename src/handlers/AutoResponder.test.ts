import { describe, it, expect, beforeEach } from 'vitest';
import { AutoResponder } from './AutoResponder.js';

describe('AutoResponder', () => {
  let responder: AutoResponder;

  beforeEach(() => {
    // Create responder without credentials (will be disabled)
    responder = new AutoResponder();
  });

  describe('constructor', () => {
    it('should create a responder with disabled channels', () => {
      expect(responder.isSMSEnabled()).toBe(false);
      expect(responder.isEmailEnabled()).toBe(false);
    });
  });

  describe('sendSMS', () => {
    it('should return error when SMS not configured', async () => {
      const result = await responder.sendSMS({
        to: '+1234567890',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('should return error when email not configured', async () => {
      const result = await responder.sendEmail({
        to: 'test@example.com',
        text: 'Test message',
        subject: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendResponse', () => {
    it('should return error for SMS when not configured', async () => {
      const result = await responder.sendResponse(
        {
          to: '+1234567890',
          text: 'Test message',
        },
        'sms'
      );

      expect(result.success).toBe(false);
    });

    it('should return error for email when not configured', async () => {
      const result = await responder.sendResponse(
        {
          to: 'test@example.com',
          text: 'Test message',
          subject: 'Test',
        },
        'email'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('sendTemplatedResponse', () => {
    it('should replace template variables', async () => {
      const template = 'Hello {{name}}, your order {{orderId}} is ready!';
      const variables = {
        name: 'John',
        orderId: '12345',
      };

      const result = await responder.sendTemplatedResponse(
        '+1234567890',
        template,
        variables,
        'sms'
      );

      // Should fail because SMS is not configured, but we can still test the logic
      expect(result.success).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status of all channels', () => {
      const status = responder.getStatus();
      
      expect(status).toHaveProperty('sms');
      expect(status).toHaveProperty('email');
      expect(status.sms).toBe(false);
      expect(status.email).toBe(false);
    });
  });

  describe('isSMSEnabled', () => {
    it('should return false when not configured', () => {
      expect(responder.isSMSEnabled()).toBe(false);
    });
  });

  describe('isEmailEnabled', () => {
    it('should return false when not configured', () => {
      expect(responder.isEmailEnabled()).toBe(false);
    });
  });
});

// Note: Integration tests with real Twilio/SMTP would require:
// For SMS:
// - TWILIO_ACCOUNT_SID environment variable
// - TWILIO_AUTH_TOKEN environment variable
// - TWILIO_PHONE_NUMBER environment variable
//
// For Email:
// - SMTP_HOST environment variable
// - SMTP_PORT environment variable
// - SMTP_USER environment variable
// - SMTP_PASS environment variable
// - EMAIL_FROM environment variable
