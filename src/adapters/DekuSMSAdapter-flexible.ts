import type { InboundMessage } from '../../../siphon-engine/src/types';

export class DekuSMSAdapter {
  parseWebhook(payload: any): InboundMessage {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload');
    }

    // Extract fields with fallbacks for real DekuSMS format
    const id = payload.id || payload.thread_id || Date.now();
    const address = payload.address;
    const text = payload.text || payload.body || '';
    const date = payload.date || payload.date_sent || Date.now();
    
    // Validate essentials
    if (!address) throw new Error('Missing required field: address');
    if (!text) throw new Error('Missing required field: text');

    // Parse timestamp
    const timestamp = typeof date === 'number' ? new Date(date) : new Date(date);

    return {
      id: `dekusms-${id}`,
      channel: 'sms',
      sender: address,
      content: text,
      timestamp,
      metadata: {
        threadId: payload.thread_id,
        type: payload.type,
        status: payload.status,
        isRead: payload.read === 1,
        isEncrypted: payload.is_encrypted === 1,
        tag: payload.tag,
        subscriptionId: payload.sub_id,
      },
    };
  }
}
