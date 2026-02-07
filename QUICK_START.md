# DekuSMS + Antenna Quick Start

Get your intelligent SMS control center running in 10 minutes.

## Prerequisites

- Android phone with DekuSMS installed
- Linux/Mac server for Antenna
- RabbitMQ server (or use Docker)
- Telegram bot token

## 1. Install DekuSMS

```bash
# On Android: Install from F-Droid or download APK
https://f-droid.org/packages/com.afkanerd.deku/
# or
https://github.com/deku-messaging/Deku-SMS-Android/releases
```

Grant SMS permissions when prompted.

## 2. Set Up RabbitMQ (Quick Docker)

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=deku_user \
  -e RABBITMQ_DEFAULT_PASS=change_this_password \
  rabbitmq:3-management

# Create queues
docker exec rabbitmq rabbitmqadmin declare queue name=sms.inbound durable=true
docker exec rabbitmq rabbitmqadmin declare queue name=sms.outbound durable=true
```

## 3. Install Antenna

```bash
git clone https://github.com/yourusername/antenna.git
cd antenna
npm install
```

## 4. Configure Antenna

Create `antenna.config.yaml`:

```yaml
vips:
  tier1:
    - "+15551234567"  # Your VIP contacts (E.164 format)
  tier2:
    - "+15559876543"  # Important contacts
  tier3: "default"

thresholds:
  urgent: 75
  high: 50
  normal: 25

persona: "Babbage"

llm:
  provider: "template"

rabbitmq:
  host: "localhost"
  port: 5672
  username: "deku_user"
  password: "change_this_password"
  vhost: "/"
  queues:
    inbound: "sms.inbound"
    outbound: "sms.outbound"
```

Create `.env`:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_telegram_chat_id
RABBITMQ_URL=amqp://deku_user:change_this_password@localhost:5672
PORT=3000
NODE_ENV=production
```

## 5. Add DekuSMS Webhook Handler

Add to `src/server.ts`:

```typescript
import type { Request, Response } from 'express';
import { createMessageProcessor } from './processors/MessageProcessor';

const processor = createMessageProcessor();

app.post('/webhooks/dekusms', async (req: Request, res: Response) => {
  try {
    const { from, message, timestamp, messageId } = req.body;

    if (!from || !message) {
      return res.status(400).json({ error: 'Missing from or message' });
    }

    const action = await processor.processInbound({
      id: messageId || `sms-${Date.now()}`,
      channel: 'sms',
      sender: from,
      content: message,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    console.log(`[DekuSMS] ${from}: ${action.type} (${action.priority})`);

    res.json({
      success: true,
      action: {
        type: action.type,
        priority: action.priority,
        hasResponse: !!action.response
      }
    });
  } catch (error) {
    console.error('[DekuSMS] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## 6. Start Antenna

```bash
# Development
npm run dev

# Production
npm start

# Or with PM2
pm2 start npm --name antenna -- start
```

## 7. Configure DekuSMS App

On your Android device:

### Cloud Forwarding
1. Open **DekuSMS → Settings → Cloud Forwarding**
2. Enable **Cloud Forwarding**
3. Set **Webhook URL**: `https://your-server.com/webhooks/dekusms`
   - For local testing: `http://YOUR_LOCAL_IP:3000/webhooks/dekusms`
   - For Tailscale: `https://antenna-host.tailnet.ts.net/webhooks/dekusms`
4. Method: **POST**
5. Enable **Send on Receive**
6. **Test** the webhook

### RabbitMQ Gateway
1. Open **DekuSMS → Settings → Gateway**
2. Enable **Gateway Mode**
3. Type: **RabbitMQ**
4. Host: `your-server-ip` or Tailscale hostname
5. Port: `5672`
6. Username: `deku_user`
7. Password: `change_this_password`
8. Virtual Host: `/`
9. Inbound Queue: `sms.inbound`
10. Outbound Queue: `sms.outbound`
11. Enable **Auto-reconnect**
12. **Test Connection**

