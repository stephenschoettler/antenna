/**
 * DekuSMSAdapter - Convert DekuSMS webhook payloads to InboundMessage format
 */

import type { InboundMessage } from '../../../siphon-engine/src/types';

export interface DekuSMSPayload {
  id: number;
  message_id: string;
  thread_id: string;
  date: string;
  date_sent: string;
  type: number;
  num_segments: number;
  subscription_id: number;
  status: number;
  error_code: number;
  read: number;
  is_encrypted: number;
  formatted_date: string;
  address: string;
  text: string;
  data: string;
}

export interface ParsedDekuSMSMessage extends InboundMessage {
  metadata: {
    messageId: string;
    threadId: string;
    type: number;
    numSegments: number;
    subscriptionId: number;
    status: number;
    errorCode: number;
    isRead: boolean;
    isEncrypted: boolean;
    rawDate: string;
    dateSent: string;
    data?: string;
  };
}

export class DekuSMSAdapterError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = 'DekuSMSAdapterError';
  }
}

/**
 * DekuSMS webhook adapter
 */
export class DekuSMSAdapter {
  /**
   * Parse a DekuSMS webhook payload into an InboundMessage
   */
  parseWebhook(payload: unknown): ParsedDekuSMSMessage {
    // Validate payload is an object (not null, not array)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new DekuSMSAdapterError(
        'Invalid payload: expected object',
        undefined,
        payload
      );
    }

    const data = payload as Partial<DekuSMSPayload>;

    // Validate required fields
    this.validateRequiredFields(data);

    // Handle encrypted messages
    if (data.is_encrypted === 1) {
      throw new DekuSMSAdapterError(
        'Encrypted messages are not supported',
        'is_encrypted',
        payload
      );
    }

    // Parse timestamp from formatted_date
    const timestamp = this.parseTimestamp(data.formatted_date!);

    // Build InboundMessage
    const message: ParsedDekuSMSMessage = {
      id: this.generateMessageId(data),
      channel: 'sms',
      sender: this.normalizeSender(data.address!),
      content: data.text || '',
      timestamp,
      metadata: {
        messageId: data.message_id!,
        threadId: data.thread_id!,
        type: data.type!,
        numSegments: data.num_segments!,
        subscriptionId: data.subscription_id!,
        status: data.status!,
        errorCode: data.error_code!,
        isRead: data.read === 1,
        isEncrypted: data.is_encrypted === 1,
        rawDate: data.date!,
        dateSent: data.date_sent!,
        ...(data.data && { data: data.data }),
      },
    };

    return message;
  }

  /**
   * Validate required fields in the payload
   */
  private validateRequiredFields(data: Partial<DekuSMSPayload>): void {
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

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        throw new DekuSMSAdapterError(
          `Missing required field: ${field}`,
          field,
          data
        );
      }
    }

    // Validate field types
    this.validateFieldTypes(data as DekuSMSPayload);
  }

  /**
   * Validate field types match expected schema
   */
  private validateFieldTypes(data: DekuSMSPayload): void {
    // Validate numeric fields
    const numericFields: Array<keyof DekuSMSPayload> = [
      'id',
      'type',
      'num_segments',
      'subscription_id',
      'status',
      'error_code',
      'read',
      'is_encrypted',
    ];

    for (const field of numericFields) {
      if (typeof data[field] !== 'number') {
        throw new DekuSMSAdapterError(
          `Invalid type for ${field}: expected number, got ${typeof data[field]}`,
          field,
          data
        );
      }
    }

    // Validate string fields
    const stringFields: Array<keyof DekuSMSPayload> = [
      'message_id',
      'thread_id',
      'date',
      'date_sent',
      'formatted_date',
      'address',
      'text',
      'data',
    ];

    for (const field of stringFields) {
      if (typeof data[field] !== 'string') {
        throw new DekuSMSAdapterError(
          `Invalid type for ${field}: expected string, got ${typeof data[field]}`,
          field,
          data
        );
      }
    }

    // Validate address is not empty
    if (!data.address.trim()) {
      throw new DekuSMSAdapterError(
        'Invalid address: cannot be empty',
        'address',
        data
      );
    }
  }

  /**
   * Parse timestamp from formatted_date string
   * Expected format: varies by DekuSMS config, handle multiple formats
   */
  private parseTimestamp(formattedDate: string): Date {
    if (!formattedDate || !formattedDate.trim()) {
      throw new DekuSMSAdapterError(
        'Invalid formatted_date: cannot be empty',
        'formatted_date'
      );
    }

    const timestamp = new Date(formattedDate);

    if (Number.isNaN(timestamp.getTime())) {
      throw new DekuSMSAdapterError(
        `Invalid formatted_date: could not parse "${formattedDate}"`,
        'formatted_date'
      );
    }

    return timestamp;
  }

  /**
   * Generate a unique message ID from DekuSMS data
   * Format: dekusms-{id}-{message_id}
   */
  private generateMessageId(data: Partial<DekuSMSPayload>): string {
    return `dekusms-${data.id}-${data.message_id}`;
  }

  /**
   * Normalize sender address (phone number)
   * - Remove whitespace
   * - Ensure consistent format
   */
  private normalizeSender(address: string): string {
    return address.trim().replace(/\s+/g, '');
  }
}

/**
 * Factory function for easy initialization
 */
export function createDekuSMSAdapter(): DekuSMSAdapter {
  return new DekuSMSAdapter();
}
