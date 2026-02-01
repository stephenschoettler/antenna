# Contributing to Antenna

Thanks for your interest in contributing to Antenna! 🦞📡

## Development Setup

### Prerequisites

- Node.js 22+ (or Bun)
- pnpm (recommended) or npm
- OpenClaw installed and configured

### Initial Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/antenna.git
cd antenna

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test
```

### Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Write code in `src/`
   - Add tests in `test/`
   - Update README if needed

3. **Test your changes**
   ```bash
   pnpm build
   pnpm test
   pnpm lint
   ```

4. **Commit**
   - Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
   - Example: `feat: add multi-factor urgency scoring`

5. **Submit PR**
   - Push your branch
   - Create pull request
   - Describe what changed and why

## Code Style

- TypeScript strict mode
- ESM modules (`import`/`export`)
- Oxlint/Oxfmt for linting and formatting
- Run `pnpm lint` before committing

## Testing

- Write tests for new features
- Maintain coverage >70%
- Use Shadow Mode for SMS testing (don't spam real contacts!)
- Twilio test numbers for automated scenarios

## Architecture Guidelines

### Persona-Agnostic Design

Antenna must work with ANY OpenClaw identity:
- ✅ Use `config.identity.name` dynamically
- ❌ Don't hardcode "Jarvis" or any specific name
- ✅ Professional baseline tone
- ✅ Adapt to configured personality

### Extension Pattern

Antenna is an OpenClaw extension:
- Register webhook routes via plugin SDK
- Use OpenClaw's agent/session infrastructure
- Don't duplicate core functionality
- Follow `extensions/msteams` pattern

### Key Principles

1. **Unflappable Operation**: Graceful degradation, never miss urgent messages
2. **No False Negatives**: Better to escalate routine than miss urgent
3. **Respect Privacy**: Encrypt sensitive data, sanitize logs
4. **Shadow Mode First**: Test thoroughly before going live
5. **Learning Loop**: Improve from user corrections

## Project Structure

```
antenna/
├── src/
│   ├── index.ts              # Extension entry point
│   ├── webhook.ts            # Inbound SMS handler
│   ├── urgency-detector.ts   # Multi-factor scoring
│   ├── thread-manager.ts     # Conversation state
│   └── tools/                # SMS/Telegram tools
├── test/
│   ├── scenarios.test.ts     # Automated tests
│   └── fixtures/             # Test data
└── scripts/
    └── shadow-report.ts      # Shadow mode analysis
```

## Submitting Issues

### Bug Reports

Include:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Shadow mode logs (if applicable)
- Your OpenClaw version

### Feature Requests

Include:
- Use case description
- Why it's needed
- Proposed implementation (optional)
- Examples of how it would work

## Shadow Mode Protocol

**IMPORTANT**: Always test in Shadow Mode first!

```bash
ANTENNA_SHADOW_MODE=true pnpm start
```

- Week 1: Shadow mode only
- Review Telegram reports
- Tune urgency thresholds
- Fix false positives/negatives
- Only go live after 95%+ accuracy

## Questions?

- Open an issue
- Check the README.md for detailed documentation
- Review existing PRs for examples

---

**Remember:** Antenna's goal is to be your intelligent SMS gateway - sensing signals, protecting focus. Every contribution should serve that mission. 🦞📡
