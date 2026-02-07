# Antenna Webhook Server

**Intelligent message routing and triage system for SMS, email, and more.**

Antenna is a production-ready webhook server that processes incoming messages through an AI-powered triage engine, routing them intelligently based on sender priority, content urgency, and custom rules.

## Features

- **Smart Triage**: VIP detection, urgency scoring, and intelligent routing via Siphon Engine
- **Multiple Channels**: SMS (Twilio, DekuSMS), Email (SendGrid, Mailgun), extensible to Slack, Telegram, etc.
- **Flexible Routing**: Notify, queue, auto-respond, or ignore based on configurable rules
- **Telegram Integration**: Instant notifications for urgent messages with rich formatting
- **Persistent Queue**: SQLite-based message queue with priority and status tracking
- **Auto-Responses**: Template-based or AI-powered responses (Claude integration)
- **RabbitMQ Support**: Bidirectional SMS via DekuSMS gateway
- **TypeScript**: Full type safety with strict typing throughout

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Message Flow Overview                       │
└────────────────────────────────────────────────────────────────┘

Inbound Messages
  ├─ SMS (Twilio, DekuSMS)
  ├─ Email (SendGrid, Mailgun)
  └─ [Extensible: Slack, Discord, etc.]
         ↓
    Webhook Handlers
         ↓
  Convert to InboundMessage
         ↓
   MessageProcessor
    (Siphon Engine)
         ↓
    VIP Detection
    Urgency Scoring
    Routing Decision
         ↓
   ┌─────┴──────┬─────────────┬─────────────┐
   ↓            ↓             ↓             ↓
 NOTIFY       QUEUE    AUTO-RESPOND      IGNORE
   ↓            ↓             ↓             ↓
Telegram    SQLite DB    RabbitMQ       (logged)
(instant)   (review)     DekuSMS
                         (SMS reply)


Outbound SMS Flow (DekuSMS)
API/Command → RabbitMQ → DekuSMS → Cellular Network → Delivery Receipt
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy and edit configuration
cp .env.example .env
nano antenna.config.yaml

# Start development server
npm run dev

# Or production
npm start
```

Server runs on `http://localhost:3000` (or PORT from .env)

## Configuration

Create `antenna.config.yaml`:

```yaml
# VIP contacts with tiered priority
vips:
  tier1:  # Critical contacts
    - "+15551234567"
    - "ceo@company.com"
  tier2:  # Important contacts
    - "+15559876543"
    - "team@company.com"
  tier3: "default"  # Everyone else

# Urgency thresholds (0-100 score)
thresholds:
  urgent: 75   # Immediate Telegram notification
  high: 50     # Notify soon
  normal: 25   # Queue for review

# AI persona for responses
persona: "Babbage"

# LLM provider (template or claude)
llm:
  provider: "template"
  # apiKey: "${ANTHROPIC_API_KEY}"  # For Claude
  # model: "claude-3-5-sonnet-20241022"
```

Create `.env`:

```bash
# Telegram notifications
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# RabbitMQ (for DekuSMS bidirectional SMS)
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Twilio (optional, for direct SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SMTP (optional, for email responses)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
EMAIL_FROM=noreply@example.com

# Anthropic (optional, for AI responses)
ANTHROPIC_API_KEY=sk-ant-...

# Server
PORT=3000
NODE_ENV=production
```

## DekuSMS Integration

**Turn your Android phone into an intelligent SMS gateway!**

DekuSMS is an open-source Android app that forwards SMS to Antenna via webhooks and sends replies via RabbitMQ. Perfect for:

- Personal SMS automation and triage
- Business SMS handling without expensive APIs
- Privacy-focused SMS control (your phone, your data)
- Bidirectional SMS without third-party services

### Quick Setup

