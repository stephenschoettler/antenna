# Docker Deployment Guide

Complete Docker and Docker Compose setup for Antenna + RabbitMQ.

## Quick Start

### 1. Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

```bash
# Verify installation
docker --version
docker-compose --version
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

**Minimum required variables**:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 3. Configure Antenna

```bash
# Edit antenna.config.yaml with your VIPs and settings
nano antenna.config.yaml
```

### 4. Start Services

```bash
# Start all services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

Services will start on:
- **Antenna**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (user: `deku_user`, pass: `change_this_password`)

### 5. Verify

```bash
# Check Antenna health
curl http://localhost:3000/health

# Check RabbitMQ queues
curl -u deku_user:change_this_password http://localhost:15672/api/queues

# Test webhook
curl -X POST http://localhost:3000/webhooks/dekusms \
  -H "Content-Type: application/json" \
  -d '{"from":"+15551234567","message":"test"}'
```

## Services

### Antenna Server

- **Port**: 3000
- **Volumes**:
  - `antenna.config.yaml`: Configuration (read-only)
  - `data/`: SQLite database and persistent storage
  - `logs/`: Application logs
- **Depends on**: RabbitMQ

### RabbitMQ

- **Ports**:
  - 5672: AMQP (for DekuSMS and Antenna)
  - 15672: Management UI
- **Credentials**: `deku_user` / `change_this_password` (change in docker-compose.yml)
- **Volumes**: `rabbitmq_data` (persistent message storage)
- **Queues**: `sms.inbound`, `sms.outbound` (auto-created)

## Common Commands

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart antenna

# Stop and remove all data (⚠️ WARNING: deletes volumes)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f antenna
docker-compose logs -f rabbitmq

# Last 100 lines
docker-compose logs --tail=100 antenna
```

### Execute Commands

```bash
# Shell into Antenna container
docker-compose exec antenna sh

# Check Antenna config
docker-compose exec antenna cat antenna.config.yaml

# Query SQLite database
docker-compose exec antenna sqlite3 data/antenna.db "SELECT * FROM messages LIMIT 5;"

# Shell into RabbitMQ container
docker-compose exec rabbitmq sh

# Check RabbitMQ status
docker-compose exec rabbitmq rabbitmqctl status
```

### Manage Queues

```bash
# List queues
docker-compose exec rabbitmq rabbitmqctl list_queues

# Purge a queue
docker-compose exec rabbitmq rabbitmqctl purge_queue sms.outbound

# List connections
docker-compose exec rabbitmq rabbitmqctl list_connections
```

## Configuration Updates

### Update antenna.config.yaml

```bash
# Edit config
nano antenna.config.yaml

# Reload without restart (if supported)
curl -X POST http://localhost:3000/admin/reload-config

# Or restart the service
docker-compose restart antenna
```

### Update Environment Variables

```bash
# Edit .env
nano .env

# Restart services to apply
docker-compose up -d
```

### Change RabbitMQ Password

```bash
# Edit docker-compose.yml
nano docker-compose.yml

# Change RABBITMQ_DEFAULT_PASS and RABBITMQ_URL

# Recreate containers
docker-compose down
docker-compose up -d

# Also update in DekuSMS app settings
```

## Networking

### Expose to DekuSMS (Android)

#### Option 1: Local Network (Development)

```bash
# Find your host IP
ip addr show | grep inet

# Use this IP in DekuSMS webhook URL
# Example: http://192.168.1.100:3000/webhooks/dekusms
```

#### Option 2: Tailscale (Recommended)

```bash
# Install Tailscale on host
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Get Tailscale hostname
tailscale status

# Use in DekuSMS:
# https://your-hostname.tailnet-name.ts.net/webhooks/dekusms
```

#### Option 3: Cloudflare Tunnel

```bash
# Install cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/

cloudflared tunnel create antenna
cloudflared tunnel route dns antenna antenna.yourdomain.com
cloudflared tunnel run --url http://localhost:3000 antenna
```

#### Option 4: ngrok (Testing Only)

```bash
ngrok http 3000

# Use the HTTPS URL in DekuSMS
# Example: https://abc123.ngrok.io/webhooks/dekusms
```

### Internal Docker Network

Services communicate via `antenna-network`:
- Antenna can reach RabbitMQ at `rabbitmq:5672`
- No need to expose RabbitMQ externally unless DekuSMS is on a different host

### External RabbitMQ Access (for DekuSMS)

If DekuSMS needs to connect to RabbitMQ:

```yaml
# docker-compose.yml
services:
  rabbitmq:
    ports:
      - "0.0.0.0:5672:5672"  # Expose to all interfaces
```

⚠️ **Security**: Use firewall rules or VPN (Tailscale) instead of exposing to the internet.

## Data Management

### Backup Database

```bash
# Create backup directory
mkdir -p backups

