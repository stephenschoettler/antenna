import { describe, it, expect, beforeEach } from 'vitest';
import { TelegramNotifier } from './TelegramNotifier.js';

describe('TelegramNotifier', () => {
  let notifier: TelegramNotifier;

  beforeEach(() => {
    // Create notifier without credentials (will be disabled)
    notifier = new TelegramNotifier();
  });

  describe('constructor', () => {
    it('should create a disabled notifier without credentials', () => {
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should create a disabled notifier with token but no chat ID', () => {
      const notifierWithToken = new TelegramNotifier('fake-token');
      expect(notifierWithToken.isEnabled()).toBe(false);
    });
  });

  describe('sendNotification', () => {
    it('should return false when disabled', async () => {
      const message = {
        sender: '+1234567890',
        content: 'Test message',
        priority: 'normal' as const,
        timestamp: Date.now(),
      };

      const result = await notifier.sendNotification(message);
      expect(result).toBe(false);
    });
  });

  describe('sendSimple', () => {
    it('should return false when disabled', async () => {
      const result = await notifier.sendSimple('Test message');
      expect(result).toBe(false);
    });
  });

  describe('sendBatch', () => {
    it('should return zero sent when disabled', async () => {
      const messages = [
        {
          sender: '+1234567890',
          content: 'Message 1',
          priority: 'normal' as const,
          timestamp: Date.now(),
        },
        {
          sender: '+0987654321',
          content: 'Message 2',
          priority: 'high' as const,
          timestamp: Date.now(),
        },
      ];

      const result = await notifier.sendBatch(messages);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(2);
    });
  });

  describe('isEnabled', () => {
    it('should return false for unconfigured notifier', () => {
      expect(notifier.isEnabled()).toBe(false);
    });
  });

  describe('getChatId', () => {
    it('should return empty string when not configured', () => {
      expect(notifier.getChatId()).toBe('');
    });
  });
});

// Note: Integration tests with real Telegram API would require:
// - TELEGRAM_BOT_TOKEN environment variable
// - TELEGRAM_CHAT_ID environment variable
// - Run with: TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy npm test
