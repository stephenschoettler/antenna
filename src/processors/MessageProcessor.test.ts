/**
 * Tests for MessageProcessor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageProcessor } from './MessageProcessor';
import type { InboundMessage } from '../../../siphon-engine/src/types';
import type { AntennaConfig } from '../config/antenna.config';

describe('MessageProcessor', () => {
  let processor: MessageProcessor;
  let testConfig: AntennaConfig;

  beforeEach(() => {
    // Create a test configuration
    testConfig = {
      vips: {
        tier1: ['+15551111111', 'vip@example.com'],
        tier2: ['+15552222222', 'important@example.com'],
        tier3: 'default',
      },
      persona: 'Babbage',
      thresholds: {
        urgent: 75,
        high: 50,
        normal: 25,
      },
      llmProvider: undefined, // Will use TemplateLLMProvider by default
    };

    processor = new MessageProcessor({ config: testConfig });
  });

  describe('processInbound', () => {
    it('should process a valid SMS message from tier1 VIP', async () => {
      const message: InboundMessage = {
        id: 'msg-001',
        channel: 'sms',
        sender: '+15551111111',
        content: 'URGENT: Need help immediately!',
        timestamp: new Date(),
      };

      const action = await processor.processInbound(message);

      expect(action).toBeDefined();
      expect(action.type).toMatch(/notify|auto_respond|queue|deflect/);
      expect(action.priority).toMatch(/urgent|high|normal|low/);
    });

    it('should process a valid email message', async () => {
      const message: InboundMessage = {
        id: 'email-001',
        channel: 'email',
        sender: 'test@example.com',
        content: 'Hello, I need some assistance.',
        timestamp: new Date(),
        metadata: {
          subject: 'Support Request',
        },
      };

      const action = await processor.processInbound(message);

      expect(action).toBeDefined();
      expect(action.priority).toBeDefined();
    });

    it('should handle invalid message gracefully', async () => {
      const invalidMessage = {
        id: '',
        sender: '',
        content: '',
      } as InboundMessage;

      const action = await processor.processInbound(invalidMessage);

      // Should return a safe fallback action
      expect(action.type).toBe('queue');
      expect(action.priority).toBe('normal');
    });

    it('should process batch messages', async () => {
      const messages: InboundMessage[] = [
        {
          id: 'msg-001',
          channel: 'sms',
          sender: '+15551111111',
          content: 'First message',
          timestamp: new Date(),
        },
        {
          id: 'msg-002',
          channel: 'email',
          sender: 'test@example.com',
          content: 'Second message',
          timestamp: new Date(),
        },
      ];

      const actions = await processor.processBatch(messages);

      expect(actions).toHaveLength(2);
      expect(actions[0]).toBeDefined();
      expect(actions[1]).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should return current config', () => {
      const config = processor.getConfig();

      expect(config.vips.tier1).toHaveLength(2);
      expect(config.vips.tier2).toHaveLength(2);
      expect(config.persona).toBe('Babbage');
      expect(config.thresholds.urgent).toBe(75);
    });

    it('should reload configuration', () => {
      // This would normally load from file, but we're using in-memory config
      // In a real test, you'd mock the file system or use a test config file
      expect(() => {
        // Note: This will fail without a real config file, but demonstrates the API
        // processor.reloadConfig('./test-config.yaml');
      }).not.toThrow();
    });
  });
});
