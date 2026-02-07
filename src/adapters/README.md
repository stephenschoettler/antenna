# Antenna Adapters

This directory contains webhook adapters that convert various SMS/messaging platform payloads into Antenna's standardized `InboundMessage` format.

## DekuSMS Adapter

### Overview

The DekuSMS adapter converts DekuSMS webhook payloads into `InboundMessage` format for processing by Antenna's routing system.

### Usage

```typescript
import { DekuSMSAdapter } from './adapters/DekuSMSAdapter';

const adapter = new DekuSMSAdapter();
const message = adapter.parseWebhook(req.body);
```

### Webhook Endpoint

**POST** `/webhooks/dekusms`

The endpoint expects a JSON payload from DekuSMS with the following structure:

```json
{
  "id": 12345,
  "message_id": "msg_abc123",
  "thread_id": "thread_xyz789",
  "date": "1733097600000",
  "date_sent": "1733097600000",
  "type": 1,
  "num_segments": 1,
  "subscription_id": 0,
  "status": 0,
  "error_code": 0,
  "read": 0,
  "is_encrypted": 0,
  "formatted_date": "2024-12-02T00:00:00.000Z",
  "address": "+14155551234",
  "text": "Hello, this is a test message",
  "data": ""
}
```

### Field Mapping

| DekuSMS Field | InboundMessage Field | Notes |
|---------------|---------------------|-------|
| `address` | `sender` | Normalized (whitespace removed) |
| `text` | `content` | Message content |
| `formatted_date` | `timestamp` | Parsed as JavaScript Date |
| `id` + `message_id` | `id` | Combined as `dekusms-{id}-{message_id}` |
| All fields | `metadata` | Stored for reference |

### Validation

The adapter performs comprehensive validation:

- **Required fields**: All fields in the DekuSMS schema must be present
- **Type checking**: Numeric and string fields are validated for correct types
- **Address validation**: Cannot be empty or whitespace-only
- **Timestamp validation**: `formatted_date` must be a valid date string
- **Encrypted messages**: Rejected with a 400 error (not supported)

### Error Handling

The adapter throws `DekuSMSAdapterError` for validation failures:

```typescript
try {
  const message = adapter.parseWebhook(payload);
} catch (err) {
  if (err instanceof DekuSMSAdapterError) {
    console.error('Validation error:', err.message);
    console.error('Failed field:', err.field);
    console.error('Payload:', err.payload);
  }
}
```

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Successfully processed |
| 400 | Invalid payload or encrypted message |
| 500 | Server error during processing |

### Success Response

```json
{
  "success": true,
  "message": "DekuSMS webhook processed",
  "id": "dekusms-12345-msg_abc123",
  "sender": "+14155551234",
  "routing": {
    "messageId": "...",
    "action": "queue",
    "priority": "normal",
    "notified": false,
    "responded": false
  }
}
```

### Error Response

```json
{
  "error": "Invalid DekuSMS payload",
  "message": "Missing required field: address",
  "field": "address"
}
```

## Testing

Run the adapter tests:

```bash
npm test -- DekuSMSAdapter
```

The test suite covers:
- Valid payload parsing
- Encrypted message handling
- Missing field validation
- Type validation
- Malformed payload handling
- Edge cases (empty text, multi-segment messages, etc.)

## Adding New Adapters

To add a new adapter:

1. Create `src/adapters/YourAdapter.ts`
2. Implement `parseWebhook(payload: unknown): InboundMessage`
3. Add comprehensive validation
4. Create `tests/adapters/YourAdapter.test.ts`
5. Add route in `src/server.ts`
6. Export from `src/adapters/index.ts`
7. Update this README
