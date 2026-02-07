# DekuSMS + Antenna Integration Guide

## Overview

**DekuSMS + Antenna = Your Personal SMS Control Center**

This integration transforms your Android phone into an intelligent SMS gateway that routes messages through Antenna's AI-powered triage engine. Get instant Telegram notifications for VIP contacts, auto-respond to common questions, and queue everything else for review—all while maintaining complete control over your SMS communications.

### Why This Integration?

- **Smart Routing**: VIP contacts get immediate Telegram notifications; colleagues get auto-responses; spam gets queued
- **AI-Powered Triage**: Antenna's Siphon Engine analyzes urgency and routes messages intelligently
- **Bidirectional Control**: Send SMS replies directly from Antenna or your preferred interface
- **Privacy-First**: Your messages stay on your infrastructure (no third-party SMS APIs required)
- **Production-Ready**: Built for reliability with persistent queues, delivery receipts, and comprehensive error handling

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SMS Flow                                  │
└─────────────────────────────────────────────────────────────────────┘

Android Phone (DekuSMS)
  ├─ Receives SMS
  ├─ Sends webhooks → https://your-antenna-server/webhooks/dekusms
  └─ Listens on RabbitMQ for outbound SMS commands
           ↓
           ↓ HTTP POST (webhook)
           ↓
    Antenna Server
      ├─ Webhook Handler (/webhooks/dekusms)
      ├─ MessageProcessor (Siphon Engine integration)
      ├─ VIP Detection & Urgency Scoring
      └─ Routing Decision
           ↓
      ┌────┴─────┬──────────────┬──────────────┐
      ↓          ↓              ↓              ↓
   NOTIFY      QUEUE      AUTO-RESPOND      IGNORE
      ↓          ↓              ↓              ↓
  Telegram   SQLite DB    RabbitMQ →      (logged)
  (instant)  (review      DekuSMS
             later)       (auto-reply)


┌─────────────────────────────────────────────────────────────────────┐
│                      Outbound SMS Flow                              │
└─────────────────────────────────────────────────────────────────────┘

Antenna Command/API
  ↓
RabbitMQ Message
  ├─ queue: sms.outbound
  ├─ to: +1234567890
  └─ message: "Reply text"
  ↓
DekuSMS (listening on RabbitMQ)
  ↓
Send SMS via Android
  ↓
Delivery Receipt → RabbitMQ → Antenna
```

## Prerequisites

### Required Components

1. **Android Device**
   - Android 5.0+ (API level 21+)
   - Active cellular service with SMS capability
   - Internet connectivity (WiFi or cellular data)

2. **DekuSMS Application**
   - Install from [F-Droid](https://f-droid.org/packages/com.afkanerd.deku/) or [GitHub Releases](https://github.com/deku-messaging/Deku-SMS-Android/releases)
   - Version 0.50.0 or later recommended

3. **Antenna Server**
   - Running on a publicly accessible server or via Tailscale
   - Node.js 18+ environment
   - HTTPS endpoint (required for production webhooks)

4. **RabbitMQ Server**
   - Version 3.8+ (local or cloud-hosted)
   - AMQP port accessible from both Antenna and Android device
   - Management plugin enabled (recommended)

5. **Telegram Bot** (for notifications)
   - Bot token from [@BotFather](https://t.me/botfather)
   - Chat ID where notifications should be sent

### Optional but Recommended

- **Tailscale**: Secure private network for connecting Android, Antenna, and RabbitMQ
- **Cloudflare Tunnel** or **ngrok**: For exposing Antenna webhooks if not using Tailscale
- **Supervisor** or **systemd**: For running Antenna as a service
- **Docker**: For simplified RabbitMQ deployment

## Installation

### Step 1: Install DekuSMS on Android

#### Option A: F-Droid (Recommended)

```bash
# On your Android device:
1. Install F-Droid from https://f-droid.org
2. Search for "DekuSMS" or "Deku SMS"
3. Install the application
4. Grant SMS permissions when prompted
```

#### Option B: GitHub Releases

```bash
1. Download the latest APK from:
   https://github.com/deku-messaging/Deku-SMS-Android/releases
