# Docker Setup - Quick Reference

## Services Running

✅ **MySQL Database**
- Container: `lior-paris-wallet-mysql`
- Port: `3307` (external) → `3306` (internal)
- Database: `lior_paris_wallet_db`
- User: `lior_paris_wallet_user`
- Password: `lior_paris_wallet_pass`

✅ **NestJS Application**
- Container: `lior-paris-wallet-app`
- Port: `3000`
- URL: http://localhost:3000

## Available Endpoints

- `GET /api/v1` - Health check
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/password` - Change password
- `GET /api/v1/users/me` - Get current user (includes wallets)
- `GET /api/v1/users` - List all users (admin)
- `GET /api/v1/users/:id` - Get user by ID (admin)
- `PATCH /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user
- `POST /api/v1/wallet` - Create wallet
- `GET /api/v1/wallet/:currency` - Get balance
- `POST /api/v1/wallet/deposit` - Initiate deposit (Stripe Checkout)
- `POST /api/v1/transfers` - Peer-to-peer transfer
- `POST /api/v1/stripe/webhook` - Stripe webhook (signature verified)
- `/queues` - Bull Board queue dashboard

## Docker Commands

### Start all services
```bash
docker compose up -d
```

If you want to rebuild the app image:
```bash
docker compose up -d --build
```

### Stop all services
```bash
docker compose down
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f mysql
```

### Restart services
```bash
docker compose restart
```

### Check status
```bash
docker compose ps
```

### Connect to MySQL
```bash
# From your host machine
mysql -h localhost -P 3307 -u lior_paris_wallet_user -p

# From inside the app container
docker compose exec app mysql -h mysql -u lior_paris_wallet_user -p
```

### Rebuild app after code changes
```bash
docker compose up -d --build app
```

## Troubleshooting

### MySQL connection issues
- Check if MySQL is healthy: `docker compose ps`
- View MySQL logs: `docker compose logs mysql`
- MySQL is accessible at `localhost:3307` from your host

### App not starting
- Check logs: `docker compose logs app`
- Rebuild: `docker compose up -d --build app`

### Node deprecation warning (DEP0190)
You may see a warning like `DEP0190` in the app logs while running in dev/watch mode. This is typically emitted by a dev dependency spawning child processes with `shell: true`.

- To silence warnings in Docker dev runs, set `NODE_OPTIONS=--no-warnings` (in `.env` or your shell) and restart the app container.
- To trace where it originates, set `NODE_OPTIONS=--trace-deprecation` and restart.

### Port already in use
- Change ports in `docker-compose.yml`
- Stop conflicting services

### Clean restart
```bash
docker compose down -v  # Removes volumes (WARNING: deletes data)
docker compose up -d
```

## Notes

- Your local MySQL on port 3306 is still running separately
- Docker MySQL uses port 3307 to avoid conflicts
- Hot reload is enabled for development
- Database data persists in Docker volume `lior-paris-wallet_mysql_data`

## Environment variables

- `docker-compose.yml` includes working defaults, so a local `.env` file is not required to run `docker compose up`.
- If you want to override defaults (or set admin seed variables), copy `.env.sample` to `.env` and adjust values. Docker Compose will automatically load `.env` for variable substitution.

## Bootstrapping the first admin (Docker)

If you want to create (or promote) the first `ADMIN` user, you must provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`).

Option 1: set them in your `.env` and restart the app container so it picks up the new environment:

```bash
docker compose restart app
```

Then run:

```bash
docker compose exec app npm run seed:admin
```

Option 2: pass them directly to the running container (no restart required):

```bash
docker compose exec \
	-e ADMIN_NAME=Admin \
	-e ADMIN_EMAIL=admin@example.com \
	-e ADMIN_PASSWORD=change-me \
	app npm run seed:admin
```
