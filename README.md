# Antenna 🦞📡

**The Intelligent SMS Gateway for OpenClaw**

## Concept Overview

Antenna is an OpenClaw extension that acts as your intelligent SMS gateway - receiving incoming messages, analyzing them for urgency, and routing responses through your configured assistant persona. Like a lobster's antennae sensing the environment, Antenna detects and filters incoming communications while keeping you in control via Telegram command center.

**Name Origin:** Lobster antennae - sensory organs that detect and process signals from the environment

**Baseline Persona:** Jarvis-inspired (professional, protective, anticipates needs)

**Architecture:** OpenClaw Extension (optional installation)

**Identity:** Uses your configured OpenClaw `identity.name` - Antenna adapts to whatever persona you define

## Architecture

```
+-----------------+
|  Android Phone  | (SMS Gateway App)
|  via Tailscale  |
+--------+--------+
         | POST /webhook
         | JSON: {from, text, timestamp}
         v
+-------------------------------------+
|  OpenClaw Gateway                   |
|  http://[Tailscale-IP]:18789        |
|  +-------------------------------+  |
|  | Webhook Handler               |  |
|  | /sms/inbound                  |  |
|  +----------+--------------------+  |
|             |                       |
|             v                       |
|  +-------------------------------+  |
|  | Antenna Extension (Antenna)   |  |
|  | * VIP Check                   |  |
|  | * Urgency Analysis            |  |
|  | * Context-Aware Reply         |  |
|  +----------+--------------------+  |
|             |                       |
|             v                       |
|  +-------------------------------+  |
|  | Decision Engine               |  |
|  +-------------+-----------------+  |
|  | If Urgent   | If Routine      |  |
|  | * Notify    | * Auto-reply    |  |
|  | * Escalate  | * Log & queue   |  |
|  +-------------+-----------------+  |
+-----------------+-------------------+
                  |
                  v
         +----------------+
         | Outbound Tools |
         | * send_sms     |
         | * notify_user  |
         | * telegram_msg |
         +----------------+
```

## The Three Components

### 1. The "Ear": Inbound Webhook Processing

**Endpoint:** `POST /sms/inbound`

**Inbound Data Structure:**

```json
{
  "from": "+1234567890",
  "text": "Are we still meeting at 5?",
  "timestamp": "2026-01-31T12:00:00Z",
  "messageId": "abc123",
  "threadId": "thread_456"
}
```