# Backup SQLite database
docker-compose exec antenna sqlite3 /app/data/antenna.db ".backup '/tmp/antenna-backup.db'"
docker cp antenna-server:/tmp/antenna-backup.db ./backups/antenna-$(date +%Y%m%d-%H%M%S).db

# Or directly from volume
docker run --rm -v antenna_antenna_data:/data -v $(pwd)/backups:/backups alpine \
  cp /data/antenna.db /backups/antenna-$(date +%Y%m%d-%H%M%S).db
```

### Restore Database

```bash
# Stop Antenna
docker-compose stop antenna

# Copy backup into container
docker cp ./backups/antenna-20260206.db antenna-server:/app/data/antenna.db

# Restart
docker-compose start antenna
```

### Backup RabbitMQ

```bash
# Export definitions (queues, exchanges, bindings)
docker-compose exec rabbitmq rabbitmqctl export_definitions /tmp/rabbitmq-backup.json
docker cp antenna-rabbitmq:/tmp/rabbitmq-backup.json ./backups/rabbitmq-$(date +%Y%m%d).json
```

### Restore RabbitMQ

```bash
docker cp ./backups/rabbitmq-20260206.json antenna-rabbitmq:/tmp/restore.json
docker-compose exec rabbitmq rabbitmqctl import_definitions /tmp/restore.json
```

## Troubleshooting

### Antenna Won't Start

```bash
# Check logs
docker-compose logs antenna

# Common issues:
# 1. Missing .env file
# 2. Invalid antenna.config.yaml
# 3. RabbitMQ not ready (increase depends_on delay)

# Verify config syntax
docker-compose exec antenna cat antenna.config.yaml
```

### RabbitMQ Connection Failed

```bash
# Check RabbitMQ is running
docker-compose ps rabbitmq

# Check RabbitMQ logs
docker-compose logs rabbitmq

# Test connection from Antenna container
docker-compose exec antenna wget -O- http://rabbitmq:15672/api/overview

# Check credentials
docker-compose exec rabbitmq rabbitmqctl list_users
```

### DekuSMS Can't Reach Webhook

```bash
# Check Antenna is accessible from Android device
# From another device on same network:
curl http://YOUR_HOST_IP:3000/health

# Check firewall
sudo ufw status
sudo ufw allow 3000/tcp

# Check Docker port binding
docker-compose ps
# Should show: 0.0.0.0:3000->3000/tcp
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Limit RabbitMQ memory in docker-compose.yml:
services:
  rabbitmq:
    deploy:
      resources:
        limits:
          memory: 512M

# Restart
docker-compose up -d
```

### Logs Growing Too Large

```bash
# Configure log rotation in docker-compose.yml:
services:
  antenna:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# Apply changes
docker-compose up -d
```

## Production Deployment

### Use Secrets Instead of .env

```yaml
# docker-compose.yml
services:
  antenna:
    environment:
      TELEGRAM_BOT_TOKEN_FILE: /run/secrets/telegram_bot_token
    secrets:
      - telegram_bot_token

secrets:
  telegram_bot_token:
    file: ./secrets/telegram_bot_token.txt
```

### Enable HTTPS

Use a reverse proxy (Nginx, Traefik, Caddy):

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
```

```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name antenna.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://antenna:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Health Monitoring

```bash
# Add Healthchecks.io or similar
# In antenna.config.yaml or via cron:
*/5 * * * * curl https://hc-ping.com/your-uuid
```

### Automated Backups

```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh

# backup-script.sh
#!/bin/bash
cd /opt/antenna
docker-compose exec -T antenna sqlite3 /app/data/antenna.db ".backup '/tmp/backup.db'"
docker cp antenna-server:/tmp/backup.db /backups/antenna-$(date +\%Y\%m\%d).db
find /backups -name "antenna-*.db" -mtime +30 -delete
```

## Updating

```bash
# Pull latest code
git pull

# Rebuild containers
docker-compose build

# Restart with new images
docker-compose up -d

# Check logs
docker-compose logs -f antenna
```

## Uninstall

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (⚠️ WARNING: deletes all data)
docker-compose down -v

# Remove images
docker rmi antenna_antenna antenna_rabbitmq-init
docker rmi rabbitmq:3.12-management-alpine

# Remove configuration
rm -rf data/ logs/ rabbitmq_data/
```

## Resources

- **Docker Docs**: https://docs.docker.com/
- **Docker Compose Docs**: https://docs.docker.com/compose/
- **RabbitMQ Docker**: https://hub.docker.com/_/rabbitmq
- **Antenna Docs**: [README.md](README.md), [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md)

## Support

For Docker-specific issues, check:
1. `docker-compose logs`
2. `docker-compose ps`
3. Container health status
4. Network connectivity between containers

For Antenna issues, see [DEKUSMS_INTEGRATION.md](DEKUSMS_INTEGRATION.md#troubleshooting).
