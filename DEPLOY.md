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
EXPO_PUBLIC_API_URL=https://api.carlhub.uk/api
```

You can place this in `frontend/.env` for local Expo runs, and `frontend/.env.example` now shows the same production default.

Then rebuild the app so the new public URL is bundled into the client.

---

## Part 3: Build and Distribute the Android APK

### 3.1 Configure Automated Versioning
The app is configured to automatically increment version numbers in the cloud. Ensure your `frontend/app.json` has the following baseline:

```json
"ios": { "buildNumber": "1", ... },
"android": { "versionCode": 1, ... }
```

### 3.2 Generate a Production Keystore (Local Machine)
To properly sign the app and remove "Unsigned" security warnings on Android, generate a production key:

```bash
cd frontend
eas credentials
```
1. Select **Android** -> **production**.
2. Follow the prompts to let EAS generate and store a new keystore for you.

### 3.3 Build the Signed APK
Use the `website-release` profile to generate a signed file for your website:

```bash
cd frontend
eas build --platform android --profile website-release
```

### 3.4 Host the APK on your Website
To make the app downloadable from `https://api.carlhub.uk/downloads/farmtrack.apk`:

1. **Upload the file** to `/var/www/farmtrack/downloads/farmtrack.apk`.
2. **Set Permissions:**
   ```bash
   sudo chown -R www-data:www-data /var/www/farmtrack/downloads
   sudo find /var/www/farmtrack/downloads -type d -exec chmod 755 {} \;
   sudo find /var/www/farmtrack/downloads -type f -exec chmod 644 {} \;
   ```
3. **Verify Nginx Config:** Ensure your configuration includes the `/downloads/` block (see Part 5).
4. **Reload Nginx:** `sudo systemctl reload nginx`


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


---

## Part 4: Monitoring and Analytics

### 4.1 Track APK Downloads
Monitor your Nginx access logs to see exactly when someone downloads your APK and from which IP address.

**View live logs:**
```bash
sudo tail -f /var/log/nginx/access.log
```

**Search for APK downloads:**
```bash
sudo grep "farmtrack.apk" /var/log/nginx/access.log
```

**Count total downloads:**
```bash
sudo grep "farmtrack.apk" /var/log/nginx/access.log | wc -l
```

### 4.2 Visual Analytics with GoAccess
For a beautiful, real-time dashboard of your server traffic and file downloads, use **GoAccess**.

**Install GoAccess:**
```bash
sudo apt install -y goaccess
```

**Run GoAccess:**
```bash
sudo goaccess /var/log/nginx/access.log --log-format=COMBINED -c
```

---

## Part 5: Verified Nginx Configuration

Below is the exact Nginx configuration verified for this project. Save this as \`/etc/nginx/sites-available/farmtrack\` (and link to \`sites-enabled\`).

\`\`\`nginx
server {
    listen 80;
    server_name api.carlhub.uk;

    # Allow large file uploads (e.g., images, PDFs)
    client_max_body_size 50M;

    # 1. Serve the separate static website
    location / {
        root /var/www/farmtrack;
        index index.html;
        # Fallback to index.html for SPA client-side routing
        try_files $uri $uri/ /index.html;
    }

    # 2. Dedicated block for APK downloads (with correct MIME types)
    location /downloads/ {
        root /var/www/farmtrack;
        autoindex on;
        types {
            application/vnd.android.package-archive apk;
        }
        default_type application/octet-stream;
        add_header Content-Disposition "attachment";
    }

    # 3. Proxy all /api/ requests to the Express backend on port 3001
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Standard proxy headers
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
\`\`\`
