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

### 1.6 Firewall note

If you are using the recommended Cloudflare Tunnel setup in Part 2, do not open port `3000` publicly.

You can enable the firewall without exposing the backend port:

```bash
sudo ufw enable
```

Only allow `3000` directly if you intentionally want the API reachable outside Cloudflare.

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

Recommended default: expose the backend publicly at `https://api.carlhub.uk`, keep the Node server listening on `localhost:3000`, and rely on the app's existing JWT authentication for API protection.

Why this setup:

- No Android cleartext traffic
- No router port forwarding
- No DuckDNS dependency
- Stable public hostname for the mobile app
- Origin stays private behind Cloudflare

Prerequisites:

- Your domain `carlhub.uk` is active in Cloudflare DNS
- The backend runs on the same machine as `cloudflared`
- The backend responds locally on `http://localhost:3000/health`
- You can run commands with `sudo`

```bash
# Install cloudflared (if not already done)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate with your Cloudflare account (opens browser)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create farmtrack-api

# Route your subdomain to the tunnel
cloudflared tunnel route dns farmtrack-api api.carlhub.uk
```

When prompted in the browser, authorize the `carlhub.uk` zone.

Save the tunnel ID printed by `cloudflared tunnel create farmtrack-api`.

Create the config file at `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.carlhub.uk
    service: http://localhost:3000
  - service: http_status:404
```

> Replace `<TUNNEL_ID>` with the ID printed by `cloudflared tunnel create farmtrack-api`.

If your credentials file is stored elsewhere, update `credentials-file` to match the real path.

Install and start the tunnel as a system service:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

Verify the backend locally first:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

Then verify the public HTTPS endpoint:

```bash
curl https://api.carlhub.uk/health
# Expected: {"status":"ok"}
```

You can also inspect the tunnel:

```bash
cloudflared tunnel list
cloudflared tunnel info farmtrack-api
```

Update the mobile app environment to use the permanent HTTPS API URL:

```env
EXPO_PUBLIC_API_URL=https://api.carlhub.uk
```

You can place this in `frontend/.env` for local Expo runs, and `frontend/.env.example` now shows the same production default.

Then rebuild the app so the new public URL is bundled into the client.

Recommended production posture:

- Keep the backend bound to `localhost` if possible
- Do not expose port `3000` publicly
- Keep `api.carlhub.uk` proxied through Cloudflare
- Rely on existing app authentication for API access
- Add Cloudflare WAF or rate limiting later if needed

Troubleshooting:

- If `https://api.carlhub.uk/health` does not load, check that the backend is running on `localhost:3000`, `cloudflared` is active, and the DNS route exists in Cloudflare
- If the tunnel connects but cannot reach the origin, confirm the `service` value in `/etc/cloudflared/config.yml` is `http://localhost:3000`
- If the mobile app still points to an old host, update `EXPO_PUBLIC_API_URL` and rebuild the app

### Option C - Private access via Twingate + Nginx

Use this if your backend stays on your local network and only approved users/devices should reach it through Twingate.

Recommended topology:

- Backend app via PM2 on `127.0.0.1:3000`
- Nginx on the same host, listening on `443`
- Twingate Connector on the same LAN
- Twingate Resource pointing to the Nginx hostname on `443`

This keeps port `3000` private and gives the mobile app a stable HTTPS base URL.

#### 2C.1 Install Nginx

On the backend server:

```bash
sudo apt update
sudo apt install -y nginx
```

#### 2C.2 Configure Nginx as a reverse proxy

Create `/etc/nginx/sites-available/farmtrack`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/farmtrack /etc/nginx/sites-enabled/farmtrack
sudo nginx -t
sudo systemctl reload nginx
```

Verify locally on the server:

```bash
curl http://localhost/health
# Expected: {"status":"ok"}
```

#### 2C.3 Add HTTPS in Nginx

For Android devices, use HTTPS with a certificate trusted by the device. The easiest setup is a real domain/subdomain such as `api.yourdomain.com`.

Example TLS config:

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

> Avoid self-signed certificates for the mobile app unless you also manage device trust settings.

#### 2C.4 Publish the backend through Twingate

In the Twingate Admin Console:

1. Create or reuse a Connector on the same LAN as the backend server.
2. Add a Resource for `api.yourdomain.com`.
3. Allow access on TCP port `443`.
4. Assign the Resource to the users/groups that should access the app.

Each client device that will use the app must have the Twingate client installed, signed in, and connected.

#### 2C.5 Verify over Twingate

From a Twingate-connected laptop or phone:

```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}
```

If you do not have a real domain and valid certificate, you can use HTTP over Twingate for testing, but Android release builds may require additional cleartext-traffic configuration.

---

## Part 3: Build the Android APK

### 3.1 Update the API URL in eas.json

In `frontend/eas.json`, replace the placeholder URL with your actual backend URL. Examples:

- Cloudflare Tunnel: `https://api.yourdomain.com`
- Twingate + Nginx: `https://api.yourdomain.com`

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

Whenever you update the backend code (e.g., via `rsync` or `git pull`), follow these steps to ensure the database and server are in sync:

```bash
# From local machine — sync updated backend code
rsync -avz /home/xorb/Project/Node_Proj/backend/ xorb@stagin:/opt/farmtrack/backend/

# On the server
cd /opt/farmtrack/backend
npm install                    # only needed if package.json changed

# CRITICAL: Synchronize the database schema
# Use this if you have new migration files:
npx prisma migrate deploy

# OR use this to force the DB to match the schema.prisma immediately (recommended for rapid dev/fixes):
npx prisma db push

# Update the Prisma client code
npx prisma generate

# Restart the service
pm2 restart farmtrack-api
```

---

## Troubleshooting

### "Failed to pull changes" or 500 Errors
If the mobile app shows sync errors, check the server logs:
```bash
pm2 logs farmtrack-api
```

**Common Cause: Database out of sync**
If you see errors like `The column X does not exist` or `Unknown argument Y`, your database structure is older than your code. 

**The "Silver Bullet" Fix:**
Run this combined command on the server to force everything into alignment:
```bash
cd /opt/farmtrack/backend && npx prisma db push && npx prisma generate && pm2 restart farmtrack-api
```

### 404 Route Not Found
All API routes are now grouped under the `/api/` prefix.
- **Backend:** Ensure `server.js` mounts routes using `app.use('/api', apiRouter)`.
- **Frontend:** Ensure `BASE_URL` in `frontend/src/lib/api.js` includes the trailing slash: `.../api/`.
- **Paths:** All service calls should use relative paths (e.g., `auth/login` instead of `/auth/login`) to ensure correct concatenation.

### Package Name Mismatch
The Android package name is standardized as `com.farmtrack.app`. If you change it in `app.json`, you must run:
```bash
npx expo prebuild --clean
```
Note that this will regenerate the `android` folder and may overwrite manual native changes.

