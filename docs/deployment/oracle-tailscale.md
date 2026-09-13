# Oracle VM + Tailscale deployment

Assumptions: Ubuntu 24.04, SSH user ubuntu, project at /home/ubuntu/HK. These commands support Ubuntu ARM and x86. An Oracle Linux VM uses different package commands and the opc user; do not run this walkthrough unchanged there.

Phone → Tailscale HTTPS → Nginx (127.0.0.1:8080) → built frontend  
Nginx /api → Hono (127.0.0.1:8787)

This is a private single-VM deployment. It needs no Cloudflare account, Workers or R2. Tailscale Serve shares with permitted devices in your tailnet, not the public internet. The app's process-local caches refill after restarts.

## 1. Connect from your Mac

Replace the key path and VM_PUBLIC_IP:

    chmod 600 /path/to/oracle.key
    ssh -i /path/to/oracle.key ubuntu@VM_PUBLIC_IP

If creating a VM, select Ubuntu and attach your SSH public key. Allow TCP 22 from your own public IP in the Oracle security rules. Keep existing SSH access working. No public ingress rule is needed for 4173, 8080 or 8787.

A VM with 2 cores and 4GB RAM is a reasonable build starting point; this is not a promise of free-tier availability. A tiny-memory VM may need more RAM to build Cesium.

Source: [Oracle Linux-instance connection guide](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm).

## 2. Install the runtime on the VM

    sudo apt update
    sudo apt install -y git curl ca-certificates rsync nginx
    git clone --branch v0.40.3 --depth 1 https://github.com/nvm-sh/nvm.git /home/ubuntu/.nvm
    source /home/ubuntu/.nvm/nvm.sh
    nvm install 24
    nvm alias default 24
    nvm use 24
    npm install -g pnpm@11.19.0
    node -v
    pnpm --version

