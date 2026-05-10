#!/bin/bash
# AWS Deployment Script for Nina Bot
# Run this script on your AWS EC2 instance

echo "🚀 Starting Nina Bot AWS Deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create necessary directories
mkdir -p data logs

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start the bot with PM2
echo "🤖 Starting bot with PM2..."
pm2 start ecosystem.config.cjs

# Setup auto-restart on reboot
echo "⚙️ Setting up auto-restart..."
pm2 startup
pm2 save

# Display status
echo "✅ Deployment Complete!"
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📋 Next Steps:"
echo "1. Check logs: pm2 logs nina-bot"
echo "2. Scan the QR code that appears in the logs"
echo "3. Add the bot as admin to your WhatsApp groups"
echo "4. Bot will auto-restart on system reboot"
echo ""
echo "🔧 Useful Commands:"
echo "  pm2 status           # Check bot status"
echo "  pm2 logs nina-bot    # View live logs"
echo "  pm2 restart nina-bot # Restart bot"
echo "  pm2 stop nina-bot    # Stop bot"