2. Enable "Install from Unknown Sources" in Android Settings
3. Install the APK
4. Grant SMS permissions
```

### Step 2: Configure DekuSMS Cloud Forwarding

DekuSMS supports webhook forwarding to send incoming SMS to Antenna in real-time.

1. **Open DekuSMS** on your Android device
2. Navigate to **Settings → Cloud Forwarding**
3. Enable **Cloud Forwarding**
4. Set **Webhook URL**:
   ```
   https://your-antenna-server.example.com/webhooks/dekusms
   ```
   - For Tailscale: `https://antenna-host.tailnet-name.ts.net/webhooks/dekusms`
   - For local testing: `http://192.168.1.100:3000/webhooks/dekusms`
5. Set **Webhook Method**: `POST`
6. Enable **Send on Receive** (forwards incoming SMS immediately)
7. **Test** the webhook (DekuSMS will send a test payload)

### Step 3: Configure RabbitMQ Gateway in DekuSMS

For bidirectional SMS (sending replies from Antenna), configure the RabbitMQ gateway.

1. **Open DekuSMS → Settings → Gateway**
2. Enable **Gateway Mode**
3. Set **Gateway Type**: `RabbitMQ`
4. Configure connection:
   ```
   Host: your-rabbitmq-server.example.com
   Port: 5672
   Username: deku_user
   Password: your_secure_password
   Virtual Host: / (or your custom vhost)
   ```
5. Set **Inbound Queue**: `sms.inbound` (SMS delivery receipts)
6. Set **Outbound Queue**: `sms.outbound` (commands from Antenna)
7. Enable **Auto-reconnect**
8. **Test Connection**

### Step 4: Configure Antenna Server

#### 4.1 Clone and Install Antenna

```bash
cd /opt
git clone https://github.com/yourusername/antenna.git
cd antenna
npm install
```

#### 4.2 Create Configuration File

Create `antenna.config.yaml`:

```yaml
# VIP tier definitions
vips:
  tier1:
    - "+15551234567"    # Your most critical contacts
    - "+15559876543"    # Emergency contacts
    
  tier2:
    - "+15555555555"    # Important colleagues
    - "+15554444444"    # Key clients
    
  tier3: "default"      # Everyone else

# Urgency thresholds (0-100 score)
thresholds:
  urgent: 75   # Immediate Telegram notification
  high: 50     # Notify soon
  normal: 25   # Queue for review

# AI persona for auto-responses
persona: "Babbage"

# LLM provider (template or claude)
llm:
  provider: "template"  # Use "claude" for AI-powered responses
  # apiKey: "${ANTHROPIC_API_KEY}"  # Required for Claude
  # model: "claude-3-5-sonnet-20241022"

# RabbitMQ configuration
rabbitmq:
  host: "localhost"
  port: 5672
  username: "deku_user"
  password: "your_secure_password"
  vhost: "/"
  queues:
    inbound: "sms.inbound"
    outbound: "sms.outbound"
```

#### 4.3 Set Environment Variables

Create `.env`:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# RabbitMQ (if not in config file)
RABBITMQ_URL=amqp://deku_user:your_secure_password@localhost:5672

# Anthropic (optional, for AI responses)
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### 4.4 Add DekuSMS Webhook Handler

Create `src/webhooks/dekusms.ts`:

