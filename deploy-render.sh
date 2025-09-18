#!/bin/bash

echo "🎨 Deploying Prosocial Backend to Render..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ This is not a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for Render deployment"
fi

echo "📦 Preparing deployment..."

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml not found. Please run this from your backend directory."
    exit 1
fi

echo "🔍 Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Committing changes..."
    git add .
    git commit -m "Deploy to Render - $(date)"
fi

echo "📋 Deployment checklist:"
echo "1. ✅ render.yaml configuration ready"
echo "2. ✅ Dockerfile optimized for Render"
echo "3. ✅ Package.json scripts configured"
echo ""
echo "🔗 Next steps:"
echo "1. Push your code to GitHub:"
echo "   git remote add origin https://github.com/yourusername/your-repo.git"
echo "   git push -u origin main"
echo ""
echo "2. Go to https://dashboard.render.com"
echo "3. Click 'New +' → 'Web Service'"
echo "4. Connect your GitHub repository"
echo "5. Configure environment variables (see RENDER_DEPLOYMENT.md)"
echo ""
echo "📖 Detailed instructions: RENDER_DEPLOYMENT.md"
echo "🗄️  Redis setup guide: REDIS_SETUP.md"
echo ""
echo "⚠️  Don't forget to:"
echo "   - Set up external Redis (Upstash recommended)"
echo "   - Configure all environment variables"
echo "   - Update frontend VITE_BACKEND_URL"
echo ""
echo "🎯 Your app will be available at: https://your-app.onrender.com"