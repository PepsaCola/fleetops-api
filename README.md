# FleetOps — API

[![CI](https://github.com/PepsaCola/fleetops-api/actions/workflows/ci.yml/badge.svg)](https://github.com/PepsaCola/fleetops-api/actions/workflows/ci.yml)

Backend of FleetOps, a fleet operations app: vehicles, drivers, trips and dispatching, and
where every vehicle is right now.

**[Live demo](https://fleetops-web-eight.vercel.app/)** · [API docs](https://fleetops-api-nine.vercel.app/docs) ·
Frontend: [fleetops-web](https://github.com/PepsaCola/fleetops-web)

Demo sign-ins: `dispatcher@fleetops.demo` or `viewer@fleetops.demo`, password `fleetops-demo`.

## Highlights

- **No double booking, guaranteed by the database.** A vehicle or a driver can't be on two
  trips at once: Postgres exclusion constraints (`btree_gist`, `tstzrange … WITH &&`) refuse
  the overlap even when two dispatchers book at the same moment. The service checks first for a
  friendly 409 with the clashing trip numbers; the constraint is the last word.
- **A fleet that moves without a single background process.** Each day's usual timetable is
  planned the first time anyone looks at that day, and planned once (a claimed row in
  `schedule_days`). Vehicle positions are worked out from the trips and the clock on every
  request, along real road geometry from OSRM. Every serverless instance gives the same answer
  with no shared state.
- **Business rules in plain functions.** Timetable, booking rules, trip status and positions
  are pure, unit-tested domain code. Routes, services and repositories only move data in and out.
- **Contract first.** Every route has Zod schemas that validate input, shape output and
  generate the OpenAPI 3.1 document. The frontend builds its typed client from that document,
  and CI fails if it is out of date.
- **Sign-in done carefully:**
  - scrypt password hashes, compared in constant time, with unknown emails taking as long as
    wrong passwords;
  - opaque session tokens in httpOnly SameSite cookies, stored only as SHA-256 hashes;
  - a rate limit on sign-in;
  - one access rule for every endpoint: signed in to read, a dispatcher to change anything.

## Tech stack

Node.js 24 · TypeScript 6 · Fastify 5 · Zod 4 (validation and OpenAPI) · PostgreSQL 18 +
PostGIS 3.6 · Drizzle ORM · Turf · Vitest · oxlint · dependency-cruiser · GitHub Actions ·
Vercel (Fluid compute) · Neon

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
| `npm run db:seed`        | Replace the data with a fresh demo fleet and users    |
| `npm run db:studio`      | Browse the database in Drizzle Studio                 |
| `npm run openapi:export` | Regenerate `openapi.json` from the route schemas      |
| `npm run check`          | Type-check, lint, architecture rules, format and test |

## Architecture

A modular monolith: one folder per business area, each split into the same layers.

```
src/
  server.ts          start-up and graceful shutdown
  build-app.ts       composition root: plugins, access rules, modules and how they connect
  config/            environment variables, validated with Zod
  infra/             adapters for external technology: database (Drizzle), OpenAPI docs
  shared/            errors, HTTP helpers and fleet time, with no business knowledge
  modules/
    auth/            users, sessions, sign-in and the access rule
    vehicles/        the fleet
    drivers/         drivers and the state of their documents
    trips/           trips, the daily timetable and booking rules
    tracking/        road routes and where every vehicle is
    demo/            the demo fleet and accounts for `db:seed`
drizzle/             SQL migrations, applied in order by `npm run db:migrate`
```

Each module is `routes → service → repository`, plus pure `domain/` code. When one module needs
another's data (tracking needs trips; trips need vehicles and drivers), `build-app.ts` passes a
function in, so modules don't reach into each other.

Rules, enforced by dependency-cruiser in CI:

- a module is used by other modules only through its `index.ts`;
- `shared/` and `infra/` never import business modules (except table files, for the schema);
- no circular imports.

## Errors

Every error response is [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) with:

- a machine-readable `code`, e.g. `TRIP_OVERLAP` or `LICENSE_CATEGORY_MISSING`;
- field-level `errors` for invalid input;
- a `requestId` that matches the server logs.

## API contract

`openapi.json` is generated from the routes' Zod schemas with `npm run openapi:export` and is
committed. The frontend generates its typed API client from this file.

Demo road routes come from the [OSRM](https://project-osrm.org/) demo server, over
© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