```typescript
import type { Request, Response } from 'express';
import { MessageProcessor } from '../processors/MessageProcessor';
import type { InboundMessage } from '../index';

const processor = new MessageProcessor();

export async function handleDekuSMS(req: Request, res: Response) {
  try {
    const { from, message, timestamp, messageId } = req.body;

    // Validate required fields
    if (!from || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, message'
      });
    }

    // Convert to InboundMessage format
    const inboundMessage: InboundMessage = {
      id: messageId || `sms-${Date.now()}`,
      channel: 'sms',
      sender: from,
      content: message,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: {
        source: 'dekusms',
        rawPayload: req.body
      }
    };

    // Process through Siphon Engine
    const action = await processor.processInbound(inboundMessage);

    console.log(`[DekuSMS] Processed message from ${from}: ${action.type} (${action.priority})`);

    res.json({
      success: true,
      message: 'SMS received and processed',
      action: {
        type: action.type,
        priority: action.priority,
        hasResponse: !!action.response
      }
    });
  } catch (error) {
    console.error('[DekuSMS] Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

Register the webhook in `src/server.ts`:

```typescript
import { handleDekuSMS } from './webhooks/dekusms';

// ... existing code ...

app.post('/webhooks/dekusms', handleDekuSMS);
```

### Step 5: Start Antenna Server

```bash
# Development
npm run dev

# Production (with PM2)
npm install -g pm2
pm2 start npm --name "antenna" -- start
pm2 save
pm2 startup
```

### Step 6: Verify the Integration

#### Test 1: Send a Test SMS to Your Phone

Send an SMS from another phone to your DekuSMS device. Check:

1. **DekuSMS logs**: Webhook should show successful POST
2. **Antenna logs**: Should show received webhook and routing decision
3. **Telegram**: If sender is a VIP, you should receive a notification
4. **Queue**: Check `data/antenna.db` for queued messages

```bash
# Check queue
sqlite3 data/antenna.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;"
```

#### Test 2: Send an Outbound SMS

```bash
# Using RabbitMQ CLI tools
rabbitmqadmin publish exchange=amq.default routing_key=sms.outbound \
  payload='{"to":"+15551234567","message":"Test reply from Antenna"}'

# Or using Node.js client
node -e "
const amqp = require('amqplib');
(async () => {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();
  await ch.assertQueue('sms.outbound');
  ch.sendToQueue('sms.outbound', Buffer.from(JSON.stringify({
    to: '+15551234567',
    message: 'Test reply from Antenna'
  })));
  console.log('Sent message to queue');
  await ch.close();
  await conn.close();
})();
"
```

DekuSMS should send the SMS and post a delivery receipt to `sms.inbound`.

## Usage Examples

### Example 1: VIP Contact Sends Urgent Message

**Scenario**: Your co-founder texts "URGENT: Server down!"

**Flow**:
1. DekuSMS receives SMS
2. Posts to `/webhooks/dekusms`
3. Antenna detects VIP (tier1) and "URGENT" keyword
4. Siphon Engine scores urgency: 90/100
5. Routes as `notify` with `urgent` priority
6. Sends Telegram notification:
   ```
   🔴 URGENT SMS
   From: +15551234567 (VIP Tier 1)
   
   URGENT: Server down!
   
   Received: 2026-02-06 21:45:23 PST
   Message ID: sms-1707283523001
   ```

### Example 2: Colleague Asks a Common Question

**Scenario**: A colleague texts "What are your office hours?"

**Flow**:
1. DekuSMS → Antenna webhook
2. Siphon Engine detects question pattern
3. Routes as `auto-respond` with `normal` priority
4. Antenna sends auto-response via RabbitMQ:
   ```
   Hi! My office hours are 9am-5pm PST, Monday-Friday.
   I'll respond to your message when I'm available.
   ```
5. DekuSMS sends the SMS
6. Message is queued for review in case manual follow-up is needed

### Example 3: Unknown Sender

**Scenario**: Random number texts "Hey, is this John?"

**Flow**:
1. DekuSMS → Antenna webhook
2. Sender not in VIP list
3. Low urgency score (casual greeting)
4. Routes as `queue` with `normal` priority
5. Stored in SQLite database for later review
6. No immediate notification (reduces noise)

You can review queued messages later:

```bash
# Via Antenna API
curl https://your-antenna-server/api/queue?status=pending

