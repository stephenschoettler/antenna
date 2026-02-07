import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueManager } from './QueueManager.js';
import { TelegramNotifier } from './TelegramNotifier.js';
import { AutoResponder } from './AutoResponder.js';
import { RoutingHandler } from './RoutingHandler.js';
import { unlinkSync } from 'node:fs';

describe('RoutingHandler', () => {
  let queueManager: QueueManager;
  let telegramNotifier: TelegramNotifier;
  let autoResponder: AutoResponder;
  let routingHandler: RoutingHandler;
  const testDbPath = './test-processor.db';

  beforeEach(() => {
    queueManager = new QueueManager(testDbPath);
    telegramNotifier = new TelegramNotifier(); // Disabled without credentials
    autoResponder = new AutoResponder(queueManager); // Disabled without credentials
    routingHandler = new RoutingHandler(queueManager, telegramNotifier, autoResponder);
  });

  afterEach(() => {
    queueManager.close();
    try {
      unlinkSync(testDbPath);
      unlinkSync(`${testDbPath}-shm`);
      unlinkSync(`${testDbPath}-wal`);
    } catch {
      // Files might not exist
    }
  });

  describe('process', () => {
    it('should process a message with urgent keywords', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'URGENT: Need help immediately!',
        channel: 'sms',
      });

      expect(result.messageId).toBeGreaterThan(0);
      expect(result.action).toBe('notify');
      expect(result.priority).toBe('urgent');
    });

    it('should process a message with important keywords', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'This is important, deadline is tomorrow',
        channel: 'sms',
      });

      expect(result.messageId).toBeGreaterThan(0);
      expect(result.action).toBe('notify');
      expect(result.priority).toBe('high');
    });

    it('should queue messages with questions', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'Can you help me with this?',
        channel: 'sms',
      });

      expect(result.messageId).toBeGreaterThan(0);
      expect(result.action).toBe('queue');
      expect(result.priority).toBe('normal');
    });

    it('should ignore spam messages', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'Free prize! Click here to win!',
        channel: 'sms',
      });

      expect(result.messageId).toBeGreaterThan(0);
      expect(result.action).toBe('ignore');
      expect(result.priority).toBe('low');
    });

    it('should queue normal messages by default', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'Just a normal message',
        channel: 'sms',
      });

      expect(result.messageId).toBeGreaterThan(0);
      expect(result.action).toBe('queue');
      expect(result.priority).toBe('normal');
    });

    it('should store message metadata', async () => {
      const result = await routingHandler.process({
        sender: '+1234567890',
        content: 'Test message',
        channel: 'email',
        metadata: {
          subject: 'Test Subject',
          customField: 'value',
        },
      });

      const message = queueManager.getMessage(result.messageId);
      expect(message).toBeDefined();
      expect(message?.metadata).toBeDefined();
      
      if (message?.metadata) {
        const metadata = JSON.parse(message.metadata);
        expect(metadata.subject).toBe('Test Subject');
        expect(metadata.customField).toBe('value');
      }
    });
  });

  describe('processBatch', () => {
    it('should process multiple messages', async () => {
      const messages = [
        {
          sender: '+1111111111',
          content: 'URGENT message',
          channel: 'sms' as const,
        },
        {
          sender: '+2222222222',
          content: 'Normal message',
          channel: 'sms' as const,
        },
        {
          sender: '+3333333333',
          content: 'Can you help?',
          channel: 'sms' as const,
        },
      ];

      const results = await routingHandler.processBatch(messages);

      expect(results).toHaveLength(3);
      expect(results[0].priority).toBe('urgent');
      expect(results[1].priority).toBe('normal');
      expect(results[2].priority).toBe('normal');
    });
  });

  describe('addRule', () => {
    it('should add a custom routing rule', async () => {
      routingHandler.addRule({
        condition: (msg) => msg.sender === '+9999999999',
        priority: 'high',
        action: 'notify',
      });

      const result = await routingHandler.process({
        sender: '+9999999999',
        content: 'Test from specific sender',
        channel: 'sms',
      });

      expect(result.priority).toBe('high');
      expect(result.action).toBe('notify');
    });
  });

  describe('resetRules', () => {
    it('should reset to default rules', async () => {
      // Add a custom rule
      routingHandler.addRule({
        condition: (msg) => msg.sender === '+9999999999',
        priority: 'high',
        action: 'notify',
      });

      // Reset rules
      routingHandler.resetRules();

      // Custom rule should no longer apply
      const result = await routingHandler.process({
        sender: '+9999999999',
        content: 'Normal message',
        channel: 'sms',
      });

      expect(result.action).toBe('queue'); // Default action
      expect(result.priority).toBe('normal'); // Default priority
    });
  });

  describe('getPendingMessages', () => {
    beforeEach(async () => {
      await routingHandler.process({
        sender: '+1111111111',
        content: 'Message 1',
        channel: 'sms',
      });
      await routingHandler.process({
        sender: '+2222222222',
        content: 'Message 2',
        channel: 'sms',
      });
    });

    it('should return pending messages', () => {
      const pending = routingHandler.getPendingMessages();
      expect(pending.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', () => {
      const pending = routingHandler.getPendingMessages(1);
      expect(pending.length).toBe(1);
    });
  });

  describe('getMessagesByPriority', () => {
    beforeEach(async () => {
      await routingHandler.process({
        sender: '+1111111111',
        content: 'URGENT: Emergency!',
        channel: 'sms',
      });
      await routingHandler.process({
        sender: '+2222222222',
        content: 'Normal message',
        channel: 'sms',
      });
    });

    it('should filter messages by priority', () => {
      const urgent = routingHandler.getMessagesByPriority('urgent');
      expect(urgent.length).toBeGreaterThan(0);
      expect(urgent.every((msg) => msg.priority === 'urgent')).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await routingHandler.process({
        sender: '+1111111111',
        content: 'Message 1',
        channel: 'sms',
      });
      await routingHandler.process({
        sender: '+2222222222',
        content: 'Message 2',
        channel: 'sms',
      });
    });

    it('should return processing statistics', () => {
      const stats = routingHandler.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('resolved');
      expect(stats).toHaveProperty('failed');
    });
  });

  describe('getHandlerStatus', () => {
    it('should return status of all handlers', () => {
      const status = routingHandler.getHandlerStatus();
      
      expect(status).toHaveProperty('telegram');
      expect(status).toHaveProperty('sms');
      expect(status).toHaveProperty('email');
      expect(status.telegram).toBe(false); // Disabled in tests
      expect(status.sms).toBe(false); // Disabled in tests
      expect(status.email).toBe(false); // Disabled in tests
    });
  });
});
