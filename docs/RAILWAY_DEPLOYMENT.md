# Deploying Prosocial Backend to Railway

This guide will help you deploy your prosocial matchmaking backend to Railway with full WebSocket support.

## Why Railway?

✅ **Full WebSocket Support** - Perfect for real-time matchmaking  
✅ **Persistent Connections** - No serverless limitations  
✅ **Built-in Redis** - Easy to add Redis database  
✅ **Simple Deployment** - Git-based deployments  
✅ **Great for Node.js** - Optimized for backend applications  

## Prerequisites

1. **Railway Account**: Create an account at [railway.app](https://railway.app)
2. **Railway CLI**: Install the Railway CLI (optional but recommended)
3. **Git Repository**: Your code should be in a Git repository

## Step 1: Install Railway CLI (Optional)

```bash
npm install -g @railway/cli
railway login
```

## Step 2: Create Railway Project

### Option A: Deploy via GitHub (Recommended)

1. Push your code to GitHub
2. Go to [Railway Dashboard](https://railway.app/dashboard)
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will auto-detect your Node.js app

### Option B: Deploy via CLI

```bash
cd prosocial_backend
railway login
railway init
railway up
```

## Step 3: Add Redis Database

1. In your Railway project dashboard
2. Click "New Service"
3. Select "Database" → "Redis"
4. Railway will automatically provide `REDIS_URL`

## Step 4: Configure Environment Variables

In your Railway project dashboard, go to your service → Variables tab:

### Required Environment Variables:

```bash
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
NODE_ENV=production
PORT=3001
BACKEND_BASE_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# CORS Configuration (Update with your frontend domain)
CORS_ORIGINS=https://your-frontend-domain.vercel.app,https://localhost:3000
```

### Automatic Variables (Railway provides these):

- `REDIS_URL` - Automatically set when you add Redis database
- `RAILWAY_PUBLIC_DOMAIN` - Your app's Railway domain

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

Railway automatically deploys when you push to your connected Git branch.

```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

## Step 6: Update Frontend Configuration

Update your frontend to use the Railway URL:

```bash
# In your frontend .env file
VITE_BACKEND_URL=https://your-app.railway.app
```

## Step 7: Custom Domain (Optional)

1. Go to your Railway project
2. Click your service → Settings → Domains
3. Add your custom domain
4. Update DNS records as instructed

## Testing Your Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.railway.app/health

# Matchmaking API
curl https://your-app.railway.app/api/matchmaking/stats

# WebSocket connection (from browser console)
const socket = io('https://your-app.railway.app');
socket.on('connect', () => console.log('Connected!'));
```

## Railway Features & Benefits

### ✅ Full WebSocket Support
- Real-time matchmaking works perfectly
- Persistent connections
- No cold starts for WebSocket connections

### ✅ Built-in Services
- **Redis**: One-click Redis database
- **PostgreSQL**: If you need additional database
- **Environment Variables**: Easy configuration

### ✅ Automatic HTTPS
- SSL certificates automatically provisioned
- Custom domains supported

### ✅ Logs & Monitoring
- Real-time logs in dashboard
- Resource usage monitoring
- Deployment history

## Environment Variable Management

### View all variables:
```bash
railway variables
```

### Set a variable:
```bash
railway variables set VARIABLE_NAME=value
```

### Set from .env file:
```bash
railway variables set --env-file .env
```

## Troubleshooting

### Common Issues:

1. **Port Configuration**: Railway automatically sets `PORT` environment variable
2. **Redis Connection**: Make sure to use Railway's provided `REDIS_URL`
3. **CORS Issues**: Update `CORS_ORIGINS` with your frontend domain
4. **WebSocket Issues**: Should work out of the box (unlike Vercel!)

### View Logs:
```bash
railway logs
```

### Check Service Status:
```bash
railway status
```

## Scaling & Pricing

- **Hobby Plan**: $5/month - Perfect for development
- **Pro Plan**: $20/month - Production ready with more resources
- **Free Tier**: Limited but good for testing

## Comparison with Other Platforms

| Feature | Railway | Vercel | Heroku |
|---------|---------|---------|---------|
| WebSockets | ✅ Full | ❌ Limited | ✅ Full |
| Node.js | ✅ Native | ⚠️ Serverless | ✅ Native |
| Redis | ✅ Built-in | ❌ External | ⚠️ Add-on |
| Pricing | 💰 Affordable | 💰 Expensive | 💰💰 Expensive |
| Deployment | ✅ Simple | ✅ Simple | ⚠️ Complex |

## Next Steps

1. ✅ Deploy your backend to Railway
2. ✅ Add Redis database service
3. ✅ Configure environment variables
4. ✅ Update frontend to use Railway URL
5. ✅ Test real-time matchmaking functionality
6. ✅ Set up custom domain (optional)

Railway is perfect for your real-time matchmaking backend! 🚀