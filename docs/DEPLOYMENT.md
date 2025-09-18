# Deployment Guide - Prosocial Matchmaking Backend

This guide covers deployment options for the real-time matchmaking backend.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Production Configuration](#production-configuration)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Scaling Considerations](#scaling-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- **Node.js** 18+ 
- **Redis** 6+ for queuing and caching
- **PostgreSQL** (via Supabase) for persistent data
- **Load Balancer** (for production)
- **Process Manager** (PM2, Docker, or systemd)

### Recommended Resources

**Development:**
- 2 CPU cores
- 4GB RAM
- 20GB storage

**Production:**
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB storage
- Redis with persistence enabled

## Environment Setup

### 1. Basic Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Required Environment Variables

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Redis Configuration
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Performance Tuning
HUMAN_SEARCH_TIMEOUT_MS=45000
MAX_QUEUE_SIZE=10000
SKILL_MATCHING_THRESHOLD=1.5
```

### 3. Security Configuration

```env
# Additional security settings for production
LOG_LEVEL=info
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=60000
```

## Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f matchmaking-backend

# Scale the service
docker-compose up -d --scale matchmaking-backend=3
```

### Option 2: Manual Docker

```bash
# Build image
docker build -t prosocial-matchmaking .

# Run Redis
docker run -d --name redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# Run matchmaking backend
docker run -d --name matchmaking \
  -p 3001:3001 \
  --link redis:redis \
  -e REDIS_URL=redis://redis:6379 \
  -e NODE_ENV=production \
  --env-file .env \
  prosocial-matchmaking
```

### Production Docker Compose

```yaml
version: '3.8'
services:
  matchmaking-backend:
    image: prosocial-matchmaking:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - matchmaking-backend
    restart: unless-stopped

volumes:
  redis_data:
```

## Manual Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt install redis-server

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Application Deployment

```bash
# Clone or upload your code
git clone your-repo-url /opt/prosocial-matchmaking
cd /opt/prosocial-matchmaking

# Install dependencies
npm ci --only=production

# Setup environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'prosocial-matchmaking',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048'
  }]
};
```

## Production Configuration

### 1. Redis Configuration

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Recommended settings
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

### 2. Nginx Load Balancer

Create `/etc/nginx/sites-available/matchmaking`:

```nginx
upstream matchmaking_backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # API endpoints
    location /api/ {
        proxy_pass http://matchmaking_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket endpoints
    location /socket.io/ {
        proxy_pass http://matchmaking_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # Health check
    location /health {
        proxy_pass http://matchmaking_backend;
        access_log off;
    }
}
```

### 3. Firewall Configuration

```bash
# UFW configuration
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw allow 3001    # App (if direct access needed)
sudo ufw enable
```

### 4. System Limits

Add to `/etc/security/limits.conf`:

```
* soft nofile 65536
* hard nofile 65536
```

## Monitoring & Health Checks

### 1. Health Check Endpoints

```bash
# Basic health
curl http://localhost:3001/health

# Detailed system health
curl http://localhost:3001/api/matchmaking/health

# Admin dashboard (if enabled)
curl http://localhost:3001/api/admin/dashboard
```

### 2. PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs prosocial-matchmaking --lines 100

# Restart if needed
pm2 restart prosocial-matchmaking

# Reload with zero downtime
pm2 reload prosocial-matchmaking
```

### 3. Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli

# Check memory usage
INFO memory

# Monitor commands
MONITOR

# Check queue sizes
ZCARD queue:round:1
```

### 4. Log Management

Setup log rotation with `logrotate`:

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/prosocial-matchmaking

# Add configuration
/opt/prosocial-matchmaking/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    postrotate
        pm2 reload prosocial-matchmaking
    endscript
}
```

## Scaling Considerations

### 1. Horizontal Scaling

**Load Balancer Setup:**
- Use Nginx or HAProxy
- Configure session affinity for WebSocket connections
- Health check endpoints

**Redis Clustering:**
- Setup Redis Cluster for high availability
- Configure Redis Sentinel for failover
- Use Redis sharding for large datasets

**Database Optimization:**
- Supabase connection pooling
- Read replicas for analytics queries
- Proper indexing for tournament queries

### 2. Performance Tuning

**Node.js Optimization:**
```bash
# Increase memory limit
node --max-old-space-size=4096 src/server.js

# Enable cluster mode
PM2_INSTANCES=max pm2 start ecosystem.config.js
```

**Redis Optimization:**
```
# Memory management
maxmemory 4gb
maxmemory-policy allkeys-lru

# Performance
tcp-keepalive 60
timeout 300
```

### 3. Monitoring Metrics

Key metrics to monitor:
- Response time (< 100ms for matchmaking)
- WebSocket connections count
- Queue sizes and wait times
- Memory usage (Node.js and Redis)
- CPU utilization
- Error rates

## Troubleshooting

### Common Issues

**1. High Memory Usage**
```bash
# Check Node.js memory
pm2 show prosocial-matchmaking

# Check Redis memory
redis-cli info memory

# Solution: Increase cleanup frequency
# Set shorter TTL values in Redis
```

**2. WebSocket Connection Issues**
```bash
# Check nginx configuration
sudo nginx -t

# Verify WebSocket proxy settings
# Ensure proper headers are set
```

**3. Redis Connection Failures**
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# Check network connectivity
telnet redis-host 6379
```

**4. High CPU Usage**
```bash
# Check PM2 processes
pm2 list

# Monitor CPU per process
htop

# Solution: Scale horizontally or optimize code
```

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Emergency Procedures

**1. Service Recovery**
```bash
# Restart all services
pm2 restart all

# Restart Redis
sudo systemctl restart redis

# Check system resources
df -h
free -h
```

**2. Database Recovery**
```bash
# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/

# Verify environment variables
env | grep SUPABASE
```

**3. Load Balancer Issues**
```bash
# Check nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx
```

## Security Checklist

- [ ] Environment variables secured
- [ ] Redis password authentication enabled
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules applied
- [ ] Regular security updates scheduled
- [ ] Log monitoring configured
- [ ] Backup procedures implemented
- [ ] Access controls configured
- [ ] Rate limiting enabled
- [ ] Input validation active

## Backup & Recovery

### Database Backup
- Supabase automatic backups (check your plan)
- Custom backup scripts for specific data

### Redis Backup
```bash
# Manual backup
redis-cli BGSAVE

# Automatic backup with cron
# Add to crontab: 0 2 * * * redis-cli BGSAVE
```

### Application Backup
```bash
# Code backup
git push origin production

# Configuration backup
tar -czf config-backup.tar.gz .env ecosystem.config.js
```

This deployment guide provides comprehensive instructions for production deployment of the Prosocial Matchmaking Backend. Follow the appropriate section based on your deployment preference and infrastructure requirements.