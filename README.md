# FleetOps — API

Backend of FleetOps, a fleet operations app: vehicles, drivers, trips, maintenance and costs.

> Work in progress. Frontend: [fleetops-web](https://github.com/PepsaCola/fleetops-web).

## Tech stack

Node.js 24 · TypeScript 6 · Fastify 5 · Zod 4 (validation and OpenAPI) · PostgreSQL 18 + PostGIS ·
Drizzle ORM · Vitest · oxlint · dependency-cruiser

## Getting started

Requires Node.js 24 and Docker.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs on http://localhost:3000 and its interactive docs on http://localhost:3000/docs.
`GET /health` says the process is up; `GET /ready` also checks the database.

## Scripts

| Script                   | What it does                                          |
| ------------------------ | ----------------------------------------------------- |
| `npm run dev`            | Start with auto-reload                                |
| `npm run build`          | Compile to `dist/`                                    |
| `npm start`              | Run the compiled build                                |
| `npm test`               | Run the unit tests (no database needed)               |
| `npm run test:int`       | Run the integration tests against Postgres (`db:up`)  |
| `npm run lint:deps`      | Check the architecture rules                          |
| `npm run db:up`          | Start PostgreSQL + PostGIS in Docker                  |
| `npm run db:down`        | Stop the database (data is kept in a Docker volume)   |
| `npm run db:generate`    | Create a migration from changes in the table files    |
| `npm run db:migrate`     | Apply pending migrations                              |
| `npm run db:seed`        | Replace the data with a fresh demo fleet              |
| `npm run db:studio`      | Browse the database in Drizzle Studio                 |
| `npm run openapi:export` | Regenerate `openapi.json` from the route schemas      |
| `npm run check`          | Type-check, lint, architecture rules, format and test |

## Architecture

A modular monolith: one folder per business area, each split into the same layers.

```
src/
  server.ts          start-up and graceful shutdown
  app.ts             composition root: plugins, database, error handling, modules
  config/            environment variables, validated with Zod
  infra/             adapters for external technology: database (Drizzle), OpenAPI docs
  shared/            errors and HTTP helpers with no business knowledge
  modules/<name>/    routes → service → repository, plus pure domain logic
drizzle/             SQL migrations, applied in order by `npm run db:migrate`
```

Rules, enforced by dependency-cruiser in CI:

- a module is used by other modules only through its `index.ts`;
- `shared/` and `infra/` never import business modules (except table files, for the schema);
- no circular imports.

## Errors

Every error response is [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) with a machine-readable `code`, field-level `errors` for invalid
input and a `requestId` that matches the server logs.

## API contract

`openapi.json` is generated from the routes' Zod schemas with `npm run openapi:export` and is
committed. The frontend generates its typed API client from this file.
