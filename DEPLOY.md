# FarmTrack Deployment Guide

Deploy the Express + PostgreSQL backend to a personal Ubuntu/Debian server and build an installable Android APK via EAS Build.

---

## Overview

| Part | What | Where |
|------|------|--------|
| 1 | Server setup + backend deploy | Your Ubuntu/Debian server (SSH) |
| 2 | Expose backend via Cloudflare Tunnel | Your Ubuntu/Debian server (SSH) |
| 3 | Build Android APK | Local machine |

---

## Part 1: Server Setup

### 1.1 Install dependencies

SSH into your server, then run:

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# PM2 (process manager — keeps the server alive across reboots)
sudo npm install -g pm2

# Git
sudo apt install -y git
```

### 1.2 Create the database

```bash
sudo -u postgres psql <<EOF
CREATE USER farmtrack WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE farm_db OWNER farmtrack;
GRANT ALL PRIVILEGES ON DATABASE farm_db TO farmtrack;
EOF
```

> Replace `choose_a_strong_password` with a real password and note it — you'll need it in the `.env` file.

### 1.3 Deploy the backend code

Run this from your **local machine**:

```bash
rsync -avz /home/xorb/Project/Node_Proj/backend/ user@YOUR_SERVER_IP:/opt/farmtrack/backend/
```

Replace `user` and `YOUR_SERVER_IP` with your actual server SSH user and IP.

Then on the **server**:

```bash
cd /opt/farmtrack/backend
npm install
```

### 1.4 Create the production `.env`

On the server, create `/opt/farmtrack/backend/.env`:

```
PORT=3000
DATABASE_URL="postgresql://farmtrack:choose_a_strong_password@localhost:5432/farm_db?schema=public"
JWT_SECRET="your_generated_secret_here"
NODE_ENV=production
```

Generate a secure `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as the value of `JWT_SECRET`.

### 1.5 Run migrations and start the server

```bash
cd /opt/farmtrack/backend

# Apply all Prisma migrations to the production database
npx prisma migrate deploy

# Start the server with PM2
pm2 start server.js --name farmtrack-api

# Configure PM2 to auto-start on reboot
pm2 startup        # run the printed command (it looks like: sudo env PATH=... pm2 startup ...)
pm2 save
```

### 1.6 Open the firewall

```bash
sudo ufw allow 3000
sudo ufw enable
```

### 1.7 Verify the backend is running

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

---

## Part 2: Expose the Backend via Cloudflare Tunnel

Cloudflare Tunnel creates a secure outbound connection from your server to Cloudflare's network, giving you a stable public HTTPS URL — no port forwarding or static IP required.

### Option A — Quick tunnel (temporary URL, no account needed)

Good for initial testing.

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Start a quick tunnel
cloudflared tunnel --url http://localhost:3000
```

This prints a URL like `https://xxxx-xxxx.trycloudflare.com`. Use this as your `EXPO_PUBLIC_API_URL` for testing.

**Note:** This URL changes every time you restart the tunnel. Use Option B for a permanent setup.

### Option B — Named tunnel with a custom domain (permanent, recommended)

Requires a free Cloudflare account and a domain added to Cloudflare DNS.

```bash
# Install cloudflared (if not already done)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate with your Cloudflare account (opens browser)
cloudflared login

# Create a named tunnel
cloudflared tunnel create farmtrack

# Route your subdomain to the tunnel
cloudflared tunnel route dns farmtrack api.yourdomain.com
```

Create the config file at `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

> Replace `<TUNNEL_ID>` with the ID printed by `cloudflared tunnel create farmtrack`.

Install and start the tunnel as a system service:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Verify:

```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}
```

---

## Part 3: Build the Android APK

### 3.1 Update the API URL in eas.json

In `frontend/eas.json`, replace the placeholder URL with your actual tunnel URL:

```json
"preview": {
  "distribution": "internal",
  "env": {
    "EXPO_PUBLIC_API_URL": "https://api.yourdomain.com"
  }
}
```

### 3.2 Build

```bash
cd frontend

# Log in to your Expo account (only needed once)
eas login

# Trigger the APK build on EAS servers
eas build --platform android --profile preview
```

The build runs on EAS cloud servers (5–15 minutes). When it finishes, EAS prints a direct download link for the `.apk` file.

Install the APK on any Android device by opening the link on the device or sideloading it via ADB.

---

## Verification Checklist

- [ ] `curl http://YOUR_SERVER_IP:3000/health` returns `{"status":"ok"}`
- [ ] `curl https://api.yourdomain.com/health` returns `{"status":"ok"}` (after tunnel is up)
- [ ] Auth works: `curl -X POST https://api.yourdomain.com/auth/login -H "Content-Type: application/json" -d '{"phone":"+255700000001","password":"password123"}'` returns a JWT token
- [ ] EAS build completes without errors
- [ ] APK installs on Android device and logs in successfully

---

## PM2 Cheat Sheet

| Command | Description |
|---------|-------------|
| `pm2 list` | Show all running processes |
| `pm2 logs farmtrack-api` | Tail live logs |
| `pm2 restart farmtrack-api` | Restart the server |
| `pm2 stop farmtrack-api` | Stop the server |
| `pm2 delete farmtrack-api` | Remove from PM2 |

---

## Redeploying After Code Changes

```bash
# From local machine — sync updated backend code
rsync -avz /home/xorb/Project/Node_Proj/backend/ user@YOUR_SERVER_IP:/opt/farmtrack/backend/

# On the server
cd /opt/farmtrack/backend
npm install                    # only needed if package.json changed
npx prisma migrate deploy      # only needed if schema changed
pm2 restart farmtrack-api
```
