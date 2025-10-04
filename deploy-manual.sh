#!/bin/bash

echo "🚀 Manual Deployment Script for Amazon Image Scraper"
echo "=================================================="

# Check if we're in the right directory
if [ ! -d "paste-and-pixl" ]; then
    echo "❌ Error: paste-and-pixl directory not found"
    echo "Please run this script from the root of your repository"
    exit 1
fi

echo "✅ Found paste-and-pixl directory"

# Navigate to the app directory
cd paste-and-pixl

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building the application..."
npm run build

echo "📁 Checking build output..."
if [ -d "dist" ]; then
    echo "✅ Build successful! dist directory created"
    echo "📊 Contents of dist directory:"
    ls -la dist/
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Go to your GitHub repository settings"
    echo "2. Navigate to Pages section"
    echo "3. Set source to 'GitHub Actions'"
    echo "4. The workflow will automatically deploy from paste-and-pixl/dist"
    
else
    echo "❌ Build failed! No dist directory created"
    exit 1
fi