# Or directly query the database
sqlite3 data/antenna.db "SELECT * FROM messages WHERE status='pending';"
```

### Example 4: Sending a Reply from Antenna

**Option A: Via API** (when implemented)

```bash
curl -X POST https://your-antenna-server/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+15551234567",
    "message": "Thanks for reaching out! I will call you in 10 minutes."
  }'
```

**Option B: Direct RabbitMQ**

```python
import pika
import json

connection = pika.BlockingConnection(
    pika.ConnectionParameters('localhost', credentials=pika.PlainCredentials('deku_user', 'password'))
)
channel = connection.channel()
channel.queue_declare(queue='sms.outbound', durable=True)

message = {
    "to": "+15551234567",
    "message": "Thanks for reaching out! I will call you in 10 minutes."
}

channel.basic_publish(
    exchange='',
    routing_key='sms.outbound',
    body=json.dumps(message),
    properties=pika.BasicProperties(delivery_mode=2)  # Persistent
)

print("Message sent!")
connection.close()
```

**Option C: Via Telegram Bot** (with custom command handler)

You can set up a Telegram command that publishes to RabbitMQ:

```
/sms +15551234567 Thanks for reaching out!
```

## Troubleshooting

### Webhook Not Receiving Messages

**Symptoms**: DekuSMS shows webhook errors; Antenna logs show no incoming requests

**Diagnosis**:

1. **Check network connectivity**:
   ```bash
   # On Android device (via Termux or ADB)
   curl -v https://your-antenna-server/health
   ```

2. **Verify webhook URL**:
   - Must be HTTPS in production (DekuSMS requires valid TLS certificate)
   - Check for typos in the URL
   - Ensure no trailing slash issues

3. **Check firewall rules**:
   ```bash
   # On Antenna server
   sudo ufw status
   sudo ufw allow 3000/tcp  # If using direct port access
   ```

4. **Test with ngrok** (temporary):
   ```bash
   ngrok http 3000
   # Use the HTTPS URL in DekuSMS
   ```

5. **Check Antenna logs**:
   ```bash
   # If using PM2
   pm2 logs antenna
   
   # If running directly
   tail -f /var/log/antenna/server.log
   ```

**Common Fixes**:
- DekuSMS requires HTTPS (not HTTP) for webhook URLs in production
- If using self-signed certificates, DekuSMS may reject them (use Let's Encrypt)
- Ensure Content-Type is `application/json` (check Antenna request parser)

### RabbitMQ Connection Issues

**Symptoms**: DekuSMS shows "Gateway disconnected"; outbound SMS not sending

**Diagnosis**:

1. **Verify RabbitMQ is running**:
   ```bash
   sudo systemctl status rabbitmq-server
   rabbitmqctl status
   ```

2. **Check connection from Android**:
   - Ensure RabbitMQ port (5672) is accessible from Android device
   - Test with Tailscale ping if using private network

3. **Verify credentials**:
   ```bash
   rabbitmqctl list_users
   rabbitmqctl list_permissions -p /
   ```

4. **Check RabbitMQ logs**:
   ```bash
   tail -f /var/log/rabbitmq/rabbit@hostname.log
   ```

5. **Test connection from Antenna server**:
   ```bash
   node -e "
   const amqp = require('amqplib');
   amqp.connect('amqp://deku_user:password@localhost')
     .then(() => console.log('✅ Connected'))
     .catch(err => console.error('❌ Failed:', err));
   "
   ```

**Common Fixes**:
- Create dedicated user for DekuSMS:
  ```bash
  rabbitmqctl add_user deku_user your_secure_password
  rabbitmqctl set_permissions -p / deku_user ".*" ".*" ".*"
  ```
- Check virtual host (default is `/`)
- Ensure firewall allows port 5672
- For cloud RabbitMQ (CloudAMQP, etc.), use the full connection URL

### Delivery Receipt Problems

**Symptoms**: SMS sends but Antenna doesn't receive delivery confirmation

**Diagnosis**:

1. **Check inbound queue**:
   ```bash
   rabbitmqadmin get queue=sms.inbound count=10
   ```

2. **Verify Antenna is consuming**:
   - Antenna should be listening on `sms.inbound` queue
   - Check consumer count:
     ```bash
     rabbitmqctl list_queues name messages consumers
     ```

3. **Check DekuSMS receipt settings**:
   - Settings → Gateway → Enable "Send Delivery Receipts"
   - Verify receipt format matches Antenna's expected schema

**Common Fixes**:
- Ensure Antenna's RabbitMQ consumer is running
- Check for queue name mismatch (case-sensitive)
- Implement receipt handler in Antenna:
  ```typescript
  // src/rabbitmq/consumer.ts
  async function handleDeliveryReceipt(receipt: any) {
    console.log(`[Receipt] Message ${receipt.messageId}: ${receipt.status}`);
    // Update database, trigger webhooks, etc.
  }
  ```

### E.164 Phone Number Formatting

**Symptoms**: VIP detection not working; routing errors; duplicate conversations

**Issue**: Phone numbers must be in E.164 format (`+[country][number]`) for consistent matching.

**Diagnosis**:

1. **Check incoming format**:
   ```bash
   # Look at raw webhook payloads
   tail -f /var/log/antenna/server.log | grep "from"
   ```

2. **Common formats**:
   - ✅ Correct: `+15551234567`
   - ❌ Wrong: `5551234567`, `(555) 123-4567`, `+1 (555) 123-4567`

**Fix**: Normalize phone numbers in webhook handler:

```typescript
import { parsePhoneNumber } from 'libphonenumber-js';

