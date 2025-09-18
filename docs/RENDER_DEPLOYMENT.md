# Deploying Prosocial Backend to Render

This guide will help you deploy your prosocial matchmaking backend to Render with their generous free tier.

## Why Render?

✅ **FREE TIER** - 750 hours/month free (enough for development)  
✅ **Full WebSocket Support** - Perfect for real-time matchmaking  
✅ **Persistent Connections** - No serverless limitations  
✅ **Easy Deployment** - Git-based deployments  
✅ **Automatic HTTPS** - SSL certificates included  
✅ **Great for Node.js** - Optimized for backend applications  

## Render Free Tier Limitations

⚠️ **Sleep Mode**: Free services sleep after 15 minutes of inactivity  
⚠️ **750 Hours/Month**: About 31 days of uptime per month  
⚠️ **No Persistent Disk**: Use external databases  
⚠️ **Slower Spin-up**: ~30 seconds to wake from sleep  

**Perfect for**: Development, testing, demos  
**Upgrade to**: $7/month for always-on service  

## Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended for easy deployment)

## Step 2: Set Up External Redis

Since Render free tier doesn't include Redis, you'll need an external Redis service:

### Option A: Upstash Redis (Recommended - Free Tier)
1. Go to [upstash.com](https://upstash.com)
2. Create account and new Redis database
3. Copy the `REDIS_URL` from the dashboard

### Option B: RedisLabs (Alternative)
1. Go to [redis.com](https://redis.com)
2. Create free account (30MB free)
3. Create database and get connection URL

## Step 3: Deploy to Render

### Option A: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**
2. **Go to Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)
3. **Click "New +"** → "Web Service"
4. **Connect GitHub repository**
5. **Configure service**:
   - **Name**: `prosocial-matchmaking-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### Option B: Manual Deployment

1. **Connect via GitHub**: Render will auto-deploy on pushes
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`

## Step 4: Configure Environment Variables

In your Render service dashboard, go to "Environment" tab and add:

### Required Environment Variables:

```bash
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis Configuration (from Upstash or RedisLabs)
REDIS_URL=redis://username:password@host:port

# Server Configuration
NODE_ENV=production
BACKEND_BASE_URL=https://your-app.onrender.com

# CORS Configuration (Update with your frontend domain)
CORS_ORIGINS=https://your-frontend.vercel.app,https://localhost:3000
```

### Optional Environment Variables:

```bash
# Matchmaking Configuration
HUMAN_SEARCH_TIMEOUT_MS=45000
AI_FALLBACK_ENABLED=true
MAX_QUEUE_SIZE=1000
SKILL_MATCHING_THRESHOLD=1.5

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=60000

# Logging
LOG_LEVEL=info
```

## Step 5: Deploy

Render automatically deploys when you push to your connected Git branch:

```bash
git add .
git commit -m "Deploy to Render"
git push origin main
```

## Step 6: Update Frontend Configuration

Update your frontend to use the Render URL:

```bash
# In your frontend .env file
VITE_BACKEND_URL=https://your-app.onrender.com
```

## Step 7: Custom Domain (Optional - Paid Plans Only)

Custom domains are available on paid plans ($7/month and up).

## Testing Your Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.onrender.com/health

# Matchmaking API
curl https://your-app.onrender.com/api/matchmaking/stats

# WebSocket connection (from browser console)
const socket = io('https://your-app.onrender.com');
socket.on('connect', () => console.log('Connected!'));
```

## Managing Sleep Mode (Free Tier)

### Keep Service Awake
If you need to prevent sleeping during development:

1. **UptimeRobot**: Free monitoring service that pings your app
2. **Cron Jobs**: Set up periodic health checks
3. **Frontend Ping**: Have your frontend ping the backend

### Example: Simple Keep-Alive Script
```javascript
// Add to your frontend (optional)
setInterval(() => {
  fetch('https://your-app.onrender.com/health')
    .catch(() => {}); // Ignore errors
}, 14 * 60 * 1000); // Ping every 14 minutes
```

## Render Features & Benefits

### ✅ Free Tier Advantages
- **750 hours/month free** - More than enough for development
- **Full WebSocket support** - Real-time features work perfectly
- **Automatic HTTPS** - SSL certificates included
- **Git-based deployment** - Auto-deploy on push

### ✅ Production Ready
- **$7/month**: Always-on service, no sleep mode
- **Horizontal scaling**: Multiple instances
- **Custom domains**: Your own domain name
- **Database add-ons**: Managed PostgreSQL/Redis

## Comparison: Free Tiers

| Platform | Free Hours | WebSockets | Redis | Sleep Mode |
|----------|------------|------------|-------|------------|
| **Render** | 750h/month | ✅ Full | ❌ External | ⚠️ 15min |
| **Railway** | ❌ No free | ✅ Full | ✅ Built-in | ❌ None |
| **Heroku** | 550h/month | ✅ Full | ❌ External | ⚠️ 30min |
| **Vercel** | ∞ Serverless | ❌ Limited | ❌ External | ❌ Instant |

## Troubleshooting

### Common Issues:

1. **Service Sleeping**: Use UptimeRobot or upgrade to paid plan
2. **Redis Connection**: Make sure `REDIS_URL` is correctly formatted
3. **Port Configuration**: Render automatically sets `PORT` env var
4. **CORS Issues**: Update `CORS_ORIGINS` with your frontend domain
5. **Build Failures**: Check build logs in Render dashboard

### View Logs:
- **Build Logs**: Available during deployment
- **Service Logs**: Real-time logs in dashboard
- **Download Logs**: Export logs for debugging

### Performance Tips:
- **Optimize Docker**: Use `.dockerignore` to reduce build time
- **Memory Usage**: Monitor memory in dashboard
- **Database Connections**: Use connection pooling

## Scaling & Pricing

### Free Plan
- **Cost**: $0
- **Limitations**: 750 hours, sleep mode, shared resources
- **Perfect for**: Development, testing, demos

### Starter Plan ($7/month)
- **Always-on service** - No sleep mode
- **Custom domains**
- **Better performance**
- **Perfect for**: Production apps

### Pro Plan ($25/month)
- **Horizontal scaling**
- **Priority support**
- **Advanced features**

## External Services Setup

### Upstash Redis (Free)
1. Create account at [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy `REDIS_URL` to Render environment variables

### Supabase (Already configured)
Your existing Supabase setup works perfectly with Render.

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Set up external Redis (Upstash)
3. ✅ Configure environment variables
4. ✅ Update frontend to use Render URL
5. ✅ Test real-time matchmaking
6. ✅ Set up UptimeRobot to prevent sleeping (optional)
7. ⭐ Upgrade to $7/month plan for production

Render's free tier is perfect for development and testing your real-time matchmaking backend! 🚀