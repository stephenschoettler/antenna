import express, { type Request, type Response } from 'express';
import { DekuSMSAdapter, DekuSMSAdapterError, type DekuSMSPayload } from './adapters/DekuSMSAdapter.js';
import { MessageProcessor } from './processors/MessageProcessor.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize minimal setup (no SQLite)
const dekuSMSAdapter = new DekuSMSAdapter();
const messageProcessor = new MessageProcessor();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DekuSMS webhook
app.post('/webhooks/dekusms', async (req: Request, res: Response) => {
  try {
    console.log('[DekuSMS] Incoming webhook:', JSON.stringify(req.body, null, 2));
    
    const message = dekuSMSAdapter.parseWebhook(req.body as DekuSMSPayload);
    console.log('[DekuSMS] Parsed message:', message);
    
    const action = await messageProcessor.processMessage(message);
    console.log('[DekuSMS] Routing action:', action);
    
    // For now, just log the action (no handlers yet)
    console.log(`[ACTION] ${action.type.toUpperCase()} (${action.priority}): ${message.sender}`);
    console.log(`[CONTENT] "${message.content}"`);
    
    res.json({ success: true, action });
  } catch (error) {
    if (error instanceof DekuSMSAdapterError) {
      console.error('[DekuSMS] Validation error:', error.message, error.metadata);
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.metadata,
      });
    } else {
      console.error('[DekuSMS] Server error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[Antenna] Minimal server running on port ${PORT}`);
  console.log(`[Antenna] DekuSMS webhook: http://localhost:${PORT}/webhooks/dekusms`);
});
