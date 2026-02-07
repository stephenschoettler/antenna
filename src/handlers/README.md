# Antenna Handlers

Production-ready output handlers for intelligent message routing and processing.

## Overview

The Antenna handlers provide a complete message routing and notification system with:

- **QueueManager**: SQLite-based persistent message queue with priority and status tracking
- **TelegramNotifier**: Formatted Telegram notifications with urgency indicators and threading support
- **AutoResponder**: Automated SMS and email responses with template support
- **RoutingHandler**: Intelligent message routing with customizable rules

## Architecture

```
Incoming Message
       ↓
RoutingHandler (applies routing rules)
       ↓
    ┌──────────────┬──────────────┬──────────────┐
    ↓              ↓              ↓              ↓
  notify         queue      auto-respond      ignore
    ↓              ↓              ↓              ↓
Telegram       QueueManager   AutoResponder   (logged)
```

## Quick Start

```typescript
import {
  QueueManager,
  TelegramNotifier,
  AutoResponder,
  RoutingHandler,
} from './handlers/index.js';

// Initialize handlers
const queueManager = new QueueManager();
const telegramNotifier = new TelegramNotifier();
const autoResponder = new AutoResponder(queueManager);
const messageProcessor = new RoutingHandler(
  queueManager,
  telegramNotifier,
  autoResponder
);

// Process a message
const result = await messageProcessor.process({
  sender: '+1234567890',
  content: 'URGENT: Need help!',
  channel: 'sms',
});

console.log(`Routed as ${result.priority} to ${result.action}`);
```

## QueueManager

### Features

- SQLite-based persistent storage with WAL mode
- Priority levels: urgent, high, normal, low
- Status tracking: pending, processing, resolved, failed
- Routing actions: notify, queue, auto-respond, ignore
- Full-text search and filtering capabilities
- Automatic timestamp tracking

### Usage

```typescript
const queueManager = new QueueManager('/path/to/database.db');

// Add a message
const messageId = queueManager.addToQueue(
  'Message content',
  'high',        // priority
  'notify',      // routing action
  '+1234567890', // sender
  { metadata: 'custom data' }
);

// Retrieve messages
const pending = queueManager.getQueue({ 
  status: 'pending',
  priority: 'urgent',
  limit: 10 
});

// Update status
queueManager.markProcessing(messageId);
queueManager.markResolved(messageId);

// Get statistics
const stats = queueManager.getStats();
// { total: 100, pending: 25, processing: 5, resolved: 65, failed: 5 }
```

## TelegramNotifier

### Features

- Priority emoji indicators (🔴 urgent, 🟡 high, 🟢 normal, ⚪ low)
- Markdown formatting with automatic escaping
- Thread/topic support
- Reply-to message support
- Silent notifications for low-priority messages
- Batch sending with rate limiting

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Usage

```typescript
const notifier = new TelegramNotifier();

// Send a notification
await notifier.sendNotification({
  sender: '+1234567890',
  content: 'Important message',
  priority: 'high',
  timestamp: Date.now(),
  messageId: 123
});

// Send with threading
await notifier.sendNotification(message, {
  threadId: 456,
  replyToMessageId: 789
});

// Send batch
const messages = [/* array of messages */];
const { sent, failed } = await notifier.sendBatch(messages);
```

## AutoResponder

### Features

- SMS via Twilio
- Email via SMTP
- Template variable substitution
- Automatic queue tracking
- Channel-agnostic response interface

### Environment Variables

```bash
# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
EMAIL_FROM=noreply@example.com
```

### Usage

```typescript
const responder = new AutoResponder(queueManager);

// Send SMS
await responder.sendResponse({
  to: '+1234567890',
  text: 'Your message has been received.'
}, 'sms');

// Send Email
await responder.sendResponse({
  to: 'user@example.com',
  text: 'Your request is being processed.',
  subject: 'Request Received'
}, 'email');

// Templated response
await responder.sendTemplatedResponse(
  '+1234567890',
  'Hello {{name}}, your order {{orderId}} is ready!',
  { name: 'John', orderId: '12345' },
  'sms'
);

// Check status
const status = responder.getStatus();
// { sms: true, email: true }
```

## RoutingHandler

### Features

- Rule-based message routing
- Default rules for common patterns:
  - Emergency keywords → urgent + notify
  - Important keywords → high + notify
  - Questions → normal + queue
  - Spam patterns → low + ignore
- Custom rule support
- Batch processing
- Comprehensive statistics

### Usage

```typescript
const processor = new RoutingHandler(
  queueManager,
  telegramNotifier,
  autoResponder
);

// Process a message
const result = await processor.process({
  sender: '+1234567890',
  content: 'URGENT: Server down!',
  channel: 'sms',
  metadata: { source: 'twilio' }
});

// Add custom rule
processor.addRule({
  condition: (msg) => msg.sender === '+9999999999',
  priority: 'high',
  action: 'notify'
});

// Add auto-response rule
processor.addRule({
  condition: (msg) => msg.content.toLowerCase().includes('hours'),
  priority: 'normal',
  action: 'auto-respond',
  autoResponse: {
    template: 'Our hours are 9am-5pm EST. We received your message.',
    channel: 'sms'
  }
});

// Get pending messages
const pending = processor.getPendingMessages(10);

// Get statistics
const stats = processor.getStats();
```

## Default Routing Rules

1. **Emergency Detection** (`urgent` + `notify`)
   - Keywords: urgent, emergency, 911, help, asap, critical

2. **Important Detection** (`high` + `notify`)
   - Keywords: important, priority, deadline, tomorrow

3. **Question Detection** (`normal` + `queue`)
   - Ends with `?` or starts with `can you`

4. **Spam Detection** (`low` + `ignore`)
   - Keywords: free, win, prize, click here, unsubscribe

5. **Default** (`normal` + `queue`)
   - All other messages

## Testing

Run the test suite:

```bash
pnpm test
```

Run with coverage:

```bash
pnpm test:coverage
```

### Test Files

- `QueueManager.test.ts`: Database operations and filtering
- `TelegramNotifier.test.ts`: Notification formatting (mocked API)
- `AutoResponder.test.ts`: SMS and email sending (mocked)
- `RoutingHandler.test.ts`: Routing logic and rule matching

## Error Handling

All handlers implement comprehensive error handling:

- Failed operations are logged with full context
- Errors are returned in structured format
- Database failures don't crash the application
- API failures mark messages as `failed` in the queue
- Graceful degradation when credentials are missing

## Database Schema

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'resolved', 'failed')),
  timestamp INTEGER NOT NULL,
  routing_action TEXT NOT NULL CHECK(routing_action IN ('notify', 'queue', 'auto-respond', 'ignore')),
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

## Production Considerations

1. **Database Location**: Default is `./data/antenna.db`. Configure via constructor.
2. **Rate Limiting**: Telegram batch operations include 100ms delay between messages.
3. **Credentials**: All credentials via environment variables. Missing credentials disable the handler.
4. **Logging**: Structured console logging for all operations.
5. **Graceful Shutdown**: Call `queueManager.close()` on SIGTERM/SIGINT.

## Examples

See `src/server.ts` for a complete integration example with Express webhooks.

## License

MIT
