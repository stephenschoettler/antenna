import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueManager } from './QueueManager.js';
import { unlinkSync } from 'node:fs';

describe('QueueManager', () => {
  let queueManager: QueueManager;
  const testDbPath = './test-queue.db';

  beforeEach(() => {
    queueManager = new QueueManager(testDbPath);
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

  describe('addToQueue', () => {
    it('should add a message to the queue', () => {
      const messageId = queueManager.addToQueue(
        'Test message',
        'normal',
        'queue',
        '+1234567890'
      );

      expect(messageId).toBeGreaterThan(0);
    });

    it('should add a message with metadata', () => {
      const metadata = { source: 'test', type: 'automated' };
      const messageId = queueManager.addToQueue(
        'Test message with metadata',
        'high',
        'notify',
        '+1234567890',
        metadata
      );

      const message = queueManager.getMessage(messageId);
      expect(message).toBeDefined();
      expect(message?.metadata).toBe(JSON.stringify(metadata));
    });
  });

  describe('getQueue', () => {
    beforeEach(() => {
      // Add test messages
      queueManager.addToQueue('Urgent message', 'urgent', 'notify', '+1111111111');
      queueManager.addToQueue('High priority', 'high', 'queue', '+2222222222');
      queueManager.addToQueue('Normal message', 'normal', 'queue', '+3333333333');
    });

    it('should retrieve all messages', () => {
      const messages = queueManager.getQueue();
      expect(messages.length).toBe(3);
    });

    it('should filter by priority', () => {
      const messages = queueManager.getQueue({ priority: 'urgent' });
      expect(messages.length).toBe(1);
      expect(messages[0].priority).toBe('urgent');
    });

    it('should filter by status', () => {
      const messages = queueManager.getQueue({ status: 'pending' });
      expect(messages.length).toBe(3);
    });

    it('should filter by routing action', () => {
      const messages = queueManager.getQueue({ routing_action: 'notify' });
      expect(messages.length).toBe(1);
      expect(messages[0].routing_action).toBe('notify');
    });

    it('should respect limit', () => {
      const messages = queueManager.getQueue({ limit: 2 });
      expect(messages.length).toBe(2);
    });
  });

  describe('markResolved', () => {
    it('should mark a message as resolved', () => {
      const messageId = queueManager.addToQueue(
        'Test message',
        'normal',
        'queue',
        '+1234567890'
      );

      queueManager.markResolved(messageId);

      const message = queueManager.getMessage(messageId);
      expect(message?.status).toBe('resolved');
    });
  });

  describe('markProcessing', () => {
    it('should mark a message as processing', () => {
      const messageId = queueManager.addToQueue(
        'Test message',
        'normal',
        'queue',
        '+1234567890'
      );

      queueManager.markProcessing(messageId);

      const message = queueManager.getMessage(messageId);
      expect(message?.status).toBe('processing');
    });
  });

  describe('markFailed', () => {
    it('should mark a message as failed', () => {
      const messageId = queueManager.addToQueue(
        'Test message',
        'normal',
        'queue',
        '+1234567890'
      );

      queueManager.markFailed(messageId);

      const message = queueManager.getMessage(messageId);
      expect(message?.status).toBe('failed');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      queueManager.addToQueue('Message 1', 'urgent', 'notify', '+1111111111');
      queueManager.addToQueue('Message 2', 'high', 'queue', '+2222222222');
      queueManager.addToQueue('Message 3', 'normal', 'queue', '+3333333333');
      
      const messageId = queueManager.addToQueue('Message 4', 'normal', 'queue', '+4444444444');
      queueManager.markResolved(messageId);
    });

    it('should return correct statistics', () => {
      const stats = queueManager.getStats();
      
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(3);
      expect(stats.resolved).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});