function normalizePhoneNumber(number: string, defaultCountry = 'US'): string {
  try {
    const parsed = parsePhoneNumber(number, defaultCountry);
    return parsed.number;  // Returns E.164 format
  } catch (error) {
    console.warn(`Failed to parse phone number: ${number}`);
    return number;  // Return original if parsing fails
  }
}

// In webhook handler
const normalizedSender = normalizePhoneNumber(req.body.from);
```

**VIP List Update**:

```yaml
# antenna.config.yaml
vips:
  tier1:
    - "+15551234567"  # Always use E.164 format
    - "+447911123456" # UK number
    - "+8613812345678" # China number
```

### Message Duplication

**Symptoms**: Same SMS triggers multiple notifications or responses

**Causes**:
1. **Webhook retries**: DekuSMS retries failed webhooks
2. **Network issues**: Duplicate delivery
3. **Missing idempotency**: Antenna processes same message twice

**Fix**: Implement idempotency in webhook handler:

```typescript
const processedMessageIds = new Set<string>();

export async function handleDekuSMS(req: Request, res: Response) {
  const { messageId } = req.body;
  
  // Check if already processed
  if (processedMessageIds.has(messageId)) {
    console.log(`[DekuSMS] Duplicate message ${messageId}, ignoring`);
    return res.json({ success: true, message: 'Already processed' });
  }
  
  processedMessageIds.add(messageId);
  
  // Process message...
  
  // Cleanup old entries (keep last 10,000)
  if (processedMessageIds.size > 10000) {
    const toDelete = Array.from(processedMessageIds).slice(0, 5000);
    toDelete.forEach(id => processedMessageIds.delete(id));
  }
}
```

Or use database-based deduplication:

```sql
CREATE UNIQUE INDEX idx_message_id ON messages(id);
-- INSERT will fail if duplicate, catch and ignore
```

## Advanced Configuration

### Tailscale Setup (Recommended for Security)

1. **Install Tailscale on all devices**:
   - Antenna server
   - Android device (DekuSMS)
   - RabbitMQ server (if separate)

2. **Configure DekuSMS**:
   ```
   Webhook URL: https://antenna-host.tailnet-name.ts.net/webhooks/dekusms
   RabbitMQ Host: rabbitmq-host.tailnet-name.ts.net
   ```

3. **Benefits**:
   - Encrypted private network
   - No need for public exposure
   - Automatic TLS certificates
   - Works across cellular/WiFi seamlessly

### Load Balancing (High Volume)

For high SMS volume, run multiple Antenna instances:

```yaml
# docker-compose.yml
services:
  antenna-1:
    build: .
    ports:
      - "3001:3000"
    environment:
      - INSTANCE_ID=antenna-1
  
  antenna-2:
    build: .
    ports:
      - "3002:3000"
    environment:
      - INSTANCE_ID=antenna-2
  
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

