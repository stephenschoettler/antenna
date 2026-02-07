# RabbitMQ SMS Sender for Antenna

This document describes the RabbitMQ-based SMS sender integration for Antenna, enabling bidirectional SMS communication through DekuSMS.

## Overview

The `RabbitMQSender` provides a production-ready SMS backend that communicates with DekuSMS via RabbitMQ. It includes:

- Connection pooling and automatic reconnection
- E.164 phone number validation
- Delivery receipt tracking
- Graceful error handling
- Message queuing with persistence

## Architecture

```
Antenna AutoResponder
    ↓
RabbitMQSender
    ↓
RabbitMQ (sms_outbound queue)
    ↓
DekuSMS
    ↓
RabbitMQ (sms_callbacks queue)
    ↓
RabbitMQSender (delivery receipts)
    ↓
QueueManager (status updates)
```

## Configuration

### antenna.config.yaml

```yaml
sms:
  provider: "dekusms"  # or "twilio"
  
  dekusms:
    rabbitmq_url: "amqp://localhost:5672"
    queue_name: "sms_outbound"
    callback_queue: "sms_callbacks"
  
  # Optional: Twilio fallback
  twilio:
    account_sid: "${TWILIO_ACCOUNT_SID}"
    auth_token: "${TWILIO_AUTH_TOKEN}"
    from_number: "${TWILIO_PHONE_NUMBER}"
```

### Environment Variables (Legacy Twilio)

If no `sms` section is present in the config, Antenna falls back to environment variables:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

## Usage

### Basic Usage

```typescript
import { RabbitMQSender } from './handlers/RabbitMQSender.js';

const sender = new RabbitMQSender({
  rabbitmqUrl: 'amqp://localhost:5672',
  queueName: 'sms_outbound',
  callbackQueue: 'sms_callbacks',
});

// Connect to RabbitMQ
await sender.connect();

// Send an SMS
const result = await sender.sendSMS(
  '+15551234567',  // E.164 formatted phone number
  'Hello from Antenna!'  // Message text
);

if (result.success) {
  console.log('SMS sent with ID:', result.messageId);
} else {
  console.error('Failed to send SMS:', result.error);
}

// Close connection when done
await sender.close();
```

### With Delivery Receipts

```typescript
const result = await sender.sendSMS(
  '+15551234567',
  'Hello!',
  undefined,  // Optional custom SID
  (receipt) => {
    console.log('Delivery status:', receipt.status);
    // receipt.status can be: 'sent', 'delivered', 'failed'
  }
);
```

### Integration with AutoResponder

```typescript
import { AutoResponder } from './handlers/AutoResponder.js';
import { QueueManager } from './handlers/QueueManager.js';
import { loadConfig } from './config/antenna.config.js';

const config = loadConfig();
const queueManager = new QueueManager();

// AutoResponder automatically uses the SMS config
const autoResponder = new AutoResponder(
  queueManager,
  config.sms ? {
    provider: config.sms.provider,
    dekusms: config.sms.dekusms ? {
      rabbitmqUrl: config.sms.dekusms.rabbitmq_url,
      queueName: config.sms.dekusms.queue_name,
      callbackQueue: config.sms.dekusms.callback_queue,
    } : undefined,
    twilio: config.sms.twilio ? {
      accountSid: config.sms.twilio.account_sid,
      authToken: config.sms.twilio.auth_token,
      fromNumber: config.sms.twilio.from_number,
    } : undefined,
  } : undefined
);

// Send SMS (automatically routed to configured provider)
const result = await autoResponder.sendSMS({
  to: '+15551234567',
  text: 'Automated response from Antenna',
});
```

## Message Format

### Outbound Message (to DekuSMS)

```json
{
  "sid": "unique-tracking-id",
  "id": "message-uuid",
  "to": "+15551234567",
  "text": "Message body"
}
```

### Delivery Receipt (from DekuSMS)

```json
{
  "type": "SMS_TYPE_STATUS",
  "status": "delivered",
  "sid": "unique-tracking-id"
}
```

Status values:
- `sent`: Message sent to carrier
- `delivered`: Message delivered to recipient
- `failed`: Delivery failed

## E.164 Phone Number Format

All phone numbers must be in E.164 format:

