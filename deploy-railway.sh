#!/bin/bash

echo "🚂 Deploying Prosocial Backend to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "🔧 Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway status &> /dev/null; then
    echo "🔐 Please login to Railway:"
    railway login
fi

echo "📦 Preparing deployment..."

# Check if this is already a Railway project
if [ ! -f "railway.json" ]; then
    echo "❌ railway.json not found. Please run this from your backend directory."
    exit 1
fi

echo "🔍 Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Committing changes..."
    git add .
    git commit -m "Deploy to Railway - $(date)"
fi

echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Next steps:"
echo "1. 🎯 Add Redis database service in Railway dashboard"
echo "2. ⚙️  Configure environment variables (see RAILWAY_DEPLOYMENT.md)"
echo "3. 🌐 Update frontend VITE_BACKEND_URL to your Railway domain"
echo "4. 🧪 Test your endpoints and WebSocket connections"
echo ""
echo "📖 See RAILWAY_DEPLOYMENT.md for detailed instructions"
echo "🔗 Visit https://railway.app/dashboard to manage your deployment"