```nginx
# nginx.conf
upstream antenna {
    server antenna-1:3000;
    server antenna-2:3000;
}

server {
    listen 443 ssl;
    server_name your-antenna-server.com;
    
    location /webhooks/dekusms {
        proxy_pass http://antenna;
        proxy_set_header Host $host;
    }
}
```

### Database Backup

```bash
# Backup script (add to cron)
#!/bin/bash
BACKUP_DIR=/backups/antenna
mkdir -p $BACKUP_DIR
sqlite3 /opt/antenna/data/antenna.db ".backup '$BACKUP_DIR/antenna-$(date +%Y%m%d-%H%M%S).db'"
find $BACKUP_DIR -mtime +30 -delete  # Keep 30 days
```

### Monitoring

Add health checks and metrics:

```typescript
// src/health.ts
import { queueManager } from './handlers/QueueManager';
import { rabbitMQClient } from './rabbitmq/client';

export function getHealthStatus() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      database: queueManager.isHealthy(),
      rabbitmq: rabbitMQClient.isConnected(),
      telegram: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing'
    },
    stats: queueManager.getStats()
  };
}

// Register endpoint
app.get('/health', (req, res) => {
  res.json(getHealthStatus());
});
```

Monitor with:
```bash
watch -n 30 'curl -s https://your-antenna-server/health | jq'
```

## Security Best Practices

1. **Use HTTPS**: Always use TLS for webhooks (Let's Encrypt is free)
2. **Webhook Authentication**: Add shared secret validation:
   ```typescript
   const WEBHOOK_SECRET = process.env.DEKUSMS_WEBHOOK_SECRET;
   if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
     return res.status(401).json({ error: 'Unauthorized' });
   }
   ```
3. **Rate Limiting**: Prevent abuse:
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 1 * 60 * 1000, // 1 minute
     max: 100 // 100 requests per minute
   });
   
   app.use('/webhooks', limiter);
   ```
4. **Environment Variables**: Never commit credentials
5. **Least Privilege**: RabbitMQ users should have minimal permissions
6. **Regular Updates**: Keep DekuSMS, Antenna, and dependencies updated

## Performance Optimization

### Database Tuning

```sql
-- Add indexes for common queries
CREATE INDEX idx_sender ON messages(sender);
CREATE INDEX idx_status_priority ON messages(status, priority);
CREATE INDEX idx_timestamp ON messages(timestamp);

-- Enable WAL mode (already enabled by QueueManager)
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

### RabbitMQ Tuning

```bash
# Increase message TTL for outbound queue
rabbitmqadmin declare policy name=sms-ttl pattern='sms\..*' \
  definition='{"message-ttl":86400000}'  # 24 hours

# Set queue length limits
rabbitmqadmin declare policy name=max-length pattern='sms\..*' \
  definition='{"max-length":10000}'
```

## References

- **DekuSMS Documentation**: https://github.com/deku-messaging/Deku-SMS-Android
- **Antenna Documentation**: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md)
- **RabbitMQ Tutorials**: https://www.rabbitmq.com/getstarted.html
- **Tailscale Setup**: https://tailscale.com/kb/1017/install/
- **E.164 Format**: https://en.wikipedia.org/wiki/E.164

## Support

For issues or questions:
- **DekuSMS**: https://github.com/deku-messaging/Deku-SMS-Android/issues
- **Antenna**: https://github.com/yourusername/antenna/issues
- **Telegram**: Join the community chat (if available)

## License

This integration guide is provided as-is under the MIT License.
