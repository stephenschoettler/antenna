# Antenna Documentation Index

Complete guide to Antenna's intelligent message routing system.

## 📚 Documentation Structure

### Quick Start Guides

1. **[QUICK_START.md](QUICK_START.md)** - Get running in 10 minutes
   - One-page setup guide
   - Minimal configuration examples
   - First SMS test walkthrough
   - Perfect for: First-time users, rapid prototyping

2. **[DOCKER.md](DOCKER.md)** - Docker deployment guide
   - Complete Docker Compose setup
   - RabbitMQ service included
   - Production deployment tips
   - Perfect for: Containerized deployments, easy scaling

### Integration Guides

3. **[DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)** - DekuSMS + Antenna complete guide
   - Why DekuSMS + Antenna = SMS control center
   - Architecture diagrams (text/ASCII)
   - Prerequisites checklist
   - Step-by-step installation (DekuSMS + Antenna + RabbitMQ)
   - Usage examples (VIP routing, auto-responses, manual replies)
   - Comprehensive troubleshooting (webhooks, RabbitMQ, E.164 formatting)
   - Advanced configuration (Tailscale, load balancing, monitoring)
   - Perfect for: Production deployments, Android SMS automation

4. **[INTEGRATION.md](INTEGRATION.md)** - Siphon Engine integration architecture
   - MessageProcessor overview
   - Configuration loading
   - Webhook integration patterns
   - Perfect for: Understanding internal architecture

### Core Documentation

5. **[README.md](README.md)** - Main project overview
   - Feature overview
   - Architecture diagrams
   - Quick start commands
   - API endpoints reference
   - Links to all other docs
   - Perfect for: Project overview, GitHub visitors

6. **[src/handlers/README.md](src/handlers/README.md)** - Handler documentation
   - QueueManager (SQLite queue)
   - TelegramNotifier (instant notifications)
   - AutoResponder (SMS/email responses)
   - RoutingHandler (intelligent routing)
   - Perfect for: Developers, extending functionality

### Configuration Files

7. **[antenna.config.yaml](antenna.config.yaml)** - Main configuration
   - VIP tiers and contacts
   - Urgency thresholds
   - LLM provider settings
   - RabbitMQ connection details

8. **[.env.example](.env.example)** - Environment variables template
   - Telegram credentials
   - RabbitMQ connection
   - Twilio (optional)
   - SMTP (optional)
   - Anthropic API key (optional)

### Docker Files

9. **[docker-compose.yml](docker-compose.yml)** - Multi-service Docker setup
   - Antenna server
   - RabbitMQ with management UI
   - Automatic queue initialization
   - Volume mounts for persistence

10. **[Dockerfile](Dockerfile)** - Antenna container image
    - Node.js 20 Alpine base
    - Production dependencies only
    - Health checks included

11. **[rabbitmq/](rabbitmq/)** - RabbitMQ configuration
    - `rabbitmq.conf`: Server configuration
    - `definitions.json`: Queue/user definitions

## 🎯 Quick Navigation

### I want to...

#### Get started quickly
→ **[QUICK_START.md](QUICK_START.md)**

#### Deploy with Docker
→ **[DOCKER.md](DOCKER.md)**

#### Set up DekuSMS integration
→ **[DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)**

#### Understand the architecture
→ **[README.md](README.md)** (Architecture section)  
→ **[INTEGRATION.md](INTEGRATION.md)**

#### Configure routing rules
→ **[antenna.config.yaml](antenna.config.yaml)**  
→ **[src/handlers/README.md](src/handlers/README.md)** (RoutingHandler section)

#### Troubleshoot issues
→ **[DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)** (Troubleshooting section)  
→ **[DOCKER.md](DOCKER.md)** (Troubleshooting section)

#### Extend functionality
→ **[src/handlers/README.md](src/handlers/README.md)**  
→ **[INTEGRATION.md](INTEGRATION.md)**

#### Deploy to production
→ **[DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)** (Advanced Configuration)  
→ **[DOCKER.md](DOCKER.md)** (Production Deployment)

## 📖 Reading Order

### For New Users
1. [README.md](README.md) - Get the big picture
2. [QUICK_START.md](QUICK_START.md) - Set up a test environment
3. [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md) - Full production setup

