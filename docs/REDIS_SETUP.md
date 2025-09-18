# External Redis Setup for Render Deployment

Since Render's free tier doesn't include Redis, you'll need an external Redis service. Here are the best free options:

## Option 1: Upstash Redis (Recommended)

### Why Upstash?
✅ **10k commands/day free**  
✅ **Serverless-compatible**  
✅ **Global edge locations**  
✅ **Perfect for development**  
✅ **Easy setup**  

### Setup Steps:

1. **Create Account**
   - Go to [upstash.com](https://upstash.com)
   - Sign up with GitHub/Google

2. **Create Redis Database**
   - Click "Create Database"
   - Choose a region (closest to your users)
   - Select "Free" plan
   - Name: `prosocial-matchmaking`

3. **Get Connection String**
   - Click on your database
   - Copy the `REDIS_URL` from "Node.js" tab
   - Format: `redis://default:password@host:port`

4. **Add to Render**
   - In Render dashboard → Your service → Environment
   - Add: `REDIS_URL=redis://default:password@host:port`

### Upstash Limits (Free Tier):
- **Commands**: 10,000/day
- **Data**: 256 MB
- **Connections**: 100 concurrent

## Option 2: RedisLabs (Alternative)

### Setup Steps:

1. **Create Account**
   - Go to [redis.com](https://redis.com)
   - Sign up for free account

2. **Create Database**
   - Click "New Database"
   - Choose "Redis Stack" (free 30MB)
   - Select cloud provider and region

3. **Get Connection Details**
   - Database → Configuration
   - Copy endpoint, port, and password
   - Format: `redis://default:password@endpoint:port`

### RedisLabs Limits (Free Tier):
- **Memory**: 30 MB
- **Connections**: 30 concurrent
- **No persistence** (data may be lost)

## Option 3: Railway Redis (If using Railway)

If you decide to use Railway instead of Render:

1. **Add Redis Service**
   - Railway dashboard → "New Service" → "Database" → "Redis"
   - Automatically provides `REDIS_URL`

2. **Cost**: ~$5/month but includes Redis + hosting

## Testing Your Redis Connection

### 1. Test Locally First

```bash
# Install redis-cli (macOS)
brew install redis

# Test connection
redis-cli -u "your-redis-url-here" ping
# Should return: PONG
```

### 2. Test from Node.js

```javascript
// test-redis.js
import { createClient } from 'redis';

const client = createClient({
  url: 'your-redis-url-here'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
await client.set('test-key', 'Hello from Redis!');
const value = await client.get('test-key');
console.log('Retrieved:', value);

await client.disconnect();
```

## Environment Variable Format

Make sure your `REDIS_URL` follows this format:

```bash
# Upstash format
REDIS_URL=redis://default:abc123password@your-host.upstash.io:12345

# RedisLabs format  
REDIS_URL=redis://default:password@redis-12345.c1.region.cloud.redislabs.com:12345

# Local development (fallback)
REDIS_URL=redis://localhost:6379
```

## Monitoring Redis Usage

### Upstash Dashboard
- **Commands used**: Real-time counter
- **Memory usage**: Current data size
- **Connection stats**: Active connections

### RedisLabs Dashboard
- **Memory usage**: MB used
- **Operations**: Commands per second
- **Connections**: Current active connections

## Troubleshooting

### Connection Issues:

1. **URL Format**: Ensure proper `redis://` prefix
2. **Firewall**: Check if your IP is whitelisted
3. **SSL**: Some providers require `rediss://` (with SSL)
4. **Password**: Ensure special characters are URL-encoded

### Common Errors:

```bash
# Connection timeout
Error: Redis connection timeout
Solution: Check REDIS_URL format and network

# Authentication failed
Error: WRONGPASS invalid username-password pair
Solution: Verify password in REDIS_URL

# Too many connections
Error: ERR max number of clients reached
Solution: Implement connection pooling or upgrade plan
```

### Debug Connection:

```javascript
// Add to your app for debugging
console.log('Redis URL:', process.env.REDIS_URL?.replace(/:([^:@]{8})[^:@]*@/, ':$1***@'));
```

## Best Practices

### 1. Connection Pooling
Your app already uses Redis connection pooling via the RedisService.

### 2. Error Handling
```javascript
// Graceful degradation if Redis is unavailable
if (!RedisService.isConnected) {
  console.warn('Redis unavailable, using memory fallback');
  // Implement memory-based fallback
}
```

### 3. Data Expiration
Set TTL on temporary data:
```javascript
await RedisService.setex('temp-key', 3600, value); // 1 hour expiry
```

### 4. Monitor Usage
- **Watch command count** (especially on Upstash)
- **Monitor memory usage**
- **Set up alerts** for quota limits

## Cost Comparison

| Provider | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| **Upstash** | 10k commands/day | $0.20/100k commands | Development |
| **RedisLabs** | 30MB | $5/month+ | Small apps |
| **Railway** | None | $5/month (with hosting) | Full stack |

## Recommendation

**For Development**: Use **Upstash** - generous free tier, easy setup  
**For Production**: Consider **Railway** with built-in Redis for simplicity  

Your Redis setup is ready! 🎯