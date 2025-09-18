# Render Deployment Quick Checklist

## 🆓 Free Tier Benefits
- **750 hours/month** - Perfect for development
- **Full WebSocket support** - Real-time matchmaking works
- **Automatic HTTPS** - SSL certificates included
- **$0 cost** - Ideal for testing and development

## Pre-Deployment Setup

### 1. Accounts & Services
- [ ] Create Render account at [render.com](https://render.com)
- [ ] Set up external Redis (Upstash recommended)
- [ ] Have Supabase credentials ready
- [ ] Push code to GitHub repository

### 2. External Redis Setup (Required)
- [ ] **Upstash**: Create free Redis at [upstash.com](https://upstash.com)
- [ ] Copy `REDIS_URL` from Upstash dashboard
- [ ] Test Redis connection locally (optional)

## Deployment Steps

### Option 1: GitHub Integration (Recommended)
1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to Render"
   git push origin main
   ```

2. **Create Render Service**
   - [ ] Go to [dashboard.render.com](https://dashboard.render.com)
   - [ ] Click "New +" → "Web Service"
   - [ ] Connect GitHub repository
   - [ ] Service name: `prosocial-matchmaking-backend`
   - [ ] Build command: `npm install`
   - [ ] Start command: `npm start`
   - [ ] Plan: **Free**

### Option 2: Quick Script
```bash
cd prosocial_backend
./deploy-render.sh
```

## Environment Variables (Required)

In Render dashboard → Your service → Environment:

### Core Configuration
- [ ] `NODE_ENV=production`
- [ ] `REDIS_URL=redis://default:password@host:port` (from Upstash)
- [ ] `BACKEND_BASE_URL=https://your-app.onrender.com`
- [ ] `CORS_ORIGINS=https://your-frontend.vercel.app`

### Supabase
- [ ] `SUPABASE_URL=your_supabase_project_url`
- [ ] `SUPABASE_ANON_KEY=your_supabase_anon_key`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key`

### Optional (with defaults)
- [ ] `HUMAN_SEARCH_TIMEOUT_MS=45000`
- [ ] `AI_FALLBACK_ENABLED=true`
- [ ] `LOG_LEVEL=info`

## Testing Deployment

### API Endpoints
- [ ] Health: `https://your-app.onrender.com/health`
- [ ] Stats: `https://your-app.onrender.com/api/matchmaking/stats`
- [ ] Admin: `https://your-app.onrender.com/api/admin/dashboard`

### WebSocket Test
```javascript
// Test in browser console
const socket = io('https://your-app.onrender.com');
socket.on('connect', () => console.log('✅ WebSocket connected!'));
```

## Frontend Update

- [ ] Update frontend `VITE_BACKEND_URL=https://your-app.onrender.com`
- [ ] Test end-to-end matchmaking functionality
- [ ] Verify real-time features work

## ⚠️ Free Tier Considerations

### Sleep Mode Management
- **Sleeps after**: 15 minutes of inactivity
- **Wake time**: ~30 seconds
- **Solution**: Use UptimeRobot for development

### Optional: Keep-Alive Setup
1. **UptimeRobot** (Recommended)
   - Create account at [uptimerobot.com](https://uptimerobot.com)
   - Add HTTP monitor for your health endpoint
   - Ping every 5 minutes

2. **Frontend Ping** (Alternative)
   ```javascript
   // Add to your frontend (optional)
   setInterval(() => {
     fetch('https://your-app.onrender.com/health').catch(() => {});
   }, 14 * 60 * 1000); // Every 14 minutes
   ```

## Troubleshooting

### Common Issues
- [ ] **Service sleeping**: Set up UptimeRobot or upgrade to $7/month
- [ ] **Redis connection**: Verify `REDIS_URL` format
- [ ] **CORS errors**: Check `CORS_ORIGINS` includes your frontend
- [ ] **Build failures**: Check build logs in Render dashboard

### Useful Commands
```bash
# View service logs
# (Available in Render dashboard)

# Test Redis connection locally
redis-cli -u "your-redis-url" ping

# Check environment variables
# (Available in Render dashboard → Environment)
```

## Production Upgrade ($7/month)

When ready for production:
- [ ] Upgrade to Starter plan in Render dashboard
- [ ] Benefits: Always-on, no sleep mode, better performance
- [ ] Custom domains available

## Alternative: Self-Hosted Redis

If you prefer not to use external Redis:
- **Railway**: $5/month includes hosting + Redis
- **DigitalOcean**: $4/month droplet + managed Redis
- **AWS/GCP**: Free tier options available

## Files Created for Deployment

✅ **`render.yaml`** - Service configuration  
✅ **`Dockerfile`** - Optimized container  
✅ **`.dockerignore`** - Exclude unnecessary files  
✅ **`RENDER_DEPLOYMENT.md`** - Detailed guide  
✅ **`REDIS_SETUP.md`** - External Redis setup  
✅ **`deploy-render.sh`** - Deployment helper  

## Success Checklist

- [ ] Backend deployed to Render
- [ ] External Redis (Upstash) configured
- [ ] All environment variables set
- [ ] Health endpoint responding
- [ ] WebSocket connections working
- [ ] Frontend updated with Render URL
- [ ] End-to-end testing completed

## Need Help?

- 📖 **Detailed guide**: `RENDER_DEPLOYMENT.md`
- 🗄️ **Redis setup**: `REDIS_SETUP.md`
- 🔗 **Render docs**: [render.com/docs](https://render.com/docs)
- 📊 **Service logs**: Available in Render dashboard

Render's free tier is perfect for development! 🎨✨