### For Docker Users
1. [README.md](README.md) - Understand the system
2. [DOCKER.md](DOCKER.md) - Deploy with Docker Compose
3. [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md) - Configure DekuSMS connection

### For Developers
1. [INTEGRATION.md](INTEGRATION.md) - Architecture overview
2. [src/handlers/README.md](src/handlers/README.md) - Handler details
3. [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines

## 🚀 Common Workflows

### Workflow 1: Local Testing (No Docker)
1. Read [QUICK_START.md](QUICK_START.md)
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Edit `antenna.config.yaml`
5. Run: `npm run dev`
6. Test webhook: `curl -X POST http://localhost:3000/webhooks/dekusms -d '...'`

### Workflow 2: Docker Deployment
1. Read [DOCKER.md](DOCKER.md)
2. Copy `.env.example` to `.env` and configure
3. Edit `antenna.config.yaml`
4. Run: `docker-compose up -d`
5. Check health: `curl http://localhost:3000/health`
6. View logs: `docker-compose logs -f`

### Workflow 3: DekuSMS Production Setup
1. Read [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)
2. Install DekuSMS on Android (F-Droid or APK)
3. Set up RabbitMQ (local or cloud)
4. Configure Antenna with VIP list and Telegram bot
5. Configure DekuSMS cloud forwarding (webhook)
6. Configure DekuSMS RabbitMQ gateway (bidirectional SMS)
7. Test incoming SMS → Telegram notification
8. Test outgoing SMS → RabbitMQ → DekuSMS

## 📝 File Size Reference

| File | Size | Type |
|------|------|------|
| DEKUSMS_INTEGRATION.md | 24K | Comprehensive guide |
| DOCKER.md | 10K | Docker deployment |
| QUICK_START.md | 7.2K | Quick start |
| README.md | ~8K | Project overview |
| INTEGRATION.md | ~10K | Architecture |
| src/handlers/README.md | ~8K | Handler docs |
| docker-compose.yml | 3.1K | Docker config |
| antenna.config.yaml | <1K | Main config |
| .env.example | 2.9K | Env template |

**Total documentation**: ~70K+ of production-focused guides and references.

## 🔗 External Resources

- **DekuSMS**: https://github.com/deku-messaging/Deku-SMS-Android
- **F-Droid**: https://f-droid.org/packages/com.afkanerd.deku/
- **RabbitMQ**: https://www.rabbitmq.com/
- **Telegram Bots**: https://core.telegram.org/bots
- **Tailscale**: https://tailscale.com/
- **E.164 Format**: https://en.wikipedia.org/wiki/E.164

## 🆘 Support

### Getting Help

1. **Check troubleshooting sections**:
   - [DEKUSMS_INTEGRATION.md § Troubleshooting](DEKUSMS_INTEGRATION.md#troubleshooting)
   - [DOCKER.md § Troubleshooting](DOCKER.md#troubleshooting)

2. **Review logs**:
   - Direct: `tail -f logs/antenna.log`
   - Docker: `docker-compose logs -f antenna`
   - PM2: `pm2 logs antenna`

3. **Check configuration**:
   - Config syntax: `cat antenna.config.yaml`
   - Environment: `cat .env`
   - Health: `curl http://localhost:3000/health`

4. **Common issues**:
   - Webhook not receiving → Check network/firewall/HTTPS
   - RabbitMQ connection failed → Verify credentials and connectivity
   - E.164 formatting → Always use `+[country][number]` format

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Coding standards
- Testing guidelines
- Pull request process

## 📊 Documentation Metrics

- **Total pages**: 11 main documentation files
- **Total examples**: 50+ code snippets and configurations
- **Troubleshooting guides**: 3 comprehensive sections
- **Deployment options**: 4 (local, Docker, Docker Compose, production)
- **Integration guides**: 2 (Siphon Engine, DekuSMS)

## 🎉 Ready to Start?

Pick your path:
- **Quick test**: [QUICK_START.md](QUICK_START.md)
- **Docker**: [DOCKER.md](DOCKER.md)
- **Production**: [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)

---

**Last Updated**: 2026-02-06  
**Documentation Version**: 1.0  
**Antenna Version**: Latest
