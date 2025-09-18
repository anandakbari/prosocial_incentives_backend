# Railway Deployment Quick Checklist

## Pre-Deployment

- [ ] Create Railway account at [railway.app](https://railway.app)
- [ ] Install Railway CLI: `npm i -g @railway/cli` (optional)
- [ ] Push code to GitHub repository
- [ ] Have Supabase credentials ready

## Deploy Options

### Option 1: GitHub Integration (Recommended)
- [ ] Connect Railway to your GitHub repo
- [ ] Auto-deploy on pushes

### Option 2: CLI Deployment
```bash
cd prosocial_backend
./deploy-railway.sh
```

## Post-Deployment Setup

### 1. Add Redis Database
- [ ] In Railway dashboard → "New Service" → "Database" → "Redis"
- [ ] `REDIS_URL` automatically provided

### 2. Environment Variables (Required)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS=https://your-frontend.vercel.app`

### 3. Optional Environment Variables
- [ ] `HUMAN_SEARCH_TIMEOUT_MS=45000`
- [ ] `AI_FALLBACK_ENABLED=true`
- [ ] `LOG_LEVEL=info`

## Testing

- [ ] Health check: `https://your-app.railway.app/health`
- [ ] API test: `https://your-app.railway.app/api/matchmaking/stats`
- [ ] WebSocket test: Connect from frontend

## Frontend Update

- [ ] Update `VITE_BACKEND_URL=https://your-app.railway.app`
- [ ] Test end-to-end functionality

## Why Railway is Perfect for Your Backend

✅ **Full WebSocket Support** - Real-time matchmaking works perfectly  
✅ **No Cold Starts** - Persistent connections for better performance  
✅ **Built-in Redis** - One-click database addition  
✅ **Simple Pricing** - $5/month hobby plan  
✅ **Automatic HTTPS** - SSL certificates included  

## Need Help?

- 📖 Detailed guide: `RAILWAY_DEPLOYMENT.md`
- 🔗 Railway docs: [docs.railway.app](https://docs.railway.app)
- 📊 View logs: `railway logs`
- ⚙️ Manage variables: `railway variables`

## Quick Commands

```bash
# View service status
railway status

# View logs
railway logs

# Set environment variable
railway variables set VAR_NAME=value

# Deploy
railway up
```