import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock variables are available during hoisting
const { mockChannel, mockConnectionModel, mockConnect } = vi.hoisted(() => {
  const mockChannel = {
    assertQueue: vi.fn().mockResolvedValue({}),
    consume: vi.fn().mockResolvedValue({}),
    sendToQueue: vi.fn().mockReturnValue(true),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
  };

  const mockConnectionModel = {
    createChannel: vi.fn().mockResolvedValue(mockChannel),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  const mockConnect = vi.fn().mockResolvedValue(mockConnectionModel);

  return { mockChannel, mockConnectionModel, mockConnect };
});

vi.mock('amqplib', () => ({
  connect: mockConnect,
}));

import { RabbitMQSender, type DeliveryReceipt } from '../../src/handlers/RabbitMQSender.js';

describe('RabbitMQSender', () => {
  let sender: RabbitMQSender;

  beforeEach(() => {
    vi.clearAllMocks();
    sender = new RabbitMQSender({
      rabbitmqUrl: 'amqp://localhost:5672',
      queueName: 'sms_outbound',
      callbackQueue: 'sms_callbacks',
    });
  });

  afterEach(async () => {
    await sender.close();
  });

  describe('connect', () => {
    it('should successfully connect to RabbitMQ', async () => {
      await sender.connect();

      expect(mockConnect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnectionModel.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('sms_outbound', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('sms_callbacks', { durable: true });
      expect(sender.isReady()).toBe(true);
    });

    it('should set up error handlers on connection', async () => {
      await sender.connect();

      expect(mockConnectionModel.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnectionModel.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should set up error handlers on channel', async () => {
      await sender.connect();

      expect(mockChannel.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChannel.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection failure', async () => {
      const error = new Error('Connection failed');
      mockConnect.mockRejectedValueOnce(error);

      await expect(sender.connect()).rejects.toThrow('Failed to connect to RabbitMQ: Connection failed');
      expect(sender.isReady()).toBe(false);
    });

    it('should not reconnect if already connected', async () => {
      await sender.connect();
      vi.clearAllMocks();

      await sender.connect();

      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('sendSMS', () => {
    beforeEach(async () => {
      await sender.connect();
      vi.clearAllMocks();
    });

    it('should successfully send an SMS message', async () => {
      const result = await sender.sendSMS('+15551234567', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'sms_outbound',
        expect.any(Buffer),
        {
          persistent: true,
          contentType: 'application/json',
        }
      );

      // Verify message format
      const sendCall = mockChannel.sendToQueue.mock.calls[0];
      const messageBuffer = sendCall[1] as Buffer;
      const message = JSON.parse(messageBuffer.toString());

      expect(message).toHaveProperty('sid');
      expect(message).toHaveProperty('id');
      expect(message.to).toBe('+15551234567');
      expect(message.text).toBe('Test message');
    });

    it('should accept optional SID parameter', async () => {
      const customSid = 'custom-sid-123';
      const result = await sender.sendSMS('+15551234567', 'Test', customSid);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(customSid);

      const sendCall = mockChannel.sendToQueue.mock.calls[0];
      const messageBuffer = sendCall[1] as Buffer;
      const message = JSON.parse(messageBuffer.toString());

      expect(message.sid).toBe(customSid);
    });

    it('should validate E.164 phone number format', async () => {
      const invalidNumbers = [
        '5551234567',      // Missing +
        '+12345678901234567', // Too long
        'invalid',         // Not a number
        '',                // Empty
      ];

      for (const number of invalidNumbers) {
        const result = await sender.sendSMS(number, 'Test');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid phone number format');
      }
    });

    it('should accept valid E.164 phone numbers', async () => {
      const validNumbers = [
        '+15551234567',       // US number
        '+447700900123',      // UK number
        '+8613800138000',     // China number
      ];

      for (const number of validNumbers) {
        vi.clearAllMocks();
        const result = await sender.sendSMS(number, 'Test');

        expect(result.success).toBe(true);
        expect(mockChannel.sendToQueue).toHaveBeenCalled();
      }
    });

    it('should register delivery callback when provided', async () => {
      const deliveryCallback = vi.fn();
      
      await sender.sendSMS('+15551234567', 'Test', undefined, deliveryCallback);

      const status = sender.getStatus();
      expect(status.pendingCallbacks).toBe(1);
    });

    it('should handle queue full scenario', async () => {
      mockChannel.sendToQueue.mockReturnValueOnce(false);

      const resultPromise = sender.sendSMS('+15551234567', 'Test');

      // Simulate drain event
      const onceCall = mockChannel.once.mock.calls.find(call => call[0] === 'drain');
      if (onceCall) {
        onceCall[1](); // Trigger drain callback
      }

      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it('should return error when channel is not available', async () => {
      // Create a new sender that fails to connect
      const failingSender = new RabbitMQSender({
        rabbitmqUrl: 'amqp://localhost:5672',
        queueName: 'sms_outbound',
        callbackQueue: 'sms_callbacks',
        maxReconnectAttempts: 0, // Don't retry
      });

      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await failingSender.sendSMS('+15551234567', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not connected to RabbitMQ');
      
      await failingSender.close();
    });

    it('should handle send errors gracefully', async () => {
      mockChannel.sendToQueue.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      const result = await sender.sendSMS('+15551234567', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('delivery receipts', () => {
    beforeEach(async () => {
      await sender.connect();
    });

    it('should set up delivery receipt listener on connect', async () => {
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'sms_callbacks',
        expect.any(Function),
        { noAck: false }
      );
    });

    it('should process delivery receipts and call callback', async () => {
      const deliveryCallback = vi.fn();
      const sid = 'test-sid-123';

      // Send message with callback
      await sender.sendSMS('+15551234567', 'Test', sid, deliveryCallback);

      // Simulate delivery receipt
      const consumeCall = mockChannel.consume.mock.calls.find(
        call => call[0] === 'sms_callbacks'
      );
      expect(consumeCall).toBeDefined();

      const messageHandler = consumeCall![1];
      const receipt: DeliveryReceipt = {
        type: 'SMS_TYPE_STATUS',
        status: 'delivered',
        sid,
      };

      const mockMessage = {
        content: Buffer.from(JSON.stringify(receipt)),
      };

      // Call the message handler
      messageHandler(mockMessage);

      expect(deliveryCallback).toHaveBeenCalledWith(receipt);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle receipt for unknown SID gracefully', async () => {
      const consumeCall = mockChannel.consume.mock.calls.find(
        call => call[0] === 'sms_callbacks'
      );
      const messageHandler = consumeCall![1];

      const receipt: DeliveryReceipt = {
        type: 'SMS_TYPE_STATUS',
        status: 'delivered',
        sid: 'unknown-sid',
      };

      const mockMessage = {
        content: Buffer.from(JSON.stringify(receipt)),
      };

      // Should not throw
      messageHandler(mockMessage);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle malformed receipt and nack message', async () => {
      const consumeCall = mockChannel.consume.mock.calls.find(
        call => call[0] === 'sms_callbacks'
      );
      const messageHandler = consumeCall![1];

      const mockMessage = {
        content: Buffer.from('invalid json'),
      };

      messageHandler(mockMessage);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    it('should handle null message from consumer', async () => {
      const consumeCall = mockChannel.consume.mock.calls.find(
        call => call[0] === 'sms_callbacks'
      );
      const messageHandler = consumeCall![1];

      // Should not throw
      messageHandler(null);

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });
  });

  describe('connection management', () => {
    it('should report correct connection status', async () => {
      let status = sender.getStatus();
      expect(status.connected).toBe(false);
      expect(status.reconnectAttempts).toBe(0);

      await sender.connect();

      status = sender.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should close connection gracefully', async () => {
      await sender.connect();
      await sender.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnectionModel.close).toHaveBeenCalled();
      expect(sender.isReady()).toBe(false);
    });

    it('should clear callbacks on close', async () => {
      await sender.connect();
      await sender.sendSMS('+15551234567', 'Test', undefined, vi.fn());

      expect(sender.getStatus().pendingCallbacks).toBe(1);

      await sender.close();

      expect(sender.getStatus().pendingCallbacks).toBe(0);
    });

    it('should handle close errors gracefully', async () => {
      await sender.connect();
      
      mockChannel.close.mockRejectedValueOnce(new Error('Close failed'));

      // Should not throw
      await expect(sender.close()).resolves.toBeUndefined();
    });
  });

  describe('reconnection logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should attempt to reconnect on connection failure', async () => {
      const sender = new RabbitMQSender({
        rabbitmqUrl: 'amqp://localhost:5672',
        queueName: 'sms_outbound',
        callbackQueue: 'sms_callbacks',
        reconnectDelayMs: 1000,
        maxReconnectAttempts: 3,
      });

      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(sender.connect()).rejects.toThrow();

      // First reconnect attempt
      mockConnect.mockResolvedValueOnce(mockConnectionModel);
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should stop reconnecting after max attempts', async () => {
      const sender = new RabbitMQSender({
        rabbitmqUrl: 'amqp://localhost:5672',
        queueName: 'sms_outbound',
        callbackQueue: 'sms_callbacks',
        reconnectDelayMs: 100,
        maxReconnectAttempts: 2,
      });

      mockConnect.mockRejectedValue(new Error('Connection failed'));

      await expect(sender.connect()).rejects.toThrow();

      // Attempt 1
      await vi.advanceTimersByTimeAsync(100);
      expect(mockConnect).toHaveBeenCalledTimes(2);

      // Attempt 2
      await vi.advanceTimersByTimeAsync(100);
      expect(mockConnect).toHaveBeenCalledTimes(3);

      // Should stop after max attempts
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnect).toHaveBeenCalledTimes(3);
    });
  });

  describe('E.164 validation', () => {
    let validationSender: RabbitMQSender;

    beforeEach(async () => {
      vi.clearAllMocks();
      
      // Reset mock to successful state
      mockConnect.mockResolvedValue(mockConnectionModel);
      mockConnectionModel.createChannel.mockResolvedValue(mockChannel);
      
      validationSender = new RabbitMQSender({
        rabbitmqUrl: 'amqp://localhost:5672',
        queueName: 'sms_outbound',
        callbackQueue: 'sms_callbacks',
      });
      await validationSender.connect();
    });

    afterEach(async () => {
      await validationSender.close();
    });

    it('should reject numbers without country code', async () => {
      const result = await validationSender.sendSMS('5551234567', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should reject numbers with leading zero in country code', async () => {
      const result = await validationSender.sendSMS('+05551234567', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should reject numbers exceeding 15 digits', async () => {
      const result = await validationSender.sendSMS('+12345678901234567', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should accept minimum valid E.164 number', async () => {
      const result = await validationSender.sendSMS('+123', 'Test');
      expect(result.success).toBe(true);
    });

    it('should accept maximum length E.164 number', async () => {
      const result = await validationSender.sendSMS('+123456789012345', 'Test');
      expect(result.success).toBe(true);
    });
  });
});
