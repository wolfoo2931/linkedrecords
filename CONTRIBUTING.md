# Contributing to LinkedRecords

Thanks for your interest in contributing! This guide covers how to set up a
development environment, run the test suites, and submit changes.

## Prerequisites

- **Node.js v24**
- **PostgreSQL** (any recent version; CI tests against 15/16), or use the
  embedded [PGlite](https://pglite.dev/) database by setting `USE_PGLITE=true`
- **Docker** (optional, convenient for running PostgreSQL or the full stack)

## Setup

```bash
git clone https://github.com/wolfoo2931/linkedrecords.git
cd linkedrecords
npm install
cp .env.example .env   # then adjust values as needed
```

Environment variables are loaded from `.env` via dotenv. See `.env.example`
for a working local configuration and the
[configuration reference](https://linkedrecords.com/configuration) for all
options. The database schema is created automatically on first start - there
is no separate migration step.

## Running the Server

```bash
npm start   # builds with webpack and starts the server on port 6543
```

Set `AUTH_DEV_MODE=true` to use the built-in mock OIDC provider - no external
identity provider needed for local development.

## Running Tests

### Component tests

```bash
npm test
```

This runs `bin/test.sh`, which starts a dummy OIDC server and a test server,
then runs the Vitest suite. It needs a database: either PostgreSQL configured
via the `PG*` variables, or `USE_PGLITE=true`.

### End-to-end tests (WebdriverIO)

```bash
npm run wdio        # full E2E suite
npm run wdio:fast   # reuses browser sessions between specs
```

The E2E suite drives real browsers against the test app in
`specs.wdio/testapp/`.

> **Note:** The E2E suite currently authenticates against a hosted Auth0 test
> tenant and requires secrets (`TEST_USERS_PWD`, `AUTH_CLIENT_SECRET`) that
> are only available in CI. External contributors can rely on the GitHub
> Actions workflows to run these on their pull request; run `npm test` and
> `npm run lint` locally.

### Linting

```bash
npm run lint        # ESLint
npm run lint:fix    # auto-fix
```

## Documentation Website

The docs site (published at [linkedrecords.com](https://linkedrecords.com))
is a [Fumadocs](https://fumadocs.dev/) app in `docs/`:

```bash
cd docs
npm install
npm run dev     # local dev server
npm run build   # static export (also validates MDX)
```

Content lives in `docs/content/docs/*.mdx`; the sidebar order is defined in
`docs/content/docs/meta.json`.

## Pull Requests

- Branch from `main` and keep PRs focused on one change.
- Make sure `npm run lint` and `npm test` pass locally.
- CI runs lint, component tests, E2E tests (PostgreSQL 15/16 and PGlite), and
  a Docker build check on every PR.
- If you change public behavior (SDK API, HTTP endpoints, configuration),
  update the docs in `docs/content/docs/` and, where relevant, `README.md`
  and `CLAUDE.md` in the same PR.

## Project Orientation

- `src/server/routes.ts` - HTTP route definitions
- `src/browser_sdk/` - the `@linkedrecords/browser` SDK source
- `src/records/` - record types (key-value CRDT, long-text OT, blob) and storage backends
- `src/facts/` - triplestore and authorization engine
- `specs.wdio/tinytodo/` - a complete example app used by the E2E tests

`CLAUDE.md` contains a compact developer guide (aimed at AI coding assistants,
useful for humans too).
