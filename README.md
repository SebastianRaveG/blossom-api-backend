# Blossom API — Backend Technical Case

REST API that queries Pokémon and Digimon data from external APIs, normalizes the response to a unified format, and logs every request to a database.

Built with **Node.js + TypeScript + Express**, following **Hexagonal Architecture**.

---

## What was built

### Required by the case

| Requirement | Status | Detail |
| --- | --- | --- |
| `GET /api/:franchise/:version` endpoint | Done | Accepts `pokemon` or `digimon` |
| `metadata` query param (JSON) | Done | `{"name":"pikachu"}` or `{"id":25}` |
| `config` query param (JSON) | Done | `{"baseUrl":"https://pokeapi.co/api/v2"}` |
| Fetch from external Pokémon API | Done | PokeAPI — 3 chained calls to get evolutions |
| Fetch from external Digimon API | Done | digi-api.com — with name-search fallback |
| Normalized response format | Done | `{name, weight?, powers[], evolutions[]}` |
| Log every request to database | Done | SQLite — franchise, version, metadata, timestamp, status, error |
| Hexagonal Architecture | Done | Domain / Application / Infrastructure fully separated |
| TypeScript | Done | Strict mode enabled |
| Only GET method | Done | |

### Bonus items (optional, all implemented)

| Bonus | Detail |
| --- | --- |
| Unit tests | Unit tests with mocked dependencies |
| Integration tests | Full HTTP request tests via supertest |
| Docker | Multi-stage Dockerfile + docker-compose.yml |
| In-memory DB | SQLite via Node.js 22 built-in `node:sqlite` (no npm package needed) |
| Rate limiting | 100 requests / IP / 15 min via `express-rate-limit` |

### Extra features (not required, added for quality)

| Feature | How to use |
| --- | --- |
| `GET /api/logs` — view all logged requests | `?franchise=pokemon&limit=10` |
| `GET /health` — server status | Returns uptime and version |
| `GET /docs` — interactive Swagger UI | Test all endpoints from the browser |
| Request ID tracing | Every request gets a UUID. Header `X-Request-ID` |
| Typed error hierarchy | Each error maps to its HTTP status code |
| Env variable validation | App fails fast on startup if configuration is invalid |

---

## How to run it

### Requirements

- **Node.js v22 or higher** (required — uses `node:sqlite` built into Node 22)
- npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config (defaults work out of the box)
# macOS / Linux:
cp .env.example .env
# Windows:
copy .env.example .env

# 3. Start the development server (with hot-reload)
npm run dev
```

The server starts at `http://localhost:3000`

### With Docker (alternative)

```bash
docker-compose up --build
```

### Run tests

```bash
npm test
```

---

## How to call the API

### Get a Pokémon by name

```http
GET http://localhost:3000/api/pokemon/v1
  ?metadata={"name":"pikachu"}
  &config={"baseUrl":"https://pokeapi.co/api/v2"}
```

Response:

```json
{
  "name": "pikachu",
  "weight": 60,
  "powers": ["static", "lightning-rod"],
  "evolutions": ["pichu", "raichu"]
}
```

### Get a Pokémon by ID

```http
GET http://localhost:3000/api/pokemon/v1
  ?metadata={"id":25}
  &config={"baseUrl":"https://pokeapi.co/api/v2"}
```

### Get a Digimon

```http
GET http://localhost:3000/api/digimon/v1
  ?metadata={"name":"Agumon"}
  &config={"baseUrl":"https://digi-api.com/api/v1"}
```

Response:

```json
{
  "name": "Agumon",
  "powers": ["Pepper Breath", "Claw Attack"],
  "evolutions": ["Greymon"]
}
```

Note: Digimon has no `weight` field — it simply does not appear in the response.

### View request logs

```http
GET http://localhost:3000/api/logs
GET http://localhost:3000/api/logs?franchise=pokemon&limit=10
```

### Health check

```http
GET http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-04-09T12:00:00.000Z",
  "uptime": "42s",
  "version": "1.0.0"
}
```

### Interactive documentation

Open `http://localhost:3000/docs` in your browser — Swagger UI lets you test every endpoint directly.

---

## Error responses

All errors follow this format:

```json
{
  "error": {
    "code": "INVALID_FRANCHISE",
    "message": "Franchise \"naruto\" is not supported."
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| HTTP Status | Code | When it happens |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing or invalid `metadata` / `config` params |
| 400 | `INVALID_FRANCHISE` | Franchise is not `pokemon` or `digimon` |
| 404 | `CHARACTER_NOT_FOUND` | Character does not exist in the external API |
| 429 | `RATE_LIMIT_EXCEEDED` | More than 100 requests in 15 minutes |
| 502 | `EXTERNAL_API_ERROR` | PokeAPI or DigiAPI returned an error |

---

## Configuration (.env)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `DB_PATH` | `./data/blossom.db` | SQLite file path |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (15 min) |

---

## Project structure

```text
src/
├── domain/                    Pure business logic — no HTTP, no DB, no external APIs
│   ├── entities/              Data shapes (what a character looks like)
│   ├── ports/                 Interfaces — what the domain needs (not how)
│   └── errors/                Typed errors with HTTP status codes
│
├── application/               Orchestration — connects domain to infrastructure
│   └── usecases/              GetFranchiseDataUseCase — the only use case
│
└── infrastructure/            Concrete implementations — HTTP, DB, external APIs
    ├── adapters/              PokemonAdapter, DigimonAdapter
    ├── database/              SQLiteLogRepository
    ├── docs/                  Swagger/OpenAPI configuration
    └── http/
        ├── controllers/       FranchiseController, HealthController
        ├── middlewares/       errorHandler, requestId, rateLimiter
        ├── routes/            URL definitions
        └── validators/        Query param validation with Zod

tests/
├── unit/                      Each class tested in isolation (no I/O)
└── integration/               Full HTTP requests through a real Express app
```

---

## Architecture — Hexagonal (Ports & Adapters)

The core rule: **business logic never imports infrastructure code**.

```text
HTTP Request
    │
    ▼
FranchiseController          ← knows about HTTP (req, res)
    │
    ▼
GetFranchiseDataUseCase      ← knows NOTHING about HTTP, SQLite, or axios
    │
    ├── IFranchiseAdapter    ← interface (port)
    │       └── PokemonAdapter / DigimonAdapter   ← implementation
    │
    └── ILogRepository       ← interface (port)
            └── SQLiteLogRepository               ← implementation
```

Implementations can be swapped without touching the use case:

- SQLite → PostgreSQL: write a new class, change one line in `app.ts`
- Add a new franchise (e.g. Yu-Gi-Oh): write one new adapter, register it in `app.ts`

---

## Design decisions

### Why Hexagonal Architecture?

It enforces a clean separation between business logic and I/O concerns. The use case can be unit-tested with no database, no HTTP client, and no running server — just plain function calls with mock implementations. Swapping any infrastructure piece requires no changes to the application or domain layers.

### Why `node:sqlite` instead of an npm package?

`node:sqlite` is built into Node.js 22 — zero extra dependencies, zero supply-chain risk. For a logging use case, SQLite is more than sufficient. If the app needed to scale to PostgreSQL, the `ILogRepository` interface makes the swap a single-file change.

### Why Zod for validation?

Zod generates both runtime validation and TypeScript types from the same schema, eliminating drift between types and runtime checks. Validation errors are structured objects that serialize cleanly into the 400-response `details` field.
