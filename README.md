[![npm version](https://badge.fury.io/js/nestjs.svg)](https://badge.fury.io/js/nestjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

# Lior-Paris Wallet

An **event-driven digital wallet platform** built with NestJS. Supports multi-currency wallets, Stripe-powered deposits via Checkout Sessions, peer-to-peer transfers, and asynchronous event processing through an outbox pattern with BullMQ.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Installation and Running the Application](#installation-and-running-the-application)
- [How to Test](#how-to-test)
- [Project Structure](#project-structure)
- [API Specification](#api-specification)
  - [Authentication Endpoints](#authentication-endpoints)
  - [User Endpoints](#user-endpoints)
  - [Wallet Endpoints](#wallet-endpoints)
  - [Transfer Endpoints](#transfer-endpoints)
  - [Stripe Webhook](#stripe-webhook)
- [Data Model](#data-model)
- [Event-Driven Architecture](#event-driven-architecture)
- [Payment Gateway](#payment-gateway)
- [Role-based Access Control](#role-based-access-control)
- [Logging / Observability](#logging--observability)
- [Frameworks and Libraries](#frameworks-and-libraries)
- [Author](#author)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Client App  │────▶│  NestJS API  │────▶│  Stripe Checkout │
└─────────────┘     └──────┬───────┘     └───────┬──────────┘
                           │                     │ webhook
                           ▼                     ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │   MySQL 8    │     │ Webhook Controller│
                    │  (TypeORM)   │     └───────┬──────────┘
                    └──────────────┘             │ settle / fail
                           ▲                     ▼
                           │              ┌──────────────┐
                    ┌──────┴───────┐      │ Outbox Table │
                    │  Redis 7     │      └──────┬───────┘
                    │  (Cache +    │             │ cron poll (5s)
                    │   BullMQ)    │◀────────────┘
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌───────────┐ ┌──────────┐
        │ domain-  │ │ notifi-   │ │  dead-   │
        │ events   │ │ cations   │ │  letter  │
        │  queue   │ │  queue    │ │  queue   │
        └──────────┘ └───────────┘ └──────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   SendGrid   │
                    │   (Email)    │
                    └──────────────┘
```

**Key patterns:**
- **Outbox pattern** — domain events are written to an outbox table inside the same DB transaction that mutates state, then published to BullMQ by a cron poller. Guarantees at-least-once delivery without two-phase commits.
- **Circuit breaker** — Stripe calls are wrapped in an opossum circuit breaker (50% error threshold, 30s reset timeout). Prevents cascading failures when Stripe is down.
- **Idempotency** — deposits and transfers accept an `idempotencyKey`; duplicate requests return the existing result instead of double-processing.
- **Pessimistic locking** — transfers lock wallets in a deterministic order (sorted by ID) to prevent deadlocks during concurrent operations.
- **Double-entry ledger** — every balance change creates a `LedgerEntry` recording the wallet, amount, type, and resulting balance.

---

## Installation and Running the Application

```sh
git clone https://github.com/iphyokafor/lior-paris-wallet
cd lior-paris-wallet
```

### Option A: Run with Docker (recommended)

Create a `.env` from `.env.sample`, then:

```sh
docker compose up -d --build
```

Watch mode:

```sh
docker compose up app
```

- **API:** `http://localhost:3000/api/v1`
- **Bull Board (queue dashboard):** `http://localhost:3000/queues`
- **API documentation:** [Postman Docs](https://documenter.getpostman.com/view/8629267/2sBXiqFV5C)

### Option B: Run locally (Node + MySQL + Redis)

```sh
cp .env.sample .env    # configure DB, Redis, JWT, Stripe, SendGrid vars
npm install
npm run start:dev
```

> You must have MySQL and Redis instances running that match your `.env` values.

### Bootstrapping the first admin user

Public registration always creates a `USER`. To create the first `ADMIN`, use the seed script:

```sh
# Set in .env:
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me

# Docker:
docker compose exec app npm run seed:admin

# Local:
npm run seed:admin
```

The script is idempotent — if the email already exists, it promotes the user to `ADMIN`.

---

## How to Test

```sh
npm run test          # unit + integration (sequential)
npm run test:unit     # unit tests only
npm run test:int      # integration tests only (uses Testcontainers — requires Docker)
npm run test:cov      # with coverage report
```

Integration tests spin up a real MySQL container via **Testcontainers** — no manual database setup needed.

---

## Project Structure

```
src/
├── main.ts                         # Entry point (port, parsers, global prefix)
├── app.module.ts                   # Root module
├── features/
│   ├── auth/                       # Register, login, password change
│   │   ├── guards/                 # JWT + Role guards
│   │   └── strategies/             # Passport JWT + Local strategies
│   ├── users/                      # User CRUD + admin management
│   │   ├── entities/               # User entity
│   │   ├── policies/               # Authorization policies
│   │   └── repository/             # User repository
│   ├── wallet/                     # Wallets, deposits, balances
│   │   ├── entities/               # Wallet, Transaction, LedgerEntry
│   │   ├── repository/             # Wallet + Transaction repositories
│   │   ├── listeners/              # Domain event listeners
│   │   └── stripe-webhook.controller.ts
│   ├── transfers/                  # Peer-to-peer transfers
│   │   ├── entities/               # Transfer entity
│   │   └── repository/             # Transfer repository (pessimistic locking)
│   ├── payments/                   # Payment gateway abstraction
│   │   └── gateways/
│   │       └── stripe/             # Stripe Checkout Sessions + circuit breaker
│   └── notifications/              # Email via SendGrid + BullMQ
├── infrastructure/
│   ├── database/                   # TypeORM + MySQL config
│   ├── outbox/                     # Outbox entity, service, cron publisher
│   └── queue/                      # BullMQ queues, processors, DLQ
└── shared/
    ├── base/                       # BaseEntity (id, created_at, updated_at)
    ├── circuit-breaker/            # Generic opossum wrapper
    ├── config/                     # Env helpers (getRequiredString, getNumber)
    ├── constants/                  # UserRole, SupportedCurrency, table names
    ├── decorators/                 # @Public(), @Roles()
    ├── events/                     # Domain event names + payload types
    ├── filters/                    # JSON:API exception filter
    ├── interceptors/               # JSON:API content-type interceptor
    ├── jsonapi/                    # Response helpers
    ├── logging/                    # Log level config
    ├── mapper/                     # Result mapping
    ├── pipes/                      # ZodValidationPipe, JSON:API validation
    ├── schemas/                    # Zod schemas
    └── utils/                      # Wallet tag generator
test/
├── unit/                           # Unit tests (mocked dependencies)
├── integration/                    # Integration tests (real MySQL via Testcontainers)
├── e2e/                            # HTTP e2e tests
└── mocks/                          # Shared test data
```

---

## API Specification

**Base URL:** `http://localhost:3000/api/v1`

All requests with a body must use `Content-Type: application/vnd.api+json` (JSON:API).

### Authentication Endpoints

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | POST | `/auth/register` | Public | Register a new user (always `USER` role) |
| 2 | POST | `/auth/login` | Public | Login, returns JWT access token |
| 3 | POST | `/auth/password` | JWT | Change password |

<details>
<summary>Request/Response examples</summary>

**POST `/auth/register`**

```json
// Request
{
  "data": {
    "type": "users",
    "attributes": {
      "name": "John Doe",
      "email": "johndoe@example.com",
      "password": "password"
    }
  }
}

// Response 201
{
  "data": {
    "type": "users",
    "id": "b61c526e-55b7-434b-8d09-ae0d776533e0",
    "attributes": {
      "name": "John Doe",
      "email": "johndoe@example.com",
      "role": "USER",
      "created_at": "2021-10-10T12:00:00.000Z",
      "updated_at": "2021-10-10T12:00:00.000Z",
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**POST `/auth/login`**

```json
// Request
{
  "data": {
    "type": "users",
    "attributes": {
      "email": "johndoe@example.com",
      "password": "password"
    }
  }
}

// Response 200 — same shape as register
```

**POST `/auth/password`**

```json
// Request
{
  "data": {
    "type": "users",
    "attributes": {
      "oldPassword": "current_password",
      "newPassword": "new_secure_password"
    }
  }
}

// Response 200
{
  "meta": { "message": "Password updated successfully" }
}
```

</details>

### User Endpoints

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 4 | GET | `/users/me` | JWT | Current user profile (includes wallets) |
| 5 | GET | `/users` | Admin | Paginated list (`?page=1&limit=10`) |
| 6 | GET | `/users/:id` | Admin | User by ID |
| 7 | PATCH | `/users/:id` | JWT | Update user (admin can change roles) |
| 8 | DELETE | `/users/:id` | Admin | Delete user — no self-deletion (`204`) |

<details>
<summary>Request/Response examples</summary>

**GET `/users`** (Admin)

```json
{
  "data": [
    {
      "type": "users",
      "id": "732fde67-...",
      "attributes": {
        "name": "John Doe",
        "email": "johndoe@example.com",
        "role": "USER",
        "created_at": "...",
        "updated_at": "..."
      }
    }
  ],
  "meta": { "total": 1, "total_pages": 1 },
  "links": { "prev": "...", "next": "..." }
}
```

**PATCH `/users/:id`**

```json
// Request
{
  "data": {
    "type": "users",
    "id": ":id",
    "attributes": { "name": "Updated Name" }
  }
}
```

</details>

### Wallet Endpoints

| # | Method | Path | Auth | Response | Description |
|---|--------|------|------|----------|-------------|
| 9 | POST | `/wallet` | JWT | `201` | Create a wallet for a currency |
| 10 | GET | `/wallet/:currency` | JWT | `200` | Get balance (cached 60s in Redis) |
| 11 | POST | `/wallet/deposit` | JWT | `202` | Initiate deposit — returns Stripe Checkout URL |

<details>
<summary>Request/Response examples</summary>

**POST `/wallet`**

```json
// Request
{
  "data": {
    "type": "wallets",
    "attributes": {
      "currency": "EUR"
    }
  }
}

// Response 201
{
  "data": {
    "type": "wallets",
    "id": "...",
    "attributes": {
      "currency": "EUR",
      "balance": 0,
      "wallet_tag": "WLT-XXXXXXXXXXXX"
    }
  }
}
```

**POST `/wallet/deposit`**

```json
// Request
{
  "data": {
    "type": "deposits",
    "attributes": {
      "amount": 5000,
      "currency": "EUR",
      "paymentMethod": "stripe",
      "idempotencyKey": "dep-abc-123"
    }
  }
}

// Response 202
{
  "data": {
    "type": "deposits",
    "attributes": {
      "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_..."
    }
  }
}
```

> Amounts are in the smallest currency unit (cents). `5000` = €50.00.

</details>

### Transfer Endpoints

| # | Method | Path | Auth | Response | Description |
|---|--------|------|------|----------|-------------|
| 12 | POST | `/transfers` | JWT | `202` | Peer-to-peer transfer by wallet tag |

<details>
<summary>Request/Response examples</summary>

**POST `/transfers`**

```json
// Request
{
  "data": {
    "type": "transfers",
    "attributes": {
      "toWalletTag": "WLT-XXXXXXXXXXXX",
      "amount": 1000,
      "currency": "EUR",
      "idempotencyKey": "xfr-def-456"
    }
  }
}

// Response 202
{
  "data": {
    "type": "transfers",
    "id": "...",
    "attributes": {
      "amount": 1000,
      "currency": "EUR",
      "status": "COMPLETED"
    }
  }
}
```

</details>

### Stripe Webhook

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe/webhook` | Stripe signature | Handles `checkout.session.completed` and `checkout.session.expired` |

The webhook controller verifies the Stripe signature, then calls `settleByProviderRef()` or `failByProviderRef()` on the wallet service. Settlement writes the balance update, ledger entry, and outbox event in a single DB transaction.

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Successful GET or PATCH |
| `201` | Resource created |
| `202` | Accepted (async — deposit or transfer initiated) |
| `204` | Deleted |
| `400` | Invalid input |
| `401` | Missing or invalid JWT |
| `403` | Unauthorized action |
| `404` | Resource not found |
| `409` | Conflict (duplicate wallet for same currency) |
| `415` | Content-Type not `application/vnd.api+json` |

### Error Format (JSON:API)

```json
{
  "errors": [
    {
      "status": "403",
      "title": "ForbiddenException",
      "detail": "You do not have permission to access this resource"
    }
  ]
}
```

---

## Data Model

```
┌──────────┐       ┌──────────-┐       ┌─────────────--┐
│  Users   │1────* │  Wallet   │1────* │ LedgerEntry   │
│          │       │           │       │               │
│ id       │       │ id        │       │ id            │
│ name     │       │ user_id   │       │ wallet_id     │
│ email    │       │ currency  │       │ type (DEPOSIT │
│ password │       │ balance   │       │ TRANSFER_IN   │
│ role     │       │ wallet_tag│       │ TRANSFER_OUT) │
└──────────┘       └──────────-┘       │ amount        │
                                       │ balance_after │
                                       │ idempot_key   │
                                       └─────────────--┘

┌─────────────--┐       ┌──────────────┐       ┌──────────────┐
│ Transaction   │       │   Transfer   │       │ OutboxEvent  │
│               │       │              │       │              │
│ id            │       │ id           │       │ id           │
│ user_id       │       │ from_user_id │       │ event_name   │
│ type(DEPOSIT) │       │ to_user_id   │       │ aggregate_id │
│ amount        │       │ amount       │       │ payload_json │
│ currency      │       │ currency     │       │ occurred_at  │
│ status        │       │ status       │       │ processed_at │
│ payment_mthd  │       │ idempot_key  │       │ retry_count  │
│ provider_ref  │       │ failure_rsn  │       └──────────────┘
│ idempot_key   │       └──────────────┘
│ failure_rsn   │
└─────────────--┘
```

- **Wallet** — one per user per currency. Balance stored as `bigint` (smallest unit: cents).
- **Transaction** — tracks deposit lifecycle (`PENDING` → `COMPLETED` / `FAILED`). Links to the payment provider via `provider_ref` (Stripe session ID).
- **LedgerEntry** — immutable record of every balance change. `balance_after` enables audit trails without recalculating.
- **Transfer** — records peer-to-peer transfers. Two corresponding ledger entries (`TRANSFER_OUT` + `TRANSFER_IN`) are created atomically.
- **OutboxEvent** — transactional outbox for reliable event publishing.

---

## Event-Driven Architecture

### Domain Events

| Event | Trigger | Effect |
|-------|---------|--------|
| `UserRegistered` | User registers | Auto-creates a default EUR wallet |
| `DepositSucceeded` | Stripe webhook settles | Outbox → queue → email notification |
| `TransferCompleted` | Transfer executes | Outbox → queue → email notification |

### BullMQ Queues

| Queue | Purpose | Retry |
|-------|---------|-------|
| `domain-events` | Routes outbox events to handlers | 3 attempts, exponential backoff |
| `notifications` | Sends emails via SendGrid | 3 attempts, exponential backoff |
| `dead-letter` | Stores permanently failed jobs | Max 3 reprocessing attempts |

**Bull Board dashboard** available at `/queues` for monitoring queue health.

### Flow: Deposit lifecycle

1. User calls `POST /wallet/deposit` → `PENDING` transaction created, Stripe Checkout Session URL returned
2. User completes payment on Stripe
3. Stripe sends `checkout.session.completed` webhook
4. Webhook controller calls `settleByProviderRef()` — in a single DB transaction:
   - Updates transaction status to `COMPLETED`
   - Credits wallet balance
   - Creates `LedgerEntry`
   - Writes `DepositSucceeded` to outbox table
5. Outbox cron (every 5s) picks up the event → pushes to `domain-events` queue
6. `DomainEventsProcessor` routes it to `notifications` queue
7. `NotificationsProcessor` sends confirmation email via SendGrid

---

## Payment Gateway

Payments are abstracted behind a `PaymentGateway` interface, resolved at runtime by `PaymentGatewayRegistry`:

```
PaymentGateway (interface)
  └── StripePaymentGateway
        └── wraps Stripe Checkout Sessions
        └── protected by CircuitBreaker (opossum)
              ├── errorThresholdPercentage: 50%
              ├── resetTimeout: 30s
              ├── volumeThreshold: 5
              └── timeout: 10s
```

Adding a new provider (e.g., Paystack) means implementing `PaymentGateway`, registering it in the `PaymentsModule`, and passing its name as `paymentMethod` on deposit.

---

## Role-based Access Control

| Role | View own profile | Update own details | Change password | View all users | Update any user / roles | Delete users |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| USER | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (not self) |

Wallet and transfer endpoints are available to any authenticated user (JWT required).

---

## Logging / Observability

Controlled via `LOG_LEVEL` env var:

| Level | Use case |
|-------|----------|
| `debug` | Local development |
| `log` | Default |
| `warn` / `error` | CI / production |

---

## Frameworks and Libraries

| Library | Purpose |
|---------|---------|
| **NestJS 10** | Application framework |
| **TypeORM 0.3** | ORM / migrations |
| **MySQL 8** | Primary database |
| **Redis 7** | Cache (balance) + BullMQ broker |
| **BullMQ** | Job queues + retry + dead-letter |
| **Bull Board** | Queue monitoring dashboard |
| **Stripe** | Payment processing (Checkout Sessions) |
| **opossum** | Circuit breaker for external calls |
| **SendGrid** | Transactional email |
| **Passport + JWT** | Authentication |
| **argon2** | Password hashing |
| **Zod** | Request validation |
| **Testcontainers** | Integration tests with real MySQL |
| **Jest** | Test runner |
| **Docker Compose** | Local dev environment |

---

## Environment Variables

See `.env.sample` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB` | Database connection |
| `REDIS_HOST`, `REDIS_PORT` | Redis for cache + queues |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth token config |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe integration |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Email notifications |
| `PORT` | App port (default: 3500) |
| `LOG_LEVEL` | Logging verbosity |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin seed script |

---

## Author

Ifeoma Sandra Okafor


