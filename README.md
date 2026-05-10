# Nina Bot — Setup & AWS Deployment Guide

## Files
```
nina_bot.js           ← Main bot code
package.json          ← Dependencies
ecosystem.config.cjs  ← PM2 config (AWS)
.env.example          ← Environment variables template
.gitignore
```

---

## Step 1 — Local Testing (VS Code / Laptop)

### Prerequisites
- Node.js 20+ installed → https://nodejs.org
- A WhatsApp account to scan QR

### Run locally

```bash
# 1. Install dependencies
npm install

# 2. Create data folder
mkdir data

# 3. Start the bot
node nina_bot.js
```

- A QR code will appear in the terminal
- Scan it with WhatsApp (Linked Devices → Link a Device)
- Bot is ready when you see: `✅ Nina Bot connected!`

### Test commands in your WhatsApp group
Make sure the bot is admin, then try:
- `.nina` — shows bot info + current settings
- `.antilinkon` / `.antilinkoff` — toggle link blocking
- `.antistickeron` / `.antistickeroff` — toggle sticker blocking
- `.tagall` — mention everyone
- `.close` / `.open` — lock/unlock group
- `.kick @user` — remove a member
- `.add 923001234567` — add a member
- `.lockchaton @user` / `.lockchatoff @user` — mute/unmute
- `.lockedlist` — see muted users
- `.unlockall` — unmute everyone

---

## Step 2 — AWS EC2 Deployment

### 2a. Launch EC2 Instance
1. Go to AWS Console → EC2 → Launch Instance
2. Choose: **Ubuntu 22.04 LTS** (free tier eligible)
3. Instance type: **t2.micro** (free tier) or t3.small for better performance
4. Create a key pair → download `.pem` file
5. Security Group: allow **SSH (port 22)** from your IP only

### 2b. Connect to EC2

```bash
# Replace with your key and EC2 public IP
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### 2c. Install Node.js on EC2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # Should show v20.x
```

### 2d. Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

### 2e. Upload bot files to EC2

From your **local terminal** (not EC2):

```bash
# Upload entire bot folder
scp -i your-key.pem -r ./nina-bot-aws ubuntu@YOUR_EC2_PUBLIC_IP:~/nina-bot
```

### 2f. Start the bot on EC2

```bash
# On EC2:
cd ~/nina-bot
mkdir -p data logs
npm install
pm2 start ecosystem.config.cjs
```

- QR code will appear in logs
- View logs: `pm2 logs nina-bot`
- Scan the QR with WhatsApp

### 2g. Make bot auto-start on reboot

```bash
pm2 startup
# Copy and run the command it gives you, then:
pm2 save
```

---

## Useful PM2 Commands

```bash
pm2 status           # Check if bot is running
pm2 logs nina-bot    # View live logs
pm2 restart nina-bot # Restart bot
pm2 stop nina-bot    # Stop bot
pm2 delete nina-bot  # Remove from PM2
```

---

## Re-authentication (if QR expires or bot disconnects)

```bash
# On EC2:
pm2 stop nina-bot
rm -rf data/baileys_auth
pm2 start ecosystem.config.cjs
pm2 logs nina-bot     # Scan the QR shown here
```

---

## Data Files (auto-created)
- `data/baileys_auth/` — WhatsApp session (keep this safe!)
- `data/locked_users.json` — Muted users (persists across restarts)
- `data/group_settings.json` — Per-group antilink/antisticker settings

---

## Notes
- Bot only works in **groups** where it is an **admin**
- Anti-link and anti-sticker are **on by default** for all groups
- Good Night (10 PM PKT) closes group + sends daily stats
- Good Morning (8 AM PKT) opens group + sends motivational message
- Developer user (LID) is always protected from removal
