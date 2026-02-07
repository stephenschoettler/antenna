import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import { config } from 'dotenv';
import { QueueManager, TelegramNotifier, AutoResponder, RoutingHandler } from './handlers/index.js';
import { DekuSMSAdapter, DekuSMSAdapterError, type DekuSMSPayload } from './adapters/DekuSMSAdapter.js';

config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Initialize handlers
const queueManager = new QueueManager();
const telegramNotifier = new TelegramNotifier();
const autoResponder = new AutoResponder(queueManager);
const routingHandler = new RoutingHandler(queueManager, telegramNotifier, autoResponder);

// Initialize adapters
const dekuSMSAdapter = new DekuSMSAdapter();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
  });
  next();
});

interface TwilioSMSPayload {
  MessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  NumMedia?: string;
}

interface EmailPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

// SMS webhook endpoint
app.post('/webhooks/sms', async (req: Request<{}, {}, TwilioSMSPayload>, res: Response) => {
  const { MessageSid, From, To, Body, NumMedia } = req.body;

  if (!MessageSid || !From || !To) {
    res.status(400).json({
      error: 'Missing required fields',
      required: ['MessageSid', 'From', 'To'],
    });
    return;
  }

  console.log('SMS webhook received:', {
    sid: MessageSid,
    from: From,
    to: To,
    body: Body,
    mediaCount: NumMedia || '0',
  });

  try {
    // Process the message through the routing system
    const result = await routingHandler.process({
      sender: From,
      content: Body || '',
      channel: 'sms',
      metadata: {
        messageSid: MessageSid,
        to: To,
        numMedia: NumMedia,
      },
    });

    res.status(200).json({
      success: true,
      message: 'SMS webhook processed',
      sid: MessageSid,
      routing: {
        messageId: result.messageId,
        action: result.action,
        priority: result.priority,
        notified: result.notified,
        responded: result.responded,
      },
    });
  } catch (err) {
    console.error('Failed to process SMS:', err);
    res.status(500).json({
      error: 'Failed to process SMS',
      sid: MessageSid,
    });
  }
});

// Email webhook endpoint
app.post('/webhooks/email', async (req: Request<{}, {}, EmailPayload>, res: Response) => {
  const { from, to, subject, text, html } = req.body;

  if (!from || !to || !subject) {
    res.status(400).json({
      error: 'Missing required fields',
      required: ['from', 'to', 'subject'],
    });
    return;
  }

  console.log('Email webhook received:', {
    from,
    to,
    subject,
    hasText: !!text,
    hasHtml: !!html,
  });

  try {
    // Process the message through the routing system
    const content = text || html || '';
    const result = await routingHandler.process({
      sender: from,
      content,
      channel: 'email',
      metadata: {
        to,
        subject,
        hasHtml: !!html,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Email webhook processed',
      from,
      subject,
      routing: {
        messageId: result.messageId,
        action: result.action,
        priority: result.priority,
        notified: result.notified,
        responded: result.responded,
      },
    });
  } catch (err) {
    console.error('Failed to process email:', err);
    res.status(500).json({
      error: 'Failed to process email',
      from,
      subject,
    });
  }
});

// DekuSMS webhook endpoint
app.post('/webhooks/dekusms', async (req: Request<{}, {}, DekuSMSPayload>, res: Response) => {
  try {
    // Parse the DekuSMS payload
    const message = dekuSMSAdapter.parseWebhook(req.body);

    console.log('DekuSMS webhook received:', {
      id: message.id,
      sender: message.sender,
      content: message.content.substring(0, 100),
      isEncrypted: message.metadata.isEncrypted,
      numSegments: message.metadata.numSegments,
      threadId: message.metadata.threadId,
    });

    // Process the message through the routing system
    const result = await routingHandler.process({
      sender: message.sender,
      content: message.content,
      channel: 'sms', // DekuSMS is an SMS channel
      metadata: message.metadata,
    });

    res.status(200).json({
      success: true,
      message: 'DekuSMS webhook processed',
      id: message.id,
      sender: message.sender,
      routing: {
        messageId: result.messageId,
        action: result.action,
        priority: result.priority,
        notified: result.notified,
        responded: result.responded,
      },
    });
  } catch (err) {
    // Handle DekuSMS adapter errors
    if (err instanceof DekuSMSAdapterError) {
      console.error('DekuSMS adapter error:', {
        message: err.message,
        field: err.field,
      });

      res.status(400).json({
        error: 'Invalid DekuSMS payload',
        message: err.message,
        field: err.field,
      });
      return;
    }

    // Handle other errors
    console.error('Failed to process DekuSMS message:', err);
    res.status(500).json({
      error: 'Failed to process DekuSMS message',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const handlerStatus = routingHandler.getHandlerStatus();
  const stats = routingHandler.getStats();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    handlers: handlerStatus,
    queue: stats,
  });
});

// Queue status endpoint
app.get('/api/queue', (_req: Request, res: Response) => {
  try {
    const stats = routingHandler.getStats();
    const pending = routingHandler.getPendingMessages(10);

    res.status(200).json({
      stats,
      pending: pending.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        preview: msg.content.substring(0, 100),
        priority: msg.priority,
        timestamp: msg.timestamp,
      })),
    });
  } catch (err) {
    console.error('Failed to get queue status:', err);
    res.status(500).json({
      error: 'Failed to retrieve queue status',
    });
  }
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Antenna webhook server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Handler status:', routingHandler.getHandlerStatus());
  console.log('Queue stats:', routingHandler.getStats());
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  queueManager.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing database...');
  queueManager.close();
  process.exit(0);
});

export default app;