Skip the nvm clone if it is already installed. The service loads Node through nvm too. See [official nvm instructions](https://github.com/nvm-sh/nvm).

## 3. Copy the project from your Mac

In a second **Mac terminal**:

    rsync -av       --exclude node_modules --exclude .git --exclude dist       --exclude output --exclude .playwright-cli --exclude .pnpm-store       --exclude '.env*' --exclude .DS_Store       -e 'ssh -i /path/to/oracle.key'       "/Users/franklin/Codes/Self Project/HK/"       ubuntu@VM_PUBLIC_IP:/home/ubuntu/HK/

This copies current uncommitted work too. Do not copy Mac node_modules to Linux. Environment files are excluded; configure any approved optional 3D URL separately before building. VITE_* settings are public in the browser.

Back in the **VM terminal**:

    cd /home/ubuntu/HK
    pnpm install --frozen-lockfile
    pnpm check

Keep development dependencies installed: the current API runs through tsx, and the frontend needs build tools.

## 4. Start the API as a persistent service

The repository now includes the service and start script:

    sudo cp deploy/hk-live-api.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now hk-live-api
    sudo systemctl status hk-live-api --no-pager
    curl -f http://127.0.0.1:8787/api/v1/health

Expected response: {"status":"ok","mode":"live"}. This checks the server, not every upstream feed. systemd starts it after reboot and restarts it after failures.

## 5. Serve the built frontend

    sudo mkdir -p /var/www/hk-live
    sudo rsync -a --delete apps/web/dist/ /var/www/hk-live/
    sudo chmod -R a+rX /var/www/hk-live
    sudo cp deploy/hk-live.nginx.conf /etc/nginx/sites-available/hk-live
    sudo ln -sfn /etc/nginx/sites-available/hk-live /etc/nginx/sites-enabled/hk-live
    sudo nginx -t
    sudo systemctl enable --now nginx
    sudo systemctl reload nginx
    curl -I http://127.0.0.1:8080/
    curl -f http://127.0.0.1:8080/api/v1/health

The --delete operation only synchronizes this app's dedicated /var/www/hk-live directory. Do not substitute a directory containing other websites.

The supplied Nginx site listens only on localhost, serves Cesium assets and forwards /api unchanged. A fresh Ubuntu Nginx installation may also enable a default public port-80 welcome site. On a fresh VM, unlink /etc/nginx/sites-enabled/default and reload Nginx if you do not want that welcome site. Preserve other existing sites on a shared VM.

See [Nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

## 6. Join your Tailscale network

If not already installed, use the [official Linux installer](https://tailscale.com/download/linux):

    curl -fsSL https://tailscale.com/install.sh -o /tmp/tailscale-install.sh
    sh /tmp/tailscale-install.sh
    sudo tailscale up
    tailscale status

Open the displayed login URL and join the same tailnet as your phone. Preserve any existing Tailscale configuration.

To name this VM franklin, if that is your intended device name:

    sudo tailscale set --hostname=franklin

If another device already owns franklin.seagull-tet.ts.net, choose a different name or resolve the conflict in the admin console. Adding a Vite allowedHost does not create DNS or point the name at a new VM.

## 7. Enable private HTTPS

Check for existing mappings before configuring the root URL:

    sudo tailscale serve status

On a fresh VM with no existing root HTTPS service:

    sudo tailscale serve --bg http://127.0.0.1:8080
    sudo tailscale serve status

Follow the HTTPS enablement link if prompted. Use the exact URL printed by Serve. For a VM named franklin in your tailnet it should be:

https://franklin.seagull-tet.ts.net

No :4173 is needed. The --bg configuration persists while Tailscale is running, including after reboots. If HTTPS port 443 already serves another app, use a separate port instead of replacing it, for example:

    sudo tailscale serve --bg --https=8443 http://127.0.0.1:8080

Your tailnet access policy must permit the phone to reach the VM on the selected HTTPS port. Do not enable Funnel for this private deployment. See [Tailscale Serve documentation](https://tailscale.com/docs/reference/tailscale-cli/serve).

## 8. Open it on your phone

1. Enable Tailscale on the phone and connect to the same tailnet.
2. Open the HTTPS URL printed by Serve.
3. Check Explore, Transport and Weather.
4. Try Locate Me and allow location access if desired. HTTPS supports browser features that remote plain HTTP cannot.

Friends need appropriate tailnet or machine-sharing access and permission under your policy; this is not automatically a public website.

## Updates

Repeat the Mac rsync, then on the VM:

    cd /home/ubuntu/HK
    source /home/ubuntu/.nvm/nvm.sh
    nvm use 24
    pnpm install --frozen-lockfile
    pnpm check
    sudo rsync -a --delete apps/web/dist/ /var/www/hk-live/
    sudo chmod -R a+rX /var/www/hk-live
    sudo systemctl restart hk-live-api

This simple update can briefly interrupt requests. Keep the previous source/dist if you need rollback. Reload Nginx after configuration changes, not merely after replacing static files.

## Troubleshooting

    sudo journalctl -u hk-live-api -n 100 --no-pager
    sudo nginx -t
    sudo tailscale serve status
    tailscale status
    curl -f http://127.0.0.1:8787/api/v1/health
    curl -f http://127.0.0.1:8080/api/v1/health

- API health fails: inspect service logs, installed dependencies, Node 24 and the fixed ubuntu paths.
- Nginx 502: the backend is down or its proxy address is wrong.
- Both local checks pass but the phone cannot connect: check the actual Tailscale DNS name, membership and access policy.
- A feed fails: check its source error and freshness. Do not switch to fixture mode to disguise an upstream failure.
- Build is killed: inspect memory availability.
- Node requests time out while curl works: the README describes the existing Node network-selection workaround. If needed, add it to the service with systemctl edit hk-live-api:

  [Service]
  Environment="NODE_OPTIONS=--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=5000"

Then restart the API service.

No Oracle VM was accessed or deployed while preparing these templates. Validate Nginx and both local health checks on your VM before enabling Serve.
