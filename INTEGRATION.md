# Antenna - Siphon Engine Integration Layer

This document describes the Siphon Engine integration layer for Antenna, providing intelligent message triage and routing.

## Architecture

The integration layer consists of three main components:

1. **MessageProcessor** (`src/processors/MessageProcessor.ts`)
   - Main orchestrator that interfaces with SiphonEngine
   - Handles inbound message processing and routing
   - Provides batch processing and configuration reloading

2. **Configuration Loader** (`src/config/antenna.config.ts`)
   - Type-safe YAML configuration loading
   - Validates VIP tiers, thresholds, and LLM settings
   - Initializes appropriate LLM provider (Claude or Template)

3. **Webhook Integration** (`src/server.ts`)
   - Express webhooks for SMS and Email
   - Converts provider payloads to InboundMessage format
   - Routes through MessageProcessor for triage

## Configuration

Create `antenna.config.yaml` in the project root:

```yaml
vips:
  tier1:
    - "+15551234567"
    - "ceo@example.com"
  tier2:
    - "+15559876543"
    - "team@example.com"
  tier3: "default"

thresholds:
  urgent: 75
  high: 50
  normal: 25

persona: "Babbage"

llm:
  provider: "template"  # or "claude"
  # apiKey: "sk-ant-..."  # Required for Claude
  # model: "claude-3-5-sonnet-20241022"
```

### Configuration Options

- **vips**: Define VIP contact tiers
  - `tier1`: Critical contacts (founders, emergency)
  - `tier2`: Important contacts (team, investors)
  - `tier3`: Default tier for everyone else

- **thresholds**: Urgency score thresholds (0-100)
  - `urgent`: Critical priority (immediate notification)
  - `high`: Important priority (notify soon)
  - `normal`: Standard priority (queue for review)

- **persona**: AI persona name for responses (e.g., "Babbage", "JARVIS")

- **llm**: LLM provider configuration
  - `provider`: "template" (simple) or "claude" (AI-powered)
  - `apiKey`: Anthropic API key (required for Claude)
  - `model`: Claude model version (optional)

## Usage

### Basic Setup

```typescript
import { createMessageProcessor } from './processors/MessageProcessor';
import type { InboundMessage } from './index';

// Initialize with default config path (./antenna.config.yaml)
const processor = createMessageProcessor();

// Or specify a custom config path
const processor = createMessageProcessor({
  configPath: '/path/to/custom-config.yaml'
});

// Or provide config directly
const processor = createMessageProcessor({
  config: {
    vips: { tier1: [...], tier2: [...], tier3: 'default' },
    persona: 'Babbage',
    thresholds: { urgent: 75, high: 50, normal: 25 }
  }
});
```

### Processing Messages

```typescript
// Single message
const message: InboundMessage = {
  id: 'msg-123',
  channel: 'sms',
  sender: '+15551234567',
  content: 'URGENT: Need help!',
  timestamp: new Date(),
};

const action = await processor.processInbound(message);

console.log(action);
// {
//   type: 'notify',
//   priority: 'urgent',
//   response: 'I'll alert the team immediately...'
// }
```

### Batch Processing

```typescript
const messages = [msg1, msg2, msg3];
const actions = await processor.processBatch(messages);
```

### Configuration Management

```typescript
// Get current config
const config = processor.getConfig();

// Reload config from file
processor.reloadConfig();
processor.reloadConfig('/path/to/new-config.yaml');
```

## Webhook Integration

The webhook handlers automatically convert provider-specific payloads to `InboundMessage` format and route through the MessageProcessor.

### SMS Webhook (`POST /webhooks/sms`)

Accepts Twilio SMS payloads:
```json
{
  "MessageSid": "SM...",
  "From": "+15551234567",
  "To": "+15559999999",
  "Body": "Message content"
}
```

### Email Webhook (`POST /webhooks/email`)

Accepts email payloads:
```json
{
  "from": "sender@example.com",
  "to": "receiver@example.com",
  "subject": "Subject line",
  "text": "Message content"
}
```

### Response Format

Both webhooks return:
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

## Testing

Run the test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

Example test:

```typescript
import { MessageProcessor } from './processors/MessageProcessor';

const processor = new MessageProcessor({ 
  config: testConfig 
});

const action = await processor.processInbound(testMessage);

expect(action.type).toBe('notify');
expect(action.priority).toBe('urgent');
```

## Environment Variables

- `ANTENNA_CONFIG_PATH`: Override default config file path
- `ANTHROPIC_API_KEY`: API key for Claude provider (can be referenced in config)
- `PORT`: Webhook server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Error Handling

The MessageProcessor implements safe fallback behavior:

- Invalid messages return a `queue` action with `normal` priority
- Configuration errors throw with descriptive messages
- Processing errors are logged and return fallback actions

## Admin Endpoints

### Reload Configuration

```bash
POST /admin/reload-config
```

Reloads the configuration from the YAML file without restarting the server.

## Integration Flow

```
Webhook Request
      ↓
Provider Payload (Twilio/Email/etc)
      ↓
Convert to InboundMessage
      ↓
MessageProcessor.processInbound()
      ↓
SiphonEngine.process()
      ↓
  ↓    ↓    ↓
Triage → Route → Response
      ↓
RoutingAction
      ↓
Webhook Response
```

## Type Safety

All components use strict TypeScript types from Siphon Engine:

- `InboundMessage`: Normalized message format
- `RoutingAction`: Decision output with routing instructions
- `TriageScore`: Urgency scoring details
- `VIPConfig`: VIP tier definitions
- `SiphonConfig`: Engine configuration

## Modular Design

The integration layer is designed to be:

- **Testable**: All components can be unit tested with mock configs
- **Modular**: Each component has a single responsibility
- **Extensible**: Easy to add new channels or providers
- **Type-safe**: Full TypeScript coverage with strict types
- **Observable**: Comprehensive logging at each stage

## Next Steps

1. Add more webhook handlers (Slack, Telegram, etc.)
2. Implement persistent thread state storage
3. Add metrics and observability
4. Create admin dashboard for config management
5. Add webhook authentication/verification
