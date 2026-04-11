# Production Marketplace Routing

This setup keeps only `80` and `443` public and routes Marketplace services
behind the main ByteSky domain with host Nginx.

## Recommended `.env`

Use the project root `.env` on the server:

```env
NGINX_PORT=8080
APP_BASE_URL=https://bytesky-app.duckdns.org
CONTAINER_PUBLIC_BASE_URL=https://bytesky-app.duckdns.org
VM_PUBLIC_BASE_URL=https://bytesky-app.duckdns.org

MARKETPLACE_URL_MODE=path
MARKETPLACE_BIND_HOST=127.0.0.1

APACHE_HOST_PORT=8088
APACHE_PUBLIC_PATH=/apache/
JENKINS_PUBLIC_PATH=/jenkins/
METABASE_PUBLIC_PATH=/metabase/
VM_PUBLIC_PATH=/vm/
```

Notes:

- `NGINX_PORT=8080` keeps the Docker app behind the host Nginx proxy.
- `MARKETPLACE_BIND_HOST=127.0.0.1` prevents Marketplace service ports from
  being exposed directly to the internet.
- `APACHE_HOST_PORT=8088` avoids colliding with the app itself on `127.0.0.1:8080`.

## Host Nginx

Copy [`deploy/nginx/bytesky-app.marketplace.conf.example`](./nginx/bytesky-app.marketplace.conf.example)
to your host Nginx site config, then reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The example routes:

- `/` -> `127.0.0.1:8080`
- `/apache/` -> `127.0.0.1:8088`
- `/jenkins/` -> `127.0.0.1:8081/jenkins/`
- `/metabase/` -> `127.0.0.1:3005`
- `/vm/` -> `127.0.0.1:6080`

## Security Group

Keep only these ports public:

- `80`
- `443`
- `22` for SSH

Do not expose `3005`, `6080`, `8081`, `8088`, `5432`, or `6379` publicly when
using the reverse-proxy setup.

## Deploy

```bash
cd ~/ByteSky
git pull
sudo docker compose up -d --build
```

After the app is back up, stop and relaunch any existing Marketplace
containers once from the ByteSky UI so they pick up:

- loopback-only port bindings
- the Jenkins `/jenkins` prefix
- the Metabase `MB_SITE_URL`

## Expected public URLs

- `https://bytesky-app.duckdns.org/apache/`
- `https://bytesky-app.duckdns.org/jenkins/`
- `https://bytesky-app.duckdns.org/metabase/`
- `https://bytesky-app.duckdns.org/vm/`