- **Valid**: `+15551234567` (US), `+447700900123` (UK), `+8613800138000` (China)
- **Invalid**: `5551234567` (missing +), `+05551234567` (leading zero), `invalid` (non-numeric)

Format: `+[country code][subscriber number]`
- Max length: 15 digits (including country code)
- Country code cannot start with 0

## Connection Management

### Auto-Reconnection

The RabbitMQSender automatically reconnects on connection loss:

```typescript
const sender = new RabbitMQSender({
  rabbitmqUrl: 'amqp://localhost:5672',
  queueName: 'sms_outbound',
  callbackQueue: 'sms_callbacks',
  reconnectDelayMs: 5000,        // Wait 5s between reconnect attempts
  maxReconnectAttempts: 10,       // Give up after 10 attempts
});
```

### Monitoring Connection Status

```typescript
const status = sender.getStatus();
console.log('Connected:', status.connected);
console.log('Reconnect attempts:', status.reconnectAttempts);
console.log('Pending callbacks:', status.pendingCallbacks);

// Quick check
if (sender.isReady()) {
  console.log('Ready to send messages');
}
```

## Error Handling

### Connection Errors

```typescript
try {
  await sender.connect();
} catch (err) {
  console.error('Failed to connect to RabbitMQ:', err.message);
  // Auto-reconnect will be scheduled
}
```

### Send Errors

```typescript
const result = await sender.sendSMS('+15551234567', 'Test');

if (!result.success) {
  switch (true) {
    case result.error?.includes('Invalid phone number'):
      // Handle validation error
      break;
    case result.error?.includes('Not connected'):
      // Handle connection error
      break;
    default:
      // Handle other errors
      console.error('Send failed:', result.error);
  }
}
```

### Queue Full Scenario

The sender handles RabbitMQ backpressure automatically:

```typescript
// If queue is full, sendSMS waits for drain event
const result = await sender.sendSMS('+15551234567', 'Test');
// Returns when message is queued or fails
```

## Testing

Run the test suite:

```bash
npm test tests/handlers/RabbitMQSender.test.ts
```

The tests use mocked amqplib and cover:
- Connection establishment and error handling
- Message sending and validation
- Delivery receipt processing
- Reconnection logic
- E.164 validation
- Edge cases and error scenarios

## Production Deployment

### Prerequisites

1. **RabbitMQ server** running and accessible
2. **DekuSMS** configured to:
   - Consume from `sms_outbound` queue
   - Publish delivery receipts to `sms_callbacks` queue

### Configuration Checklist

- [ ] RabbitMQ URL configured in `antenna.config.yaml`
- [ ] Queue names match DekuSMS configuration
- [ ] RabbitMQ user has permissions for both queues
- [ ] Network connectivity between Antenna and RabbitMQ
- [ ] QueueManager database initialized
- [ ] Logging/monitoring for delivery failures

### Performance Tuning

```typescript
const sender = new RabbitMQSender({
  rabbitmqUrl: 'amqp://rabbitmq.internal:5672',
  queueName: 'sms_outbound',
  callbackQueue: 'sms_callbacks',
  reconnectDelayMs: 3000,      // Faster reconnects in stable network
  maxReconnectAttempts: 20,     // More attempts for production
});
```

### Monitoring

Key metrics to monitor:
- `status.connected`: Connection health
- `status.reconnectAttempts`: Connection stability
- `status.pendingCallbacks`: Outstanding deliveries
- QueueManager stats: Message processing rates

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to RabbitMQ

**Solutions**:
1. Verify RabbitMQ is running: `rabbitmqctl status`
2. Check network connectivity: `telnet rabbitmq.host 5672`
3. Verify credentials in config
4. Check RabbitMQ logs: `/var/log/rabbitmq/`

### Delivery Receipts Not Received

**Problem**: Messages sent but no delivery callbacks

**Solutions**:
1. Verify DekuSMS is publishing to `sms_callbacks` queue
2. Check RabbitMQ queue stats: `rabbitmqctl list_queues`
3. Ensure callback queue name matches DekuSMS config
4. Check DekuSMS logs for errors

### E.164 Validation Failures

**Problem**: Phone numbers rejected

**Solutions**:
1. Ensure number starts with `+`
2. Verify country code (no leading zeros)
3. Check total length (max 15 digits)
4. Remove spaces, dashes, or other formatting

## License

MIT