1. **Install DekuSMS** from [F-Droid](https://f-droid.org/packages/com.afkanerd.deku/)
2. **Configure webhook**: `https://your-antenna-server/webhooks/dekusms`
3. **Set up RabbitMQ gateway** in DekuSMS settings
4. **Add webhook handler** to Antenna (see [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md))

📖 **Full Guide**: [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)  
🚀 **Quick Start**: [QUICK_START.md](QUICK_START.md)

### Example: VIP SMS Flow

```
1. Your boss texts: "URGENT: Need the Q4 report"
2. DekuSMS → Antenna webhook
3. Antenna detects VIP + "URGENT" keyword
4. Routes as urgent → Telegram notification
5. You reply via Antenna → RabbitMQ → DekuSMS → SMS sent
```

## Endpoints

### POST /webhooks/sms
Twilio SMS webhook handler.

**Request**:
```json
{
  "MessageSid": "SM...",
  "From": "+15551234567",
  "To": "+15559999999",
  "Body": "Message text",
  "NumMedia": "0"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Webhook processed",
  "action": {
    "type": "notify",
    "priority": "urgent",
    "hasResponse": true
  }
}
```

### POST /webhooks/email
Email webhook handler (SendGrid/Mailgun format).

**Request**:
```json
{
  "from": "sender@example.com",
  "to": "receiver@example.com",
  "subject": "Important message",
  "text": "Email body",
  "html": "<p>Email body</p>"
}
```

### POST /webhooks/dekusms
DekuSMS SMS webhook handler.

**Request**:
```json
{
  "messageId": "msg-123",
  "from": "+15551234567",
  "message": "SMS text",
  "timestamp": "2026-02-06T21:45:00Z"
}
```

### GET /health
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-02-06T21:45:00Z"
}
```

### POST /admin/reload-config
Reload configuration from `antenna.config.yaml` without restarting.

## Usage Examples

### Process a Message Manually

```typescript
import { createMessageProcessor } from './processors/MessageProcessor';

const processor = createMessageProcessor();

const action = await processor.processInbound({
  id: 'msg-123',
  channel: 'sms',
  sender: '+15551234567',
  content: 'URGENT: Need help!',
  timestamp: new Date(),
});

console.log(`Routed as ${action.type} with priority ${action.priority}`);
// Output: "Routed as notify with priority urgent"
```

### Add Custom Routing Rule

```typescript
import { RoutingHandler } from './handlers/RoutingHandler';

const router = new RoutingHandler(queueManager, telegramNotifier, autoResponder);

router.addRule({
  condition: (msg) => msg.sender === '+15559999999',
  priority: 'high',
  action: 'notify',
});

router.addRule({
  condition: (msg) => msg.content.toLowerCase().includes('hours'),
  priority: 'normal',
  action: 'auto-respond',
  autoResponse: {
    template: 'Our hours are 9am-5pm EST. We received your message.',
    channel: 'sms',
  },
});
```

### Check Message Queue

```typescript
const pendingMessages = queueManager.getQueue({
  status: 'pending',
  priority: 'urgent',
  limit: 10,
});

const stats = queueManager.getStats();
console.log(`Total: ${stats.total}, Pending: ${stats.pending}`);
```

## Documentation

- **[INTEGRATION.md](INTEGRATION.md)**: Siphon Engine integration architecture
- **[DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)**: Complete DekuSMS + Antenna guide
- **[QUICK_START.md](QUICK_START.md)**: Get started in 10 minutes
- **[src/handlers/README.md](src/handlers/README.md)**: Handler documentation (QueueManager, TelegramNotifier, AutoResponder, RoutingHandler)

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

Test files:
- `src/processors/MessageProcessor.test.ts`
- `src/handlers/QueueManager.test.ts`
- `src/handlers/TelegramNotifier.test.ts`
- `src/handlers/AutoResponder.test.ts`
- `src/handlers/RoutingHandler.test.ts`

## Deployment

### Docker

```bash
docker build -t antenna .
docker run -p 3000:3000 \
  -v $(pwd)/antenna.config.yaml:/app/antenna.config.yaml \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  antenna
```

### Docker Compose

See [docker-compose.yml](docker-compose.yml) for a complete setup with RabbitMQ.

```bash
docker-compose up -d
```

### PM2

```bash
npm install -g pm2
pm2 start npm --name antenna -- start
pm2 save
pm2 startup
```

### systemd

```ini
[Unit]
Description=Antenna Webhook Server
After=network.target

[Service]
Type=simple
User=antenna
WorkingDirectory=/opt/antenna
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Production Checklist

- [ ] Use HTTPS (Let's Encrypt recommended)
- [ ] Set up webhook authentication (shared secrets)
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Monitor health endpoint
- [ ] Configure log rotation
- [ ] Set up alerting (via Telegram or other)
- [ ] Review and customize VIP lists
- [ ] Test all routing rules
- [ ] Verify Telegram notifications
- [ ] Test auto-response templates

## Roadmap

- [ ] Web dashboard for queue management
- [ ] Slack integration
- [ ] Discord integration
- [ ] WhatsApp Business API support
- [ ] GraphQL API
- [ ] Metrics and observability (Prometheus/Grafana)
- [ ] Multi-tenant support
- [ ] Message threading and conversation tracking
- [ ] Advanced ML-based urgency detection
- [ ] Custom webhook transformers

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - see LICENSE file for details.
