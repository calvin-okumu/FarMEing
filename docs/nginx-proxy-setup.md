# Nginx Reverse Proxy Implementation Plan

## Objective
To decouple the static website asset serving from the Node.js backend by introducing Nginx as a reverse proxy. This setup allows Nginx to handle a separate static website (e.g., a landing page) on port 80/443 and proxy API requests to the Express backend running on an alternate port (3001).

## Scope & Impact
- **Backend:** The Node.js Express server will be reconfigured to listen on port `3001` instead of `3000`.
- **Nginx:** Nginx will be installed and configured as the primary web server listening on port `80` (and eventually `443` for SSL).
- **Separate Website:** Nginx will serve your separate static website files directly from a designated directory (e.g., `/var/www/farmtrack`). 
- **Cloudflare Tunnel:** If using Cloudflare Tunnel, the route will be updated to point to Nginx (port `80`) instead of the Node backend.

## Proposed Solution & Implementation Steps

### Phase 1: Backend Port Reconfiguration
1. **Update Environment Variable:**
   Modify the `.env` file in the backend directory (`/opt/farmtrack/backend/.env` on the server) to set the application port to `3001`.
   ```env
   PORT=3001
   ```
2. **Restart Backend Service:**
   Restart the PM2 process managing the backend to apply the port change.
   ```bash
   pm2 restart farmtrack-api
   ```
   *(Note: The `server.js` already uses `process.env.PORT || 3000`, so changing the `.env` is sufficient.)*

### Phase 2: Nginx Installation and Configuration
1. **Install Nginx:**
   If not already installed on the server, install Nginx.
   ```bash
   sudo apt update
   sudo apt install -y nginx
   ```
2. **Prepare Website Directory:**
   Create the directory for the static website assets and ensure correct ownership.
   ```bash
   sudo mkdir -p /var/www/farmtrack
   sudo chown -R $USER:$USER /var/www/farmtrack
   ```
   *Action:* Upload your separate static website files (e.g., an `index.html` landing page, CSS, images) into `/var/www/farmtrack` on the server.

3. **Configure Nginx Virtual Host:**
   Create an Nginx configuration file (e.g., `/etc/nginx/sites-available/farmtrack`).
   ```nginx
   server {
       listen 80;
       server_name api.carlhub.uk; # Update to your actual domain
       
       # Allow large file uploads (e.g., images, PDFs)
       client_max_body_size 50M;

       # Serve the separate static website
       location / {
           root /var/www/farmtrack;
           index index.html;
           # Fallback to index.html for SPA client-side routing
           try_files $uri $uri/ /index.html;
       }

       # Proxy all /api/ requests to the Express backend on port 3001
       location /api/ {
           proxy_pass http://127.0.0.1:3001; # No trailing slash, so Express receives the /api prefix
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           
           # Additional recommended headers
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. **Enable Configuration:**
   Enable the site and reload Nginx.
   ```bash
   sudo ln -s /etc/nginx/sites-available/farmtrack /etc/nginx/sites-enabled/farmtrack
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Phase 3: Cloudflare Tunnel Adjustment
1. **Update Tunnel Configuration:**
   If using Cloudflare Tunnel to expose the site, edit the tunnel configuration (`/etc/cloudflared/config.yml`) to route traffic to Nginx on port `80` instead of port `3000`.
   ```yaml
   ingress:
     - hostname: api.carlhub.uk
       service: http://localhost:80
     - service: http_status:404
   ```
2. **Restart Cloudflared Service:**
   Apply the changes by restarting the cloudflared service.
   ```bash
   sudo systemctl restart cloudflared
   ```

## Verification
- Verify the backend is running on the new port locally: `curl http://localhost:3001/health`
- Verify Nginx is routing API requests locally: `curl http://localhost/api/health`
- Verify the public endpoint (via Cloudflare): `curl https://api.carlhub.uk/health` (Assuming `/health` is grouped under `/api/`).
- Verify the separate static website loads successfully at `http://localhost/` or `https://api.carlhub.uk/`.

## Architecture Note
This setup cleanly separates your mobile application backend from your public-facing website. Android and iOS apps will connect to the `https://api.carlhub.uk/api/...` endpoints exclusively, while standard web browsers visiting `https://api.carlhub.uk/` will be served your separate static landing page.