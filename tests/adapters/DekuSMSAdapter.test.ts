/**
 * Tests for DekuSMSAdapter
 */

import { describe, it, expect } from 'vitest';
import { DekuSMSAdapter, DekuSMSAdapterError, type DekuSMSPayload } from '../../src/adapters/DekuSMSAdapter';

describe('DekuSMSAdapter', () => {
  const adapter = new DekuSMSAdapter();

  const validPayload: DekuSMSPayload = {
    id: 12345,
    message_id: 'msg_abc123',
    thread_id: 'thread_xyz789',
    date: '1733097600000',
    date_sent: '1733097600000',
    type: 1,
    num_segments: 1,
    subscription_id: 0,
    status: 0,
    error_code: 0,
    read: 0,
    is_encrypted: 0,
    formatted_date: '2024-12-02T00:00:00.000Z',
    address: '+14155551234',
    text: 'Hello, this is a test message',
    data: '',
  };

  describe('parseWebhook', () => {
    it('should parse a valid DekuSMS payload', () => {
      const result = adapter.parseWebhook(validPayload);

      expect(result.id).toBe('dekusms-12345-msg_abc123');
      expect(result.channel).toBe('sms');
      expect(result.sender).toBe('+14155551234');
      expect(result.content).toBe('Hello, this is a test message');
      expect(result.timestamp).toEqual(new Date('2024-12-02T00:00:00.000Z'));
      expect(result.metadata).toEqual({
        messageId: 'msg_abc123',
        threadId: 'thread_xyz789',
        type: 1,
        numSegments: 1,
        subscriptionId: 0,
        status: 0,
        errorCode: 0,
        isRead: false,
        isEncrypted: false,
        rawDate: '1733097600000',
        dateSent: '1733097600000',
      });
    });

    it('should normalize sender address by removing whitespace', () => {
      const payload = {
        ...validPayload,
        address: ' +1 415 555 1234 ',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.sender).toBe('+14155551234');
    });

    it('should include data field in metadata when present', () => {
      const payload = {
        ...validPayload,
        data: 'some_binary_data',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.metadata.data).toBe('some_binary_data');
    });

    it('should handle empty text content', () => {
      const payload = {
        ...validPayload,
        text: '',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.content).toBe('');
    });

    it('should set isRead to true when read flag is 1', () => {
      const payload = {
        ...validPayload,
        read: 1,
      };

      const result = adapter.parseWebhook(payload);

      expect(result.metadata.isRead).toBe(true);
    });

    it('should handle multi-segment messages', () => {
      const payload = {
        ...validPayload,
        num_segments: 3,
        text: 'This is a very long message that was split into multiple segments by the SMS protocol standard',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.metadata.numSegments).toBe(3);
      expect(result.content).toContain('very long message');
    });
  });

  describe('encrypted message handling', () => {
    it('should throw an error for encrypted messages', () => {
      const payload = {
        ...validPayload,
        is_encrypted: 1,
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Encrypted messages are not supported');
    });

    it('should include field name in encrypted message error', () => {
      const payload = {
        ...validPayload,
        is_encrypted: 1,
      };

      try {
        adapter.parseWebhook(payload);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(DekuSMSAdapterError);
        expect((err as DekuSMSAdapterError).field).toBe('is_encrypted');
      }
    });
  });

  describe('missing field validation', () => {
    const requiredFields: Array<keyof DekuSMSPayload> = [
      'id',
      'message_id',
      'thread_id',
      'date',
      'date_sent',
      'type',
      'num_segments',
      'subscription_id',
      'status',
      'error_code',
      'read',
      'is_encrypted',
      'formatted_date',
      'address',
      'text',
    ];

    it.each(requiredFields)('should throw error when %s is missing', (field) => {
      const payload = { ...validPayload };
      delete payload[field];

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow(`Missing required field: ${field}`);
    });

    it.each(requiredFields)('should throw error when %s is null', (field) => {
      const payload = { ...validPayload, [field]: null };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow(`Missing required field: ${field}`);
    });

    it('should include field name in missing field error', () => {
      const payload = { ...validPayload };
      delete payload.address;

      try {
        adapter.parseWebhook(payload);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(DekuSMSAdapterError);
        expect((err as DekuSMSAdapterError).field).toBe('address');
      }
    });
  });

  describe('malformed payload handling', () => {
    it('should throw error for null payload', () => {
      expect(() => adapter.parseWebhook(null)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(null)).toThrow('Invalid payload: expected object');
    });

    it('should throw error for undefined payload', () => {
      expect(() => adapter.parseWebhook(undefined)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(undefined)).toThrow('Invalid payload: expected object');
    });

    it('should throw error for string payload', () => {
      expect(() => adapter.parseWebhook('not an object')).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook('not an object')).toThrow('Invalid payload: expected object');
    });

    it('should throw error for array payload', () => {
      expect(() => adapter.parseWebhook([1, 2, 3])).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook([1, 2, 3])).toThrow('Invalid payload: expected object');
    });

    it('should throw error for number payload', () => {
      expect(() => adapter.parseWebhook(123)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(123)).toThrow('Invalid payload: expected object');
    });

    it('should throw error for empty object', () => {
      expect(() => adapter.parseWebhook({})).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook({})).toThrow('Missing required field');
    });
  });

  describe('field type validation', () => {
    it('should throw error when numeric field is a string', () => {
      const payload = {
        ...validPayload,
        id: '12345' as any,
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Invalid type for id: expected number');
    });

    it('should throw error when string field is a number', () => {
      const payload = {
        ...validPayload,
        message_id: 12345 as any,
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Invalid type for message_id: expected string');
    });

    it('should throw error when address is empty string', () => {
      const payload = {
        ...validPayload,
        address: '   ',
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Invalid address: cannot be empty');
    });

    it('should throw error when formatted_date is invalid', () => {
      const payload = {
        ...validPayload,
        formatted_date: 'not a date',
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Invalid formatted_date: could not parse');
    });

    it('should throw error when formatted_date is empty', () => {
      const payload = {
        ...validPayload,
        formatted_date: '',
      };

      expect(() => adapter.parseWebhook(payload)).toThrow(DekuSMSAdapterError);
      expect(() => adapter.parseWebhook(payload)).toThrow('Invalid formatted_date: cannot be empty');
    });
  });

  describe('message ID generation', () => {
    it('should generate unique IDs for different messages', () => {
      const payload1 = { ...validPayload, id: 1, message_id: 'msg1' };
      const payload2 = { ...validPayload, id: 2, message_id: 'msg2' };

      const result1 = adapter.parseWebhook(payload1);
      const result2 = adapter.parseWebhook(payload2);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toBe('dekusms-1-msg1');
      expect(result2.id).toBe('dekusms-2-msg2');
    });
  });

  describe('timestamp parsing', () => {
    it('should parse ISO 8601 formatted_date', () => {
      const payload = {
        ...validPayload,
        formatted_date: '2024-12-02T14:30:00.000Z',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.timestamp).toEqual(new Date('2024-12-02T14:30:00.000Z'));
    });

    it('should parse locale formatted_date', () => {
      const payload = {
        ...validPayload,
        formatted_date: 'Mon Dec 02 2024 14:30:00 GMT+0000',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThan(0);
    });

    it('should handle different timezone formats', () => {
      const payload = {
        ...validPayload,
        formatted_date: '2024-12-02T14:30:00-08:00',
      };

      const result = adapter.parseWebhook(payload);

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('error metadata', () => {
    it('should include payload in error when validation fails', () => {
      const invalidPayload = { invalid: 'data' };

      try {
        adapter.parseWebhook(invalidPayload);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(DekuSMSAdapterError);
        expect((err as DekuSMSAdapterError).payload).toEqual(invalidPayload);
      }
    });

    it('should set error name to DekuSMSAdapterError', () => {
      try {
        adapter.parseWebhook(null);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect((err as DekuSMSAdapterError).name).toBe('DekuSMSAdapterError');
      }
    });
  });
});
