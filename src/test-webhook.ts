import express from 'express';
import { DekuSMSAdapter } from './adapters/DekuSMSAdapter-flexible.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/webhooks/dekusms', (req, res) => {
  try {
    console.log('\n[DekuSMS] === INCOMING WEBHOOK ===');
    console.log(JSON.stringify(req.body, null, 2));
    
    const adapter = new DekuSMSAdapter();
    const message = adapter.parseWebhook(req.body);
    
    console.log('\n✅ [PARSED] Message:');
    console.log(`  ID: ${message.id}`);
    console.log(`  Sender: ${message.sender}`);
    console.log(`  Content: "${message.content}"`);
    console.log(`  Channel: ${message.channel}`);
    console.log(`  Timestamp: ${message.timestamp.toISOString()}`);
    console.log(`  Tag: ${message.metadata?.tag || 'none'}`);
    
    res.json({ success: true, message });
  } catch (error: any) {
    console.error('\n❌ [ERROR]', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Antenna test server running on http://localhost:${PORT}`);
  console.log(`📱 Webhook endpoint: https://w0lf-mini.tail2d97e2.ts.net/antenna/webhooks/dekusms`);
  console.log('\nWaiting for SMS from DekuSMS...\n');
});
