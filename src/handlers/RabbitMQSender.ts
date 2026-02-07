import type { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { connect } from 'amqplib';
import { randomUUID } from 'node:crypto';

export interface DekuSMSMessage {
  sid: string;
  id: string;
  to: string;
  text: string;
}

export interface DeliveryReceipt {
  type: 'SMS_TYPE_STATUS';
  status: 'sent' | 'delivered' | 'failed';
  sid: string;
}

export interface RabbitMQConfig {
  rabbitmqUrl: string;
  queueName: string;
  callbackQueue: string;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

type DeliveryCallback = (receipt: DeliveryReceipt) => void;

/**
 * RabbitMQSender handles SMS sending via DekuSMS through RabbitMQ
 * Includes connection pooling, retry logic, and delivery receipt handling
 */
export class RabbitMQSender {
  private config: RabbitMQConfig;
  private connectionModel: ChannelModel | undefined;
  private channel: Channel | undefined;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private deliveryCallbacks = new Map<string, DeliveryCallback>();
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: RabbitMQConfig) {
    this.config = {
      reconnectDelayMs: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  /**
   * Initialize connection to RabbitMQ and set up callback queue consumer
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      console.log('[RabbitMQSender] Already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      console.log(`[RabbitMQSender] Connecting to RabbitMQ at ${this.config.rabbitmqUrl}`);
      
      this.connectionModel = await connect(this.config.rabbitmqUrl);
      
      // Handle connection errors
      this.connectionModel.on('error', (err) => {
        console.error('[RabbitMQSender] Connection error:', err);
        this.handleDisconnect();
      });

      this.connectionModel.on('close', () => {
        console.warn('[RabbitMQSender] Connection closed');
        this.handleDisconnect();
      });

      // Create channel
      this.channel = await this.connectionModel.createChannel();
      
      // Handle channel errors
      this.channel.on('error', (err) => {
        console.error('[RabbitMQSender] Channel error:', err);
      });

      this.channel.on('close', () => {
        console.warn('[RabbitMQSender] Channel closed');
      });

      // Assert queues exist
      await this.channel.assertQueue(this.config.queueName, { durable: true });
      await this.channel.assertQueue(this.config.callbackQueue, { durable: true });

      // Start consuming delivery receipts
      await this.setupDeliveryReceiptListener();

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      console.log('[RabbitMQSender] Successfully connected to RabbitMQ');
    } catch (err) {
      this.isConnecting = false;
      const error = err as Error;
      console.error('[RabbitMQSender] Failed to connect:', error);
      
      // Schedule reconnection
      this.scheduleReconnect();
      throw new Error(`Failed to connect to RabbitMQ: ${error.message}`);
    }
  }

  /**
   * Set up listener for delivery receipts from DekuSMS
   */
  private async setupDeliveryReceiptListener(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    console.log(`[RabbitMQSender] Setting up delivery receipt listener on ${this.config.callbackQueue}`);

    await this.channel.consume(
      this.config.callbackQueue,
      (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const receipt = JSON.parse(msg.content.toString()) as DeliveryReceipt;
          
          console.log(`[RabbitMQSender] Received delivery receipt:`, receipt);

          // Call the registered callback for this SID
          const callback = this.deliveryCallbacks.get(receipt.sid);
          if (callback) {
            callback(receipt);
            
            // Remove callback after processing
            // Keep it for a bit in case of duplicates
            setTimeout(() => {
              this.deliveryCallbacks.delete(receipt.sid);
            }, 60000); // Clean up after 1 minute
          } else {
            console.warn(`[RabbitMQSender] No callback registered for SID: ${receipt.sid}`);
          }

          // Acknowledge the message
          this.channel?.ack(msg);
        } catch (err) {
          console.error('[RabbitMQSender] Failed to process delivery receipt:', err);
          
          // Reject and requeue on parsing errors
          this.channel?.nack(msg, false, true);
        }
      },
      { noAck: false }
    );
  }

  /**
   * Handle disconnection and schedule reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.channel = undefined;
    this.connectionModel = undefined;
    
    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('[RabbitMQSender] Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelayMs || 5000;

    console.log(
      `[RabbitMQSender] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch((err) => {
        console.error('[RabbitMQSender] Reconnect failed:', err);
      });
    }, delay);
  }

  /**
   * Validate E.164 phone number format
   */
  private validateE164(phoneNumber: string): boolean {
    // E.164 format: +[country code][subscriber number]
    // Max length: 15 digits (including country code)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Send an SMS message via DekuSMS
   */
  async sendSMS(
    to: string,
    text: string,
    sid?: string,
    onDelivery?: DeliveryCallback
  ): Promise<SendResult> {
    // Validate phone number format
    if (!this.validateE164(to)) {
      const error = `Invalid phone number format: ${to}. Must be E.164 format (e.g., +15551234567)`;
      console.error(`[RabbitMQSender] ${error}`);
      return { success: false, error };
    }

    // Ensure connection
    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (err) {
        return {
          success: false,
          error: `Not connected to RabbitMQ: ${(err as Error).message}`,
        };
      }
    }

    if (!this.channel) {
      return {
        success: false,
        error: 'RabbitMQ channel not available',
      };
    }

    // Generate message ID and SID
    const messageId = randomUUID();
    const messageSid = sid || randomUUID();

    // Create DekuSMS message
    const message: DekuSMSMessage = {
      sid: messageSid,
      id: messageId,
      to,
      text,
    };

    try {
      // Register delivery callback if provided
      if (onDelivery) {
        this.deliveryCallbacks.set(messageSid, onDelivery);
        
        // Auto-cleanup after 5 minutes if no receipt received
        setTimeout(() => {
          if (this.deliveryCallbacks.has(messageSid)) {
            console.warn(`[RabbitMQSender] No delivery receipt received for SID ${messageSid} after 5 minutes`);
            this.deliveryCallbacks.delete(messageSid);
          }
        }, 300000);
      }

      // Send to RabbitMQ queue
      const sent = this.channel.sendToQueue(
        this.config.queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true, // Ensure message survives broker restarts
          contentType: 'application/json',
        }
      );

      if (!sent) {
        // Queue is full, need to wait for drain
        console.warn('[RabbitMQSender] Queue is full, waiting for drain...');
        
        return new Promise((resolve) => {
          this.channel?.once('drain', () => {
            console.log('[RabbitMQSender] Queue drained, message sent');
            resolve({
              success: true,
              messageId: messageSid,
            });
          });
        });
      }

      console.log(`[RabbitMQSender] SMS sent to ${to} (SID: ${messageSid}, ID: ${messageId})`);

      return {
        success: true,
        messageId: messageSid,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[RabbitMQSender] Failed to send SMS:', error);
      
      // Clean up callback on error
      if (onDelivery) {
        this.deliveryCallbacks.delete(messageSid);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if connected to RabbitMQ
   */
  isReady(): boolean {
    return this.isConnected && !!this.channel;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    pendingCallbacks: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      pendingCallbacks: this.deliveryCallbacks.size,
    };
  }

  /**
   * Gracefully close the connection
   */
  async close(): Promise<void> {
    console.log('[RabbitMQSender] Closing connection...');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Clear delivery callbacks
    this.deliveryCallbacks.clear();

    // Close channel and connection
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = undefined;
      }

      if (this.connectionModel) {
        await this.connectionModel.close();
        this.connectionModel = undefined;
      }

      this.isConnected = false;
      console.log('[RabbitMQSender] Connection closed successfully');
    } catch (err) {
      console.error('[RabbitMQSender] Error closing connection:', err);
    }
  }
}