**Android SMS Gateway App Setup:**
- Install: [SMS Gateway](https://sms-gateway.app/) or similar
- Configure webhook URL: `http://[Tailscale-IP]:18789/sms/inbound`
- Set authentication token
- Enable "Forward all messages"

### 2. The "Brain": The butler's Decision Logic

**Reasoning Protocol:**

```
Step A: Identify Sender
├─ Check VIP list (~/.openclaw/sms-vips.json)
├─ Check contact history
├─ Check conversation thread state
└─ Assign base priority level (1-5)

Step B: Multi-Factor Urgency Scoring
├─ Keyword Analysis (30% weight)
│  • Emergency: "help", "urgent", "emergency", "hospital", "down", "broken"
│  • High: "asap", "now", "important", "keys", "locked out", "deadline"
│  • Medium: "tonight", "today", "question", "when", "meeting"
│  • Low: "when you can", "no rush", "fyi", "heads up"
│
├─ Sender History Analysis (20% weight)
│  • Texts rarely → Likely important when they do
│  • Last contact >30 days → Unusual, flag for attention
│  • Typical response pattern → Does this deviate?
│
├─ Time Context Analysis (20% weight)
│  • 2 AM - 6 AM → Probably urgent (unusual hours)
│  • Business hours → Normal priority
│  • Weekends from work contacts → Elevated priority
│
├─ Message Structure (10% weight)
│  • Multiple question marks → Seeking response
│  • All caps → Emotional urgency
│  • Short message (<10 words) → Direct/urgent
│
└─ Repeat Contact Escalation (20% weight)
   • 2nd message in 10 min → +0.2 urgency
   • 3rd message in 10 min → +0.4 urgency (escalating)
   • 4+ messages → Potential emergency or spam flood

Urgency Score Calculation:
urgencyScore =
  (keywordMatch * 0.3) +
  (senderHistory * 0.2) +
  (timeContext * 0.2) +
  (messageStructure * 0.1) +
  (repeatContact * 0.2)

Step C: Choose Action (Score-Based)
├─ Score ≥ 0.8 → URGENT: Immediate notify + escalate (even if Tier 3)
├─ Score ≥ 0.6 && Tier ≤ 2 → HIGH: Notify + auto-reply
├─ Score ≥ 0.4 && Tier = 1 → MEDIUM: Telegram briefing + auto-reply
├─ Score ≥ 0.4 && Tier ≥ 2 → MEDIUM: Auto-reply + queue
├─ Score < 0.4 && Tier ≤ 2 → LOW: Polite deflection + log
└─ Score < 0.4 && Tier = 3 → ROUTINE: Standard deflection or silence

Step D: Conversation Threading & State Management
├─ Check if this is part of existing conversation thread
├─ Load thread context (previous exchanges with this contact)
├─ Determine conversation state:
│  • new_inquiry → Initial contact
│  • gathering_info → Babbage collecting details
│  • awaiting_human → Ready for your input
│  • resolved → Conversation closed
│
└─ Thread State Machine:
   new_inquiry → (ask clarifying question) → gathering_info
   gathering_info → (sufficient details) → awaiting_human
   awaiting_human → (you respond) → resolved
   resolved → (24h timeout) → archived

Step E: Craft Response
├─ Use Babbage persona ("protective but polite butler")
├─ Reference thread context and previous exchanges
├─ Reference context from message
├─ Set expectations (when you'll be available)
└─ Offer alternative contact methods if urgent
```

## Conversation Threading System

**Thread State Schema:**

```json
{
  "thread_id": "thread_a1b2c3d4",
  "contact": "+1-555-1234",
  "contact_name": "Unknown",
  "tier": 3,
  "state": "gathering_info",
  "created_at": "2026-02-01T14:30:00Z",
  "last_activity": "2026-02-01T14:32:00Z",
  "exchanges": [
    {
      "timestamp": "2026-02-01T14:30:00Z",
      "from": "contact",
      "text": "Can you send the proposal?",
      "urgency_score": 0.35
    },
    {
      "timestamp": "2026-02-01T14:30:15Z",
      "from": "babbage",
      "text": "Good afternoon. This is Babbage, Mr. Schoettler's assistant. Which proposal are you referring to?",
      "action": "clarifying_question"
    },
    {
      "timestamp": "2026-02-01T14:32:00Z",
      "from": "contact",
      "text": "The Q1 marketing proposal we discussed last Tuesday",
      "urgency_score": 0.42
    }
  ],
  "context_extracted": {
    "topic": "proposal_request",
    "timeframe": "Q1",
    "department": "marketing",
    "reference_date": "last Tuesday",
    "details_complete": true
  },
  "ready_for_human": true,
  "telegram_briefing_sent": false
}
```

**Thread State Transitions:**

```
NEW_INQUIRY
│
├─ Sufficient context in first message
│  └─> AWAITING_HUMAN (send briefing immediately)
│
└─ Insufficient context
   └─> GATHERING_INFO (ask clarifying questions)
      │
      ├─ Reply with more details
      │  ├─> Details complete? → AWAITING_HUMAN
      │  └─> Still unclear? → GATHERING_INFO (ask more)
      │
      ├─ No reply for 2 hours
      │  └─> AWAITING_HUMAN (send partial briefing)
      │
      └─ Sender gives up
         └─> ABANDONED (archive after 24h)

AWAITING_HUMAN
│
├─ You dictate response → RESOLVED
├─ You take over manually → RESOLVED
└─ No action for 24h → STALE (notify reminder)

RESOLVED
│
├─ Contact replies again (new topic) → NEW_INQUIRY (new thread)
├─ Contact replies (same topic) → GATHERING_INFO (reopen thread)
└─ 7 days of silence → ARCHIVED
```

**Example: Multi-Turn Conversation**

```
Contact: "Can you send the proposal?"
${assistantName}: (Thread: new_inquiry)
  "Good afternoon. This is Babbage. Which proposal specifically?"

Contact: "The Q1 marketing one"
${assistantName}: (Thread: gathering_info)
  "Thank you. The Q1 marketing proposal. May I ask who you are and
  your organization?"

Contact: "This is Jennifer from Acme Corp"
${assistantName}: (Thread: gathering_info → awaiting_human)
  Context complete:
  - Topic: Q1 marketing proposal
  - Requester: Jennifer, Acme Corp
  - Action: Send document

  [Telegram Briefing]
  "Jennifer from Acme Corp is requesting the Q1 marketing proposal.

  Thread context: 3 exchanges, details gathered.

  Suggested actions:
  1. Send proposal via email (if you have it)
  2. Ask Babbage to request her email address
  3. Manual response

  [Send Proposal] [Get Email] [Manual]"

You (Telegram): "Get her email"

Babbage → SMS:
  "Thank you for clarifying, Jennifer. May I have your email address
  so Mr. Schoettler can send the proposal directly?"

Contact: "jennifer@acme.com"

Babbage → Telegram:
  "Email received: jennifer@acme.com
  Ready to send Q1 marketing proposal.

  [Send Now] [Manual]"
```

**The Rule of Three: Hierarchical Response Logic**

Babbage operates on a tiered contact system:

**Tier 1: The Inner Circle (VIPs)**
- Family, key partners, critical contacts
- Bypass deflection entirely
- Silent notification to Telegram only
- SMS handset stays quiet unless intervention requested
- Example: Wife texts → Telegram alert, no auto-reply

**Tier 2: Known Associates**
- Colleagues, friends, regular contacts
- Receive contextual "immersed in work" response
- Babbage offers to "take a memo" → appends to task list
- Telegram briefing with suggested actions
- Example: Coworker → Auto-reply + memo + Telegram summary

**Tier 3: The Unwashed Masses**
- Unknown numbers, spam, marketing
- Cold, formal gatekeeping response
- Or complete silence if identified as "spectacularly poor" spam
- No Telegram notification unless potential urgency detected
- Example: Spam → Silent ignore

**Context Store & Memory:**
- Track previous deflections (avoid sententious repetition)
- If same person texts 3x: "I note this is your third inquiry. The previous deflections stand, but I've escalated your persistence to Mr. Schoettler's attention."
- Simple SQLite DB or JSON file: `~/.openclaw/sms-context.db`

### The butler's Operational Modes

State management via direct command to your own number:

**"Babbage, I'm in the Bunker"**
- Total radio silence mode
- All non-VIPs get deflection
- VIPs: silent Telegram notification only
- No SMS auto-replies unless emergency keywords detected

**"Babbage, I'm Mobile"**
- Available mode
- Notifies you of everything via Telegram
- Assumes you can glance at phone
- Shorter deflection messages
- Auto-reply: "Mr. Schoettler is mobile but available. I've notified him."

**"Babbage, Triage Mode"**
- Active engagement mode
- Replies to everyone asking for summary of needs
- Collects information for briefing
- Presents structured summary every 30min
- Auto-reply: "Thank you for reaching out. Could you briefly summarize what you need? I'll compile a briefing for Mr. Schoettler."

### 3. The "Voice": Context-Aware Replies

**Example Scenarios:**

**Scenario 1: Unknown Number - PDF Request**
```
Incoming: "Hey, can you send me that PDF?"

${assistantName}: "Good afternoon. This is Babbage, Mr. Schoettler's assistant.
He is currently engaged in deep work and unavailable. I've noted your
request for a PDF document. Could you please specify which document
you're referring to, and I'll ensure it reaches the top of his queue?
For urgent matters, you may reach him via [alternative contact]."
```

**Scenario 2: VIP - Meeting Confirmation**
```
Incoming: "+1-555-WIFE: Are we still meeting at 5?"

${assistantName}: [Immediate Telegram notification to you]
Response: "Hello! Yes, the 5 PM meeting is still on his calendar.
I've alerted him to confirm. He should respond shortly."
```

**Scenario 3: Emergency Keyword**
```
Incoming: "URGENT: Server is down, clients calling"

${assistantName}: [High-priority notification via Telegram + SMS to you]
Response: "Message received and escalated immediately. Mr. Schoettler
is being notified now via priority channel."
```

**Scenario 4: Deep Work Mode Active**
```
Incoming: "Quick question about the project timeline"

${assistantName}: "Good day. Mr. Schoettler is currently in a scheduled deep
work session until 3 PM. Your question regarding project timeline has
been queued. He will respond when he resurfaces. For urgent matters,
please contact [backup person/method]."
```

## The Refined Tactical Flow: Telegram Command Center

Instead of buzzing your phone, Babbage uses **Telegram as the command channel**:

### Flow Example: The Henderson Scenario

```
+--------------------------------------------------------+
| 1. Incoming SMS (The Trigger)                          |
|    From: +1-555-HENDERSON                              |
|    Text: "Hey, what's the status on the project?"      |
+----------------+---------------------------------------+
                 |
                 v
+--------------------------------------------------------+
| 2. The butler's Triage                                 |
|    * Check rolodex: "Mr. Henderson" = Tier 2           |
|    * Check context: No previous deflection today       |
|    * Mode: Deep Work                                   |
|    * Decision: Deflect + Briefing                      |
+----------------+---------------------------------------+
                 |
                 v
+--------------------------------------------------------+
| 3. The Telegram Briefing (Silent Channel)              |
|    To: Your Telegram                                   |
|                                                        |
|    [SMS Triage Report]                                 |
|    -----------------------------------------           |
|    From: Mr. Henderson (+1-555-XXX-1234)               |
|    Time: 2:34 PM                                       |
|    Tier: Known Associate                               |
|                                                        |
|    Message:                                            |
|    "Hey, what's the status on the project?"            |
|                                                        |
|    Analysis:                                           |
|    * Intent: Status inquiry                            |
|    * Urgency: Medium                                   |
|    * Context: Project deadline approaching             |
|                                                        |
|    Auto-response sent:                                 |
|    "Good afternoon, Mr. Henderson. This is Babbage,    |
|    Mr. Schoettler's assistant. He is currently         |
|    indisposed in a deep work session. I have noted     |
|    your inquiry regarding project status. Shall I      |
|    hold him at bay, or would you prefer a specific     |
|    response?"                                          |
|                                                        |
|    [Hold Bay] [Dictate Reply] [Manual Response]        |
+----------------+---------------------------------------+
                 |
                 v
+--------------------------------------------------------+
| 4. Your Command (Via Telegram)                         |
|    You: "Tell him Tuesday"                             |
+----------------+---------------------------------------+
                 |
                 v
+--------------------------------------------------------+
| 5. The Execution                                       |
|    Babbage translates your brevity into poise:         |
|                                                        |
|    SMS to Henderson:                                   |
|    "Mr. Henderson, Babbage here. I've just managed     |
|    to squeeze a moment from Mr. Schoettler's           |
|    schedule; he indicates that Tuesday would be the    |
|    appropriate time for that update. I trust this      |
|    is satisfactory?"                                   |
|                                                        |
|    Telegram confirmation:                              |
|    v Reply sent to Henderson: "Tuesday update"         |
|    Context updated: Last contact 2:35 PM               |
+--------------------------------------------------------+
```

### Telegram Interaction Patterns

**Pattern 1: Quick Approval**
```
${assistantName}: "Unknown number asking about consulting rates. Deflect?"
You: "👍" (or "yes")
${assistantName}: [Sends standard deflection] ✓ Done
```

**Pattern 2: Dictation**
```
${assistantName}: "Bob asking about meeting time"
You: "Thursday 3pm works"
${assistantName}: [Crafts formal reply] ✓ Sent
```

**Pattern 3: Manual Override**
```
${assistantName}: "VIP marked urgent but seems routine. Escalate?"
You: "/manual"
${assistantName}: [Provides phone number, waits for you to respond directly]
```

**Pattern 4: Batch Briefing**
```
${assistantName}: (Every 30min in Triage Mode)
"📊 Triage Summary (2:00-2:30 PM)

3 inquiries received:
1. Charlie - Meeting request (Thu/Fri)
2. Unknown - Sales pitch (deflected, silent)
3. Alice - Dinner plans (VIP, held for you)

Suggested actions:
[Approve All] [Review] [Manual]"
```

## Antenna: Your Intelligent SMS Gateway

**Tagline:** "Sensing signals, protecting focus"

**What it does:**
- 📡 Receives incoming SMS messages
- 🧠 Analyzes urgency and sender priority
- 🛡️ Shields you from interruptions
- 💬 Crafts context-aware responses
- 📱 Routes everything through Telegram command center

**Persona-agnostic:** Works with any OpenClaw identity you configure

## Installation & Configuration

### Extension Installation

```bash
# Install Antenna extension
openclaw extensions install antenna

# Or from local directory during development
cd extensions/antenna
npm install
npm run build
```

### Identity Configuration

The butler uses your **OpenClaw identity** for its name and persona:

```json
// ~/.openclaw/config.json or clawdbot.json
{
  "identity": {
    "name": "Jarvis",          // Used in SMS responses
    "role": "assistant",
    "personality": "professional, protective, efficient"
  }
}
```

**Response Examples:**
```
With identity.name = "Jarvis":
"Good afternoon. This is Jarvis, Mr. Schoettler's assistant..."

With identity.name = "Alfred":
"Good afternoon. This is Alfred, Mr. Schoettler's assistant..."

With no identity configured (fallback):
"Good afternoon. This is your assistant..."
```

### Extension Configuration

```json
// ~/.openclaw/extensions/antenna/config.json
{
  "enabled": true,
  "webhook": {
    "path": "/sms/inbound",
    "auth_token": "your-secure-token-here"
  },
  "gateway": {
    "type": "sms-gateway-app",  // or "twilio"
    "send_url": "https://smsgateway.me/api/v4/message/send",
    "device_id": "your-device-id"
  },
  "shadow_mode": true,  // IMPORTANT: Start with shadow mode!
  "vips_file": "~/.openclaw/sms-vips.json",
  "state_file": "~/.openclaw/sms-state.json",
  "context_db": "~/.openclaw/sms-context.db"
}
```

## Implementation Checklist

### Phase 0: Shadow Mode & Testing (Week 1 - CRITICAL)

**Purpose:** Validate all logic before going live

- [ ] **Shadow Mode Implementation**
  - [ ] Environment variable: `BABBAGE_SHADOW_MODE=true`
  - [ ] Log all decisions without sending SMS
  - [ ] Send Telegram "Shadow Reports" for review
  - [ ] Track accuracy: false positives/negatives

- [ ] **Twilio Test Setup**
  - [ ] Purchase 3 Twilio numbers ($3/month)
  - [ ] Configure test VIP, test colleague, test spam
  - [ ] Write automated test scenarios script
  - [ ] Run 50+ test scenarios

- [ ] **Shadow Week Timeline**
  - [ ] Day 1-3: Observe what Babbage would do
  - [ ] Day 4-5: Tune urgency thresholds
  - [ ] Day 6-7: Validate improvements
  - [ ] Day 8: Go live if 95%+ accuracy

- [ ] **Success Criteria Before Live**
  - [ ] 0 false negatives (urgent missed) in 50 tests
  - [ ] <5% false positives (routine escalated)
  - [ ] Thread state machine handles 10+ turn conversations
  - [ ] All failure modes tested and working
  - [ ] You're confident in The butler's judgment

## The Three Pillars of Infrastructure

For "unflappable" operation, the system requires:

### Pillar 1: The Persistent Webhook (The "Ear")
**Requirement:** 24/7 lightweight listener

**Implementation:**
- Runs inside OpenClaw container (already 24/7)
- Endpoint: `POST /sms/inbound`
- Listens on Tailscale network
- Catches JSON packets from phone
- Passes to OpenClaw agent logic

**Resource Impact:**
- Minimal CPU (event-driven)
- ~10MB RAM for webhook handler
- No additional processes needed

### Pillar 2: The Context Store (The "Memory")
**Requirement:** Track deflection history and conversation state

**Purpose:**
- Avoid repetitive responses
- Remember previous deflections
- Track conversation threads
- Store contact patterns

**Implementation:**
```bash
~/.openclaw/sms-context.db (SQLite)

Tables:
- conversations: thread_id, participants, last_activity
- deflections: contact, timestamp, response_sent, count
- patterns: contact, typical_urgency, response_preference
```

**Example Query:**
```sql
-- Check if already deflected today
SELECT COUNT(*) FROM deflections
WHERE contact = '+1-555-1234'
AND timestamp > datetime('now', '-1 day');

-- If count > 0, acknowledge previous deflection
```

### Pillar 3: The "Boss" Channel (The Silent Report)
**Requirement:** Babbage → You communication without SMS spam

**Primary Channel: Telegram**
- Desktop notifications (non-intrusive)
- Interactive buttons for quick actions
- Thread-based organization
- Searchable history

**Secondary Channels:**
- System tray notification (desktop)
- Log file: `~/.openclaw/sms-briefings.log`
- Web dashboard (future)

**Notification Levels:**
```
Silent:  Tier 3 (unknowns) - Log only
Normal:  Tier 2 (associates) - Telegram briefing
Urgent:  Tier 1 VIP + Emergency - Push notification + sound
```

### Phase 1: Infrastructure Setup

- [ ] **Android Phone Setup**
  - [ ] Install SMS Gateway app
  - [ ] Configure Tailscale VPN (always-on)
  - [ ] Set webhook URL to OpenClaw gateway
  - [ ] Test webhook delivery with sample message

- [ ] **OpenClaw Webhook Handler**
  - [ ] Create `/sms/inbound` endpoint
  - [ ] Add authentication (bearer token)
  - [ ] Parse incoming JSON
  - [ ] Route to Babbage agent

- [ ] **VIP Management**
  - [ ] Create `~/.openclaw/sms-vips.json` schema
  - [ ] Add management commands (add/remove VIPs)
  - [ ] Support priority levels and custom rules

### Phase 2: Babbage Intelligence

- [ ] **Analysis Tools**
  - [ ] Urgency detection function
  - [ ] VIP lookup function
  - [ ] Context extraction (times, locations, names)
  - [ ] Intent classification

- [ ] **Decision Engine**
  - [ ] Priority scoring algorithm
  - [ ] Action selection logic
  - [ ] Response template system
  - [ ] State management (deep work mode, OOO, etc.)

- [ ] **System Prompt**
  - [ ] Define Babbage butler persona
  - [ ] Add SMS-specific directives
  - [ ] Include VIP handling rules
  - [ ] Add emergency escalation protocol

### Phase 3: Outbound Actions

- [ ] **SMS Sending Tool**
  - [ ] Integrate with SMS Gateway API
  - [ ] Rate limiting (avoid spam)
  - [ ] Delivery confirmation
  - [ ] Thread tracking

- [ ] **Notification Tools**
  - [ ] Telegram notification (existing)
  - [ ] Priority levels (silent, normal, urgent)
  - [ ] Include original message + analysis
  - [ ] Action buttons (approve reply, manual response)

### Phase 4: Advanced Intelligence

- [ ] **Multi-Factor Urgency Scoring**
  - [ ] Implement weighted scoring algorithm
  - [ ] Keyword analysis (30% weight)
  - [ ] Sender history patterns (20% weight)
  - [ ] Time context detection (20% weight)
  - [ ] Message structure analysis (10% weight)
  - [ ] Repeat contact escalation (20% weight)
  - [ ] Tunable thresholds per tier

- [ ] **Conversation Threading**
  - [ ] Thread state machine implementation
  - [ ] SQLite schema for thread storage
  - [ ] Context extraction from exchanges
  - [ ] Multi-turn conversation handling
  - [ ] Thread timeout and archival
  - [ ] "Ready for human" detection

- [ ] **Learning from Overrides**
  - [ ] Log when you manually respond vs The butler's action
  - [ ] Track pattern: what triggers manual intervention?
  - [ ] Suggest rule updates based on behavior
  - [ ] "You often respond to budget messages immediately - upgrade priority?"
  - [ ] Adaptive urgency scoring based on corrections

- [ ] **Calendar Integration (via gogcli skill)**
  - [ ] Read-only calendar access (Google Calendar)
  - [ ] Free/busy checking
  - [ ] Auto-detect "in meeting" → Immersion Mode
  - [ ] Availability-based responses: "He's in a meeting until 3 PM"
  - [ ] Meeting scheduling: "Would Thursday 2 PM work?" → Check calendar
  - [ ] Post-meeting summary: "3 messages held during your client call"

- [ ] **State Commands**
  - [ ] "Babbage, deep work mode for 2 hours"
  - [ ] "Babbage, hold all calls except [person]"
  - [ ] "Babbage, I'm available now"
  - [ ] "Babbage, vacation mode until Monday"
  - [ ] "Babbage, meeting until 3pm"
  - [ ] "Babbage, status" → Current mode + queued messages

- [ ] **Rate Limiting & DOS Protection**
  - [ ] Track message frequency per contact
  - [ ] If 3+ messages in 10 min from Tier 2/3 → Throttle
  - [ ] If VIP spamming → Alert (unusual behavior)
  - [ ] Spam flood detection → Auto-silence + alert
  - [ ] Cooldown period before responding again
  - [ ] Example: "I've noted your repeated messages. Additional messages won't expedite a reply."

- [ ] **Time-Based & Contextual Rules**
  - [ ] Work hours vs off-hours priority adjustments
  - [ ] Weekend tier changes (e.g., boss demoted on Saturday)
  - [ ] Holiday mode (auto-set vacation state)
  - [ ] Location-based rules (if traveling, different deflections)
  - [ ] Example: Bob is Tier 2 on weekends, Tier 1 during work hours

## OpenClaw Channel Mapping

Treating SMS Gateway as a **Custom Provider** within OpenClaw's channel architecture:

| Channel | Role | Protocol | Location |
|---------|------|----------|----------|
| **Telegram** | The Command Deck (Boss) | Official API | src/telegram/ |
| **SMS Gateway** | The Gatehouse (Client-facing) | REST API via Tailscale | src/sms/ (new) |
| **Local Storage** | The Registry (Memory) | JSON/SQLite | Docker volume |
| **Web UI** | The Dashboard (Monitoring) | WebSocket | src/provider-web.ts |

**Integration Point:**
- SMS behaves like existing channels (Telegram, Discord, etc.)
- Shares routing, pairing, command gating infrastructure
- Uses same agent session management
- Fits into existing message queue system

## Strategic Planning: The "Immersion" Mode

**Contextual State Variable:** `Sir_Indisposed`

### Mode: Sir_Indisposed = True (Active Gate-keeping)
```json
{
  "Sir_Indisposed": true,
  "mode": "immersion",
  "since": "2026-02-01T10:00:00Z",
  "until": "2026-02-01T15:00:00Z",
  "behavior": {
    "auto_reply": true,
    "telegram_briefing": true,
    "phone_quiet": true
  }
}
```

**Babbage Behavior:**
- Handles SMS front-line automatically
- All non-VIP messages get deflection
- VIPs get silent Telegram notification
- No phone interruptions
- Compiles briefing for later review

### Mode: Sir_Indisposed = False (Watchdog Mode)
```json
{
  "Sir_Indisposed": false,
  "mode": "watchdog",
  "timeout_minutes": 20,
  "behavior": {
    "auto_reply": false,
    "monitor_only": true,
    "failsafe_trigger": "unanswered"
  }
}
```

**Babbage Behavior:**
- Watches incoming SMS passively
- Logs but doesn't auto-reply
- If message unanswered for >20 minutes: triggers failsafe
- Failsafe: "I notice you haven't responded to [Sender]. Shall I intervene?"
- Acts as backup to ensure responsiveness

**Mode Transition:**
```
You (via Telegram): "Babbage, immersion mode"
${assistantName}: "Understood. Sir_Indisposed = True. The gatehouse is now under my management."

[2 hours later]

You (via Telegram): "Babbage, available"
${assistantName}: "Welcome back, Sir. Sir_Indisposed = False. Returning to watchdog mode.
During your immersion: 5 messages handled, 2 VIP notifications queued."
```

## Media Handling: MMS Support

### The Friction Point: Images & Attachments

**Standard SMS Gateways** handle text well, but MMS (photos, videos) requires special handling.

### MMS Flow



```

+-------------------------------------------------+

| 1. MMS Arrives                                  |

|    From: Contact                                |

|    Text: "Check this diagram - urgent!"         |

|    Attachment: image.jpg                        |

+----------------+--------------------------------+

                 |

                 v

+-------------------------------------------------+

| 2. Gateway Processes MMS                        |

|    Option A: Upload to temp URL                 |

|      -> https://gateway.com/mms/abc123.jpg      |

|    Option B: Base64 encode                      |

|      -> "data:image/jpeg;base64,/9j/4AAQ..."    |

+----------------+--------------------------------+

                 |

                 v

+-------------------------------------------------+

| 3. Webhook Payload                              |

|    {                                            |

|      "from": "+1234567890",                     |

|      "text": "Check this diagram - urgent!",    |

|      "media": [{                                |

|        "type": "image/jpeg",                    |

|        "url": "https://gateway.com/mms/...",    |

|        "base64": "..."  // or this              |

|      }]                                         |

|    }                                            |

+----------------+--------------------------------+

                 |

                 v

+-------------------------------------------------+

| 4. Babbage Processes Image                      |

|    * Download image from URL (or decode base64) |

|    * Run vision analysis (Claude, GPT-4V)       |

|    * Extract: diagram type, urgency indicators  |

|    * Generate description                       |

+----------------+--------------------------------+

                 |

                 v

+-------------------------------------------------+

| 5. Telegram Briefing with Image                 |

|    To: Your Telegram                            |

|                                                 |

|    [MMS Received]                               |

|    From: Bob (+1-555-XXX-5678)                  |

|    Text: "Check this diagram - urgent!"         |

|                                                 |

|    [Inline image preview]                       |

|                                                 |

|    Vision Analysis:                             |

|    "This appears to be a system architecture    |

|    diagram showing a database connection        |

|    failure. The red X markings suggest an       |

|    urgent infrastructure issue."                |

|                                                 |

|    Urgency: HIGH (contains error indicators)    |

|                                                 |

|    Suggested Response:                          |

|    "Thank you for the diagram. I've escalated   |

|    this to Mr. Schoettler immediately given     |

|    the infrastructure alert."                   |

|                                                 |

|    [Escalate] [Acknowledge] [Manual]            |

+-------------------------------------------------+

```

### MMS Implementation Checklist

- [ ] **Gateway Configuration**
  - [ ] Enable MMS reception
  - [ ] Configure media upload (temp URL preferred)
  - [ ] Set max file size (5MB recommended)
  - [ ] Set retention period (24 hours)

- [ ] **Image Processing**
  - [ ] Download/decode media from webhook
  - [ ] Vision API integration (Claude/GPT-4V)
  - [ ] Extract urgency indicators from images
  - [ ] Generate text descriptions

- [ ] **Telegram Forwarding**
  - [ ] Send inline image previews
  - [ ] Include vision analysis
  - [ ] Preserve original quality
  - [ ] Support multiple attachments

### Vision Analysis Prompts

**For Diagrams/Screenshots:**
```
"Analyze this image that was sent via SMS. Identify:
1. Type of content (diagram, screenshot, photo, etc.)
2. Any urgency indicators (red, error messages, warnings)
3. Technical context (infrastructure, code, design)
4. Suggested priority level (urgent, normal, low)"
```

**For Photos:**
```
"Describe this photo sent via SMS:
1. Main subject
2. Any text visible in image
3. Possible intent (documentation, problem reporting, sharing)
4. Whether this requires immediate attention"
```

## Calendar Integration (gogcli Skill)

**Dependency:** `gogcli` skill (on your todo list)

**Purpose:** Auto-detect availability and sync with calendar state

### Integration Points

**1. Auto-Detect "In Meeting" State**
```javascript
// Periodic check (every 5 minutes)
const currentEvent = await gogcli.getCurrentEvent();

if (currentEvent) {
  // Auto-set Immersion Mode
  setState({
    mode: 'immersion',
    reason: `In meeting: ${currentEvent.title}`,
    until: currentEvent.end,
    auto_set: true
  });

  // Update deflection message
  defaultMessage = `Mr. Schoettler is currently in a meeting
    (${currentEvent.title}) until ${formatTime(currentEvent.end)}.`
}
```

**2. Free/Busy Checking for Responses**
```
Contact: "Can we meet Thursday?"

${assistantName}:
1. Call gogcli.checkAvailability('Thursday')
2. Get free slots: [2-4 PM, 5-6 PM]
3. Reply: "Thursday looks promising. Would 2 PM or 5 PM work better?
   I can send a calendar invite once you choose."
```

**3. Post-Meeting Briefings**
```
Meeting ends at 3:15 PM

Babbage → Telegram:
"Your client meeting finished. During the 90-minute session:
- 2 messages deflected (both routine)
- 1 VIP message held (Alice asking about dinner)

You're now available. Shall I notify queued contacts?"
```

**4. Vacation/OOO Detection**
```
// If calendar shows all-day "Vacation" event
if (gogcli.hasAllDayEvent('vacation|ooo|out of office')) {
  setState({
    mode: 'vacation',
    until: vacationEvent.end,
    auto_set: true
  });

  defaultMessage = `Mr. Schoettler is on vacation until
    ${formatDate(vacationEvent.end)}. For urgent matters,
    please contact [backup].`
}
```

### gogcli Tool Interface

**Expected commands:**
```bash
# Check current event
gogcli current
# Output: { title: "Client Meeting", start: "2PM", end: "4PM" }

# Check availability for a day
gogcli free-busy --date 2026-02-06
# Output: { free_slots: ["2-4 PM", "5-6 PM"] }

# Get events for date range
gogcli events --from today --to "+7days"
# Output: [{ title: "...", start: "...", end: "..." }, ...]
```

**Implementation note:** Once gogcli skill exists, add it as a tool in The butler's toolkit. Until then, calendar integration is optional.

## File Structure

```
extensions/antenna/
├── package.json            # Extension metadata
├── EXTENSION.md            # Extension documentation
├── README.md               # Setup and usage guide
├── src/
│   ├── index.ts            # Extension entry point
│   ├── webhook.ts          # Inbound webhook handler
│   ├── vip-manager.ts      # VIP list management
│   ├── urgency-detector.ts # Multi-factor urgency scoring
│   ├── urgency-learning.ts # Learn from manual overrides
│   ├── response-crafter.ts # Reply generation
│   ├── state-manager.ts    # Immersion mode, watchdog, etc.
│   ├── context-store.ts    # Conversation memory (SQLite)
│   ├── thread-manager.ts   # Conversation threading state machine
│   ├── mms-handler.ts      # Media processing & vision analysis
│   ├── rate-limiter.ts     # DOS protection & spam detection
│   ├── calendar-sync.ts    # gogcli integration (future)
│   └── tools/
│       ├── send-sms.ts     # Outbound SMS tool
│       ├── send-mms.ts     # Outbound MMS tool
│       ├── notify-escalate.ts  # Telegram notification tool
│       └── gogcli.ts       # Calendar checking tool (future)
└── test/
    ├── scenarios.test.ts   # Automated test scenarios
    └── fixtures/           # Test data

~/.openclaw/
├── sms-vips.json           # VIP contact list
├── sms-state.json          # Current state (immersion, watchdog, etc.)
├── sms-context.db          # SQLite: conversations, deflections, patterns
├── sms-learning.db         # Override patterns, adaptive rules
├── sms-queue.json          # Queued messages during failures
└── sms-history/
    └── 2026-02/
        └── conversations/
            ├── thread_001.json
            └── media/
                └── abc123.jpg  # Cached MMS attachments

scripts/
├── test-sms-scenarios.ts   # Automated Twilio tests
├── sms-health-check.sh     # Webhook health monitoring
└── sms-shadow-report.ts    # Shadow mode analysis
```

## VIP List Schema

**~/.openclaw/sms-vips.json:**
```json
{
  "version": 1,
  "contacts": [
    {
      "phone": "+1-555-1234",
      "name": "Alice (Wife)",
      "priority": 1,
      "rules": {
        "always_notify": true,
        "auto_reply": true,
        "bypass_deep_work": true
      }
    },
    {
      "phone": "+1-555-5678",
      "name": "Bob (Boss)",
      "priority": 2,
      "rules": {
        "always_notify": true,
        "auto_reply": true,
        "bypass_deep_work": false,
        "business_hours_only": true
      }
    },
    {
      "phone": "+1-555-9999",
      "name": "Charlie (Client)",
      "priority": 3,
      "rules": {
        "always_notify": false,
        "auto_reply": true,
        "bypass_deep_work": false,
        "urgent_keywords": ["contract", "deadline", "meeting"]
      }
    }
  ],
  "default_rules": {
    "unknown_notify": false,
    "unknown_auto_reply": true,
    "urgent_keywords": [
      "emergency", "urgent", "asap", "help",
      "hospital", "locked out", "keys"
    ]
  }
}
```

## State Management Schema

**~/.openclaw/sms-state.json:**
```json
{
  "mode": "available",
  "modes": {
    "available": {
      "active": true,
      "message": "Available for messages"
    },
    "deep_work": {
      "active": false,
      "until": "2026-02-01T15:00:00Z",
      "allow_vip": true,
      "allow_urgent": true,
      "message": "In deep work session until 3 PM"
    },
    "vacation": {
      "active": false,
      "until": "2026-02-10T00:00:00Z",
      "allow_vip": true,
      "allow_urgent": true,
      "backup_contact": "+1-555-BACKUP",
      "message": "On vacation until Feb 10"
    }
  },
  "last_updated": "2026-02-01T10:00:00Z"
}
```

## System Prompt Addition

```markdown
# SMS Butler Persona

You are Babbage, Mr. Schoettler's personal SMS butler. Your role is to
manage incoming text messages with discretion, professionalism, and
contextual awareness.

## Core Principles

1. **Protective but Polite**: Shield Mr. Schoettler's focus time while
   maintaining warm, professional communication.

2. **Context-Aware**: Reference specific details from messages to show
   you're truly listening, not sending canned responses.

3. **Set Expectations**: Always indicate when the sender can expect a
   response from Mr. Schoettler.

4. **Escalate Wisely**: Know when to interrupt (emergencies, VIPs) vs.
   when to queue (routine inquiries).

## Response Style

- Formal but approachable ("Good afternoon" not "Hey")
- Concise (2-3 sentences ideal)
- Action-oriented (acknowledge, inform, offer next steps)
- Never robotic (avoid "This is an automated message")

## Tools Available

- `send_sms`: Send reply via SMS
- `notify_user`: Alert Mr. Schoettler via Telegram
- `check_vip_status`: Look up contact priority
- `check_calendar`: See if he's free
- `set_state`: Update availability mode

## Decision Matrix

| VIP | Urgency | Action |
|-----|---------|--------|
| Yes | High | Notify immediately + Hold reply |
| Yes | Low | Auto-reply + Queue |
| No | High | Notify + Verify sender |
| No | Low | Polite deflection |

## Current State

{state_from_sms_state_json}

## VIP List

{vip_list_from_sms_vips_json}
```

## API Integration: SMS Gateway

**Outbound SMS Request:**
```bash
POST https://smsgateway.me/api/v4/message/send
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "phone_number": "+1234567890",
  "message": "Your response text here",
  "device_id": "12345"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "id": "msg_abc123",
    "status": "queued"
  }
}
```

## Command Examples

**User → Babbage (via SMS):**

1. **Enable Deep Work Mode:**
   ```
   You: "Babbage, deep work for 2 hours. Only wife gets through."

   ${assistantName}: "Understood. Deep work mode active until 1 PM.
   Only Alice will be able to reach you. All other messages
   will be politely deflected and queued."
   ```

2. **Check Status:**
   ```
   You: "Babbage, status"

   ${assistantName}: "Current mode: Deep Work (52 min remaining).
   3 messages queued: Bob (work question), Unknown +1-555-9999
   (sales), Charlie (meeting request). Shall I summarize?"
   ```

3. **Vacation Mode:**
   ```
   You: "Babbage, vacation mode until Monday. Backup: Dave"

   ${assistantName}: "Vacation mode activated until Feb 3. Urgent
   matters will be directed to Dave at +1-555-DAVE. Safe
   travels, Sir."
   ```

## Security Considerations

1. **Webhook Authentication**
   - Require bearer token on /sms/inbound
   - Validate request signatures from SMS Gateway
   - Rate limit to prevent abuse

2. **VIP Data Protection**
   - Encrypt sms-vips.json at rest
   - Don't log phone numbers in plain text
   - Sanitize logs before sharing

3. **Message Privacy**
   - Store messages encrypted
   - Auto-delete after 30 days
   - Option to disable logging per contact

4. **Access Control**
   - Only you can modify VIP list
   - State changes require authentication
   - Separate permission for viewing message history

## Testing Strategy

### Shadow Mode (Week 1 - Critical!)

**Purpose:** Test all logic without sending real SMS replies

**Implementation:**
```javascript
const SHADOW_MODE = process.env.BABBAGE_SHADOW_MODE === 'true';

if (SHADOW_MODE) {
  // Process everything normally BUT
  log.info('SHADOW: Would have sent SMS:', {
    to: contact,
    message: response,
    reason: decision
  });
  // DON'T actually send SMS
  // Only send Telegram briefings for review
} else {
  // Normal operation
  sendSMS(contact, response);
}
```

**Shadow Mode Workflow:**
```
Day 1-3: Shadow mode ON
  → Process all incoming SMS
  → Log what Babbage WOULD do
  → Send Telegram: "Shadow report: Here's what I would have sent..."
  → You review decisions

Day 4-5: Review & tune
  → Check false positives (routine escalated)
  → Check false negatives (urgent missed)
  → Adjust urgency scoring thresholds
  → Update tier assignments

Day 6-7: Confidence check
  → Shadow mode still on
  → Verify improvements
  → If 95%+ accuracy → Go live

Day 8+: Live mode
  → Shadow mode OFF
  → Babbage sends real SMS
  → Continue monitoring via Telegram briefings
```

### Twilio Test Numbers

**Setup:**
```bash
# Purchase 3 Twilio numbers for testing
+1-XXX-TEST-VIP    → Simulates Tier 1 (VIP)
+1-XXX-TEST-WORK   → Simulates Tier 2 (Colleague)
+1-XXX-TEST-SPAM   → Simulates Tier 3 (Unknown)

# Add to VIP list for testing
{
  "phone": "+1-XXX-TEST-VIP",
  "name": "Test VIP",
  "priority": 1,
  "test": true
}
```

**Automated Test Scenarios:**
```javascript
// scripts/test-sms-scenarios.ts

const scenarios = [
  {
    name: 'urgent_vip_emergency',
    from: TEST_VIP,
    message: 'Emergency - server is down!',
    expected: {
      urgency_score: '>0.8',
      action: 'immediate_notify',
      telegram_sent: true,
      sms_sent: true
    }
  },
  {
    name: 'routine_work_question',
    from: TEST_WORK,
    message: 'Quick question about the project',
    expected: {
      urgency_score: '0.3-0.5',
      action: 'deflect',
      telegram_sent: true,
      sms_sent: true
    }
  },
  {
    name: 'spam_unknown',
    from: TEST_SPAM,
    message: 'LIMITED TIME OFFER! Click here now!',
    expected: {
      urgency_score: '<0.2',
      action: 'silent_ignore',
      telegram_sent: false,
      sms_sent: false
    }
  },
  {
    name: 'conversation_thread',
    exchanges: [
      { from: TEST_WORK, text: 'Can you send the proposal?' },
      { expect_babbage: 'Which proposal?' },
      { from: TEST_WORK, text: 'Q1 marketing' },
      { expect_babbage: 'May I ask who you are?' },
      { from: TEST_WORK, text: 'Jennifer from Acme' },
      { expect_telegram_briefing: true, expect_state: 'awaiting_human' }
    ]
  },
  {
    name: 'repeat_escalation',
    messages: [
      { delay: 0, text: 'Hey are you there?', expect_score: '0.3' },
      { delay: 300000, text: 'Hello?', expect_score: '0.5' }, // 5min later
      { delay: 300000, text: 'This is urgent!', expect_score: '0.7' } // 10min total
    ],
    expected: {
      final_action: 'escalate_notify'
    }
  }
];

// Run all scenarios
npm run test:sms:scenarios
```

**Manual Test Checklist:**
- [ ] Send test SMS from each tier → Verify correct handling
- [ ] Test urgency keywords → Verify scoring
- [ ] Test conversation threading → Verify state machine
- [ ] Test repeat messages → Verify escalation
- [ ] Test MMS with image → Verify vision analysis
- [ ] Test state commands → Verify mode changes
- [ ] Test Telegram dictation → Verify response crafting
- [ ] Test rate limiting → Verify DOS protection

### Unit Tests
- [ ] VIP lookup accuracy
- [ ] Multi-factor urgency scoring algorithm
- [ ] Priority scoring with edge cases
- [ ] Response template rendering
- [ ] Thread state transitions
- [ ] Context extraction from messages

### Integration Tests
- [ ] Webhook receives and parses correctly
- [ ] Babbage agent processes message end-to-end
- [ ] SMS sends successfully via gateway
- [ ] Telegram notifications deliver
- [ ] Thread state persists across messages
- [ ] Calendar integration (if gogcli available)

### E2E Scenarios
- [ ] Unknown sender, routine message → Polite deflection
- [ ] VIP sender, urgent message → Immediate escalation
- [ ] Deep work mode blocks routine, allows urgent
- [ ] State command updates mode correctly
- [ ] Thread tracking maintains context across turns
- [ ] Multi-turn conversation reaches "ready for human"
- [ ] MMS image analyzed and forwarded to Telegram
- [ ] Rate limit triggers after spam flood

## Failure Modes & Fallback Strategy

**Unflappable Operation Requires Redundancy**

### Failure Matrix

| Component | Failure Scenario | Detection | Mitigation | Fallback |
|-----------|------------------|-----------|------------|----------|
| **Tailscale VPN** | Disconnects, phone loses connection | Gateway heartbeat missing >2min | Auto-reconnect on phone | Forward SMS to your phone directly |
| **SMS Gateway App** | Crashes, stops forwarding | No webhook received for >5min | App auto-restart | Phone native SMS notifications resume |
| **OpenClaw Container** | Crashes, OOM, exits | Docker health check fails | Auto-restart via Docker/systemd | Queue messages in gateway, process when back |
| **Babbage Agent** | LLM timeout, API error | Agent run exceeds 30s | Retry with exponential backoff | Fall back to keyword-based rules |
| **Telegram API** | Rate limited, blocked | Send fails, HTTP 429 | Queue notifications, retry later | Fallback to SMS command channel |
| **SQLite Context DB** | Corruption, locked | DB query fails | Rebuild from message history | Operate stateless (no thread memory) |
| **SMS Send Failure** | Gateway API down | HTTP error on send | Retry 3x with backoff | Log failure, alert via Telegram |

### Layered Fallback Strategy

```
Layer 1: Full Intelligence
  ✓ Multi-factor urgency scoring
  ✓ Conversation threading
  ✓ Calendar integration
  ✓ Learning from overrides
  └─> If LLM timeout → Layer 2

Layer 2: Simple Rules
  ✓ Keyword-based urgency
  ✓ VIP tier checking
  ✓ Canned responses
  └─> If agent crashes → Layer 3

Layer 3: Direct Passthrough
  ✓ Forward all SMS to your phone
  ✓ No auto-replies
  ✓ Log everything for later review
  └─> Manual handling (failsafe)
```

### Health Monitoring

**Webhook Health Check:**
```bash
# Cron job every 5 minutes
*/5 * * * * /usr/local/bin/sms-health-check.sh

#!/bin/bash
# sms-health-check.sh

LAST_WEBHOOK=$(cat ~/.openclaw/sms-last-webhook-timestamp)
NOW=$(date +%s)
DIFF=$((NOW - LAST_WEBHOOK))

# If no webhook received in 10 minutes (but phone is active)
if [ $DIFF -gt 600 ]; then
  # Send test SMS from Twilio to verify pipeline
  curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
    --data-urlencode "From=$TWILIO_TEST_NUMBER" \
    --data-urlencode "To=$YOUR_PHONE" \
    --data-urlencode "Body=HEALTH_CHECK_PING" \
    -u "$TWILIO_SID:$TWILIO_AUTH_TOKEN"

  # If health check SMS arrives → Pipeline working
  # If health check SMS doesn't arrive → Alert failure
fi
```

**Container Health Check:**
```yaml
# docker-compose.yml
services:
  openclaw-gateway:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Babbage Watchdog:**
```javascript
// If Babbage doesn't respond within 2 minutes
const PROCESSING_TIMEOUT = 120000; // 2 minutes

setTimeout(() => {
  if (!smsProcessed) {
    log.error('Babbage timeout - falling back to direct delivery');

    // Send original SMS to your phone
    sendDirectSMS(YOUR_PHONE, `
      Fwd from ${senderName}: ${originalMessage}

      [Babbage failed to process - manual handling required]
    `);

    // Alert via Telegram
    sendTelegram(`⚠️ SMS processing timeout
      From: ${senderName}
      Message: ${originalMessage}

      Forwarded to your phone for manual handling.`);
  }
}, PROCESSING_TIMEOUT);
```

### Graceful Degradation Examples

**Scenario 1: LLM API Timeout**
```
Normal: Multi-factor urgency scoring
Degraded: Simple keyword matching
Fallback: Forward everything to you

Timeline:
0-30s: Wait for LLM
30s: Timeout, use keyword rules
60s: Still processing? Forward to phone
```

**Scenario 2: Tailscale Disconnected**
```
Detection: No webhook received for 5 minutes
Action:
1. Phone app detects disconnect
2. Falls back to direct SMS forwarding
3. Stores messages locally for later sync
4. When Tailscale reconnects → Sync backlog to OpenClaw
```

**Scenario 3: Telegram API Down**
```
Normal: Send briefing via Telegram
Degraded: Queue briefings in local file
Fallback: Send SMS to your phone with summary

Example:
"Babbage Summary (Telegram down):
- 3 messages deflected
- 1 VIP (Alice) - held for you
- Queue: ~/.openclaw/telegram-queue.json"
```

### Recovery Procedures

**After Failure:**
1. Log everything that happened during downtime
2. Process queued messages in chronological order
3. Send catch-up briefing: "During the 15min outage, here's what happened..."
4. Mark recovered messages so you know context

**Backlog Processing:**
```javascript
// When OpenClaw comes back online
const queuedMessages = loadFromDisk('~/.openclaw/sms-queue.json');

for (const msg of queuedMessages) {
  // Process with "[BACKLOG]" prefix
  processMessage({
    ...msg,
    backlog: true,
    originalTimestamp: msg.timestamp
  });

  // Add to Telegram briefing
  briefing += `[BACKLOG from ${formatTime(msg.timestamp)}] ${msg.from}: ${msg.text}\n`;
}

sendTelegram(`Recovery complete. Processed ${queuedMessages.length} queued messages.`);
```

## Cost Estimation

- **SMS Gateway App**: Free (or ~$5/month for premium)
- **SMS API Costs**: ~$0.01 per message
- **Twilio Test Numbers**: ~$1/month per number ($3 total)
- **OpenClaw LLM**: Already running (marginal cost)
- **Tailscale**: Free tier sufficient

**Expected Usage:**
- 10-20 inbound SMS/day
- 5-10 auto-replies/day
- 3 Twilio test numbers
- Cost: ~$6-8/month

## Rollout Plan (Revised with Shadow Mode)

### Week 1: Infrastructure + Shadow Mode

**Days 1-2: Basic Infrastructure**
- Set up webhook handler
- Configure Twilio test numbers
- Implement VIP tier checking
- Basic message routing

**Days 3-5: Shadow Mode Testing**
- Enable `BABBAGE_SHADOW_MODE=true`
- Process all messages without sending replies
- Log decisions to Telegram for review
- Run automated test scenarios
- Identify tuning needs

**Days 6-7: Calibration**
- Adjust urgency scoring thresholds
- Tune VIP tier assignments
- Fix false positives/negatives
- Final shadow mode validation

### Week 2: Intelligence Layer

**Days 1-3: Core Logic**
- Multi-factor urgency scoring
- Conversation threading
- Context-aware response crafting
- Babbage persona implementation

**Days 4-5: State Management**
- Immersion mode
- Watchdog mode
- State commands
- Mode transitions

**Days 6-7: MMS & Media**
- Image handling
- Vision analysis integration
- Telegram image forwarding
- Media caching

### Week 3: Advanced Features

**Days 1-3: Learning & Adaptation**
- Override tracking
- Adaptive rule suggestions
- Rate limiting
- DOS protection

**Days 4-5: Calendar Integration**
- gogcli integration (if ready)
- Auto-detect meeting state
- Free/busy checking
- Post-meeting briefings

**Days 6-7: Failure Modes**
- Health monitoring
- Fallback strategies
- Recovery procedures
- Stress testing

### Week 4: Live Deployment

**Days 1-2: Soft Launch**
- Disable shadow mode
- Monitor first live day closely
- Quick iteration on issues
- Keep Telegram briefings verbose

**Days 3-5: Tuning**
- Adjust based on real usage
- Fine-tune urgency scoring
- Update tier assignments
- Optimize response templates

**Days 6-7: Full Production**
- Confident operation
- Reduce Telegram verbosity
- Enable learning mode
- Document final configuration

## Success Metrics

- [ ] 90%+ of routine messages handled without interruption
- [ ] 100% of urgent VIP messages escalated within 1 minute
- [ ] 0 false negatives (urgent missed)
- [ ] <5% false positives (routine escalated)
- [ ] Average response time: <2 minutes

## Future Enhancements

1. **Voice Call Handling**
   - Integrate with VoIP provider
   - Voice-to-text transcription
   - "Screen" calls like messages

2. **Multi-Language Support**
   - Detect sender's language
   - Reply in same language
   - Translation for notifications

3. **Smart Scheduling**
   - "Set up a meeting with Bob"
   - Check both calendars
   - Propose times, confirm

4. **Context Preservation**
   - Remember previous conversations
   - Reference earlier discussions
   - Build relationship graph

5. **Sentiment Analysis**
   - Detect frustration, anger
   - Escalate emotional messages
   - Adjust tone accordingly

---

## Quick Start Commands

Once implemented, interact with Babbage via:

**SMS Commands (from your phone):**
- `babbage status` - Check current mode
- `babbage deep 2h` - Enable deep work for 2 hours
- `babbage vacation until monday` - Set vacation mode
- `babbage allow +1234567890` - Temporarily allow a number
- `babbage summary` - Get queued messages summary

**CLI Commands (from server):**
- `openclaw sms vips add +1234567890 "Alice" --priority 1`
- `openclaw sms vips list`
- `openclaw sms state set deep-work --duration 2h`
- `openclaw sms history --since today`

---

## Enhancement Summary (Added 2026-02-01)

**The following advanced features were added to the original plan:**

### 1. Multi-Factor Urgency Scoring ⭐
- Weighted algorithm combining 5 factors
- Keyword analysis (30%), sender history (20%), time context (20%)
- Message structure (10%), repeat escalation (20%)
- Tunable thresholds per tier
- Prevents false positives/negatives

### 2. Conversation Threading State Machine ⭐
- Multi-turn conversation support
- State transitions: new_inquiry → gathering_info → awaiting_human → resolved
- Context extraction across exchanges
- "Ready for human" detection
- Thread memory prevents redundant questions

### 3. Testing Infrastructure
- **Shadow Mode**: Test all logic without sending real SMS (Week 1)
- **Twilio Test Numbers**: 3 dedicated numbers for automated testing
- **Test Scenarios**: 50+ automated test cases
- **95% accuracy requirement** before going live

### 4. Calendar Integration (gogcli)
- Auto-detect "in meeting" state → Set immersion mode
- Free/busy checking for scheduling
- Post-meeting briefings with queued messages
- Vacation/OOO auto-detection

### 5. Learning from Overrides
- Track when you manually respond vs The butler's action
- Identify patterns in your behavior
- Suggest rule updates: "You often respond to budget messages immediately"
- Adaptive urgency scoring

### 6. Rate Limiting & DOS Protection
- Detect spam floods (3+ messages in 10min)
- Throttle non-VIP repeated contacts
- VIP spam detection (unusual behavior alert)
- Cooldown periods

### 7. Failure Modes & Graceful Degradation
- 3-layer fallback: Full Intelligence → Simple Rules → Direct Passthrough
- Health monitoring (webhook, container, agent)
- Recovery procedures with backlog processing
- Watchdog: 2-minute timeout → Forward to phone

### 8. Time-Based Contextual Rules
- Work hours vs off-hours priority adjustments
- Weekend tier changes (e.g., boss demoted on Saturday)
- Holiday/vacation auto-detection
- Location-aware rules (future)

### 9. Enhanced File Structure
- Modular components (urgency-detector, thread-manager, rate-limiter)
- Separate learning database
- Test scripts and health checks
- Queue persistence for failure recovery

### 10. Revised Rollout Strategy
- **Week 1**: Shadow mode + testing (CRITICAL)
- **Week 2**: Intelligence layer
- **Week 3**: Advanced features
- **Week 4**: Live deployment with tuning

---

## Antenna: Project Metadata

**Project Name:** Antenna 🦞📡
**Tagline:** "Sensing signals, protecting focus"

**Created:** 2026-02-01
**Status:** Planning (Enhanced with advanced features)
**Architecture:** OpenClaw Extension
**Location:** `extensions/antenna/`

**Estimated Effort:** 4 weeks
- Week 1: Shadow mode + testing
- Week 2: Intelligence layer
- Week 3: Advanced features
- Week 4: Live deployment

**Dependencies:**
- Android phone
- SMS Gateway app (or Twilio)
- Tailscale (for secure webhook)
- Twilio test numbers (for testing)

**Optional:**
- gogcli skill (for calendar integration)

**Priority:** High (Quality of life + intelligent automation)

**Key Success Metrics:**
- ✅ 0 urgent messages missed
- ✅ <5% routine messages escalated
- ✅ Adapts to any OpenClaw identity persona
- ✅ Unflappable operation (graceful degradation)

**Inspiration:** Jarvis (Iron Man) - A real-life Tony Stark assistant without the suit

```