## 8. Test It!

### Test 1: Incoming SMS
Send an SMS to your phone from one of your VIP numbers. You should:
- See the webhook hit in Antenna logs
- Receive a Telegram notification (if VIP/urgent)
- See the message in the queue:
  ```bash
  sqlite3 data/antenna.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;"
  ```

### Test 2: Outgoing SMS
Send a reply via RabbitMQ:

```bash
# Using Node.js
node -e "
const amqp = require('amqplib');
(async () => {
  const conn = await amqp.connect('amqp://deku_user:change_this_password@localhost');
  const ch = await conn.createChannel();
  ch.sendToQueue('sms.outbound', Buffer.from(JSON.stringify({
    to: '+15551234567',
    message: 'Test reply from Antenna!'
  })));
  console.log('✅ Sent to queue');
  await ch.close();
  await conn.close();
})();
"
```

Your phone should send the SMS!

## Minimal Test Config

For quick testing without Telegram or RabbitMQ:

```yaml
# antenna.config.yaml (minimal)
vips:
  tier1:
    - "+15551234567"
  tier2: []
  tier3: "default"

thresholds:
  urgent: 75
  high: 50
  normal: 25

persona: "Babbage"

llm:
  provider: "template"
```

```bash
# .env (minimal)
PORT=3000
NODE_ENV=development
```

This will still process messages and queue them, just without notifications or bidirectional SMS.

## Common Issues

### Webhook Not Working
```bash
# Check Antenna is running
curl http://localhost:3000/health

# Check DekuSMS can reach it (from Android or computer on same network)
curl -X POST http://YOUR_LOCAL_IP:3000/webhooks/dekusms \
  -H "Content-Type: application/json" \
  -d '{"from":"+15551234567","message":"test"}'
```

### RabbitMQ Connection Failed
```bash
# Verify RabbitMQ is running
docker ps | grep rabbitmq

# Check connection
telnet localhost 5672
```

### Telegram Not Working
```bash
# Test bot token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Get your chat ID
# 1. Message your bot
# 2. Visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
# 3. Look for "chat":{"id":123456789}
```

### Phone Numbers Not Matching
Always use **E.164 format** (`+[country][number]`):
- ✅ `+15551234567`
- ❌ `5551234567`, `(555) 123-4567`

## What Happens Now?

1. **Incoming SMS**:
   - DekuSMS → Antenna webhook
   - Antenna triages (VIP check, urgency scoring)
   - Routes to: Telegram (notify), Queue (review), Auto-respond, or Ignore

2. **Outgoing SMS**:
   - Your app/script → RabbitMQ `sms.outbound` queue
   - DekuSMS receives from queue
   - Sends SMS via cellular
   - Posts delivery receipt to `sms.inbound`

## Next Steps

- Read [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md) for detailed configuration
- Set up HTTPS with Let's Encrypt for production webhooks
- Configure Tailscale for secure private networking
- Add custom routing rules in `antenna.config.yaml`
- Implement outbound SMS API endpoints
- Set up monitoring and backups

## Resources

- **DekuSMS**: https://github.com/deku-messaging/Deku-SMS-Android
- **Antenna Docs**: [README.md](README.md) | [INTEGRATION.md](INTEGRATION.md)
- **RabbitMQ**: https://www.rabbitmq.com/getstarted.html
- **Full Guide**: [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)

## Need Help?

- Check logs: `pm2 logs antenna` or `tail -f /var/log/antenna/server.log`
- Verify config: `cat antenna.config.yaml`
- Test webhook: `curl -X POST http://localhost:3000/webhooks/dekusms -d '{"from":"+1234","message":"test"}'`
- Check queue: `sqlite3 data/antenna.db "SELECT * FROM messages;"`

---

**You're all set!** 🎉 Your SMS control center is ready. Text your phone and watch the magic happen.
