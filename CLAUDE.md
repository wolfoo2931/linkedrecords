# LinkedRecords - Developer Guide for Claude

## Project Overview

**LinkedRecords** is a Backend-as-a-Service (BaaS) that provides a NoSQL database you can connect to directly from single-page applications - no backend code required.

- **Repository:** https://github.com/wolfoo2931/linkedrecords
- **License:** MIT
- **npm packages:** `@linkedrecords/browser` (core SDK), `@linkedrecords/react` (React hooks, separate repo)
- **Author:** Oliver Wolf

> **Naming note:** The core data concept is called **Record**; it was formerly
> called **Attribute** (renamed in 2025). The runtime type identifiers
> (`KeyValueAttribute`, `LongTextAttribute`, `BlobAttribute`), the
> `client.Attribute` repository alias, and the `/attributes` HTTP routes remain
> as backwards-compatible aliases. Use the `Record` forms in new code.

## Core Concept

You can think of LinkedRecords as a bucket where anyone can sign up and insert data. As long as you don't share this data with other users or groups, only you can access what you've written.

Key idea: Instead of defining universal authorization rules in the backend, the user who inserts a data record specifies who can read it.

## Tech Stack

### Backend
- **TypeScript** on Node.js v24
- **Express.js** for HTTP API
- **PostgreSQL** (triplestore for facts + record storage)
- **Socket.IO** for real-time (optional Redis Streams adapter for multi-instance)
- **OpenID Connect** (OIDC) for authentication
- **MinIO/S3** for blob storage (optional)

### Frontend SDK
- **TypeScript** browser SDK
- **oidc-client-ts** for OIDC
- **Socket.IO client** for real-time

### Testing
- **Vitest** for component tests (`npm test` via `bin/test.sh`)
- **WebdriverIO v9** for E2E tests (`npm run wdio`)

## Project Structure

```
src/
├── server/                       # Express server
│   ├── routes.ts                # Route definitions
│   ├── controllers/             # API endpoints
│   │   ├── facts_controller.ts     # Fact management (triplestore)
│   │   ├── records_controller.ts   # Record CRUD + blueprints
│   │   ├── quota_controller.ts     # Storage quotas
│   │   ├── userinfo_controller.ts  # User info
│   │   └── oidc_controller.ts      # OIDC discovery
│   ├── middleware/              # Auth, error handling
│   ├── payment_provider/        # Paddle integration
│   └── quota/                   # Quota management
├── browser_sdk/                  # Client SDK
├── records/                      # Data storage
│   ├── key_value/               # JSON documents (CRDT)
│   ├── long_text/               # Large text (OT)
│   ├── blob/                    # Binary files
│   ├── record_query.ts          # Query engine
│   └── record_storage/          # PostgreSQL/S3 backends
├── facts/                        # Authorization system
│   ├── server/                  # Fact management, auth SQL
│   └── client/                  # Fact queries
└── dev-oidc/                     # Mock OIDC provider (AUTH_DEV_MODE)

lib/                       # Shared utilities
├── client-server-bus/    # WebSocket/HTTP layer
├── pg-log/               # PostgreSQL with logging (PGlite support)
└── utils/                # Helpers

specs.wdio/               # Integration tests
├── tinytodo/             # Example todo app
├── testapp/              # Test application
└── helpers/              # Test utilities
```

## Key Concepts

### 1. Facts (Triples)

LinkedRecords uses a **triplestore pattern**: `(subject, predicate, object)`

Facts represent relationships between entities. They are stored in PostgreSQL and control authorization.

### 2. Terms - MUST Be Declared First

**CRITICAL:** Before using a term like "TodoList" or "Organization", you **MUST declare it** using `$isATermFor`:

```typescript
// Declare terms before using them
await client.Fact.createAll([
  ['Organization', '$isATermFor', 'A business organization'],
  ['TodoList', '$isATermFor', 'A list of tasks'],
  ['AdminTeam', '$isATermFor', 'Team of administrators'],
]);

// Now you can use these terms
const org = await client.Record.createKeyValue(
  { name: 'Acme Inc' },
  [['$it', 'isA', 'Organization']]  // 'Organization' was declared above
);
```

**Terms are public domain** - once declared, anyone can refer to them in facts.

### 3. Reserved Predicates (Starting with $)

**Authorization predicates** (start with `$`):
- `$isATermFor` - Define terms (must be declared first)
- `$isAccountableFor` - Ownership/accountability (auto-assigned to creator)
- `$isMemberOf` - Membership in groups/teams
- `$isHostOf` - Can add members to a group
- `$canRead` - Read-only access
- `$canAccess` - Read and write access
- `$canRefine` - Can use as subject in facts (conceptor permission)
- `$canReferTo` - Can use as object in facts (referrer permission)

**System predicates**:
- `$hasDataType` - Filter by record type (legacy names: KeyValueAttribute, LongTextAttribute, BlobAttribute)
- `$latest(predicate)` - Get latest value for a predicate
- `$not(value)` - Negation

**Custom predicates** (no `$` prefix):
- `isA` - Type classification
- `stateIs` - Current state
- `belongsTo` - Belongs to relationship
- Any custom predicates you define

### 4. Accountability

- When you create a record, you're **automatically accountable** for it
- A fact `[userId, '$isAccountableFor', recordId]` is created automatically
- Accountability determines quota usage
- You can transfer accountability: `[orgId, '$isAccountableFor', '$it']`

### 5. Record Types

#### Key-Value Records (CRDT)
```typescript
const attr = await client.Record.createKeyValue(
  { name: 'value', nested: { data: 123 } },
  [['$it', 'isA', 'MyType']]
);
```

#### Long Text Records (OT)
```typescript
const attr = await client.Record.createLongText('Initial text content');
```

#### Blob Records
```typescript
const attr = await client.Record.createBlob(binaryData);
```

### 6. Creating Records

**Simple creation:**
```typescript
const list = await client.Record.createKeyValue(
  { title: 'Shopping', items: [] },
  [['$it', 'isA', 'TodoList']]
);
```

**With team access:**
```typescript
const doc = await client.Record.createKeyValue(
  { content: '...' },
  [
    ['$it', 'isA', 'Document'],
    [teamId, '$canAccess', '$it']  // Team can access
  ]
);
```

**Blueprint pattern (multiple related records):**
```typescript
const { org, adminTeam, internTeam } = await client.Record.createAll({
  org: {
    type: 'KeyValueAttribute',
    value: { name: 'Acme Inc' },
    facts: [
      ['$it', 'isA', 'Organization']
    ]
  },
  adminTeam: {
    type: 'KeyValueAttribute',
    value: {},
    facts: [
      ['$it', 'isA', 'AdminTeam'],
      ['{{org}}', '$isAccountableFor', '$it'],  // Org is accountable
      ['$it', '$canRefine', '{{org}}'],         // Admins can modify org
      ['$it', '$isHostOf', '{{internTeam}}']    // Admins can add to intern team
    ]
  },
  internTeam: {
    type: 'KeyValueAttribute',
    value: {},
    facts: [
      ['$it', 'isA', 'InternTeam'],
      ['{{org}}', '$isAccountableFor', '$it'],
      ['$it', '$canRead', '{{org}}']
    ]
  }
});
```

### 7. Querying Records

**Find by ID:**
```typescript
const attr = await client.Record.find(recordId);
const value = await attr.getValue();
```

**Find all matching a pattern:**
```typescript
const { lists } = await client.Record.findAll({
  lists: [
    ['$it', 'isA', 'TodoList']
  ]
});
// Returns all TodoLists the user can access
```

**Complex queries:**
```typescript
const { todos } = await client.Record.findAll({
  todos: [
    ['$it', '$hasDataType', 'KeyValueAttribute'],
    ['$it', 'isA', 'TodoList'],
    ['$it', '$isMemberOf', collectionId],
    ['$it', '$latest(stateIs)', `$not(${archivedStateId})`],
    [orgId, '$isAccountableFor', '$it']
  ]
});
```

### 8. Managing Facts

**Create facts:**
```typescript
await client.Fact.createAll([
  [userId, '$isMemberOf', teamId],
  [listId, 'stateIs', archivedStateId]
]);
```

**Delete facts:**
```typescript
await client.Fact.deleteAll([
  [userId, '$isMemberOf', teamId]
]);
```

**Query facts:**
```typescript
const facts = await client.Fact.findAll([
  [null, 'isA', 'Team']
]);
```

### 9. Team/Group Patterns

**Adding user to team:**
```typescript
// Only authorized users (creator or host) can add members
const userId = await client.getUserIdByEmail('user@example.com');
await client.Fact.createAll([
  [userId, '$isMemberOf', teamId]
]);
```

**Making someone a host:**
```typescript
// Hosts can add other members to the team
await client.Fact.createAll([
  [userId, '$isHostOf', teamId]
]);
```

**Sharing with granular permissions:**
```typescript
// Read-only access
await client.Fact.createAll([
  [userId, '$canRead', documentId]
]);

// Read-write access
await client.Fact.createAll([
  [userId, '$canAccess', documentId]
]);
```

## Real-World Example: TinyTodo

See `specs.wdio/tinytodo/tinytodo.ts` for a complete implementation.

**Setup:**
```typescript
// 1. Declare terms first
await client.Fact.createAll([
  ['Organization', '$isATermFor', 'xx'],
  ['TodoList', '$isATermFor', 'xx'],
  ['AdminTeam', '$isATermFor', 'xx'],
  ['TempTeam', '$isATermFor', 'xx'],
  ['InternTeam', '$isATermFor', 'xx'],
  ['ListOfTodoLists', '$isATermFor', 'xx'],
  ['ArchivedState', '$isATermFor', 'xx'],
]);

// 2. Create org with teams using blueprint
const { org, adminTeam, tempTeam, internTeam, todoLists, archivedState } =
  await client.Record.createAll(getOrgBlueprint('Acme Inc'));
```

**Create todo list:**
```typescript
const { list } = await client.Record.createAll({
  list: {
    type: 'KeyValueAttribute',
    value: { name: 'Shopping', tasks: {} },
    facts: [
      ['$it', 'isA', 'TodoList'],
      ['$it', '$isMemberOf', todoLists.id],  // Assign to org
      [orgId, '$isAccountableFor', '$it']    // Org pays for storage
    ]
  }
});
```

**Get all lists for an org:**
```typescript
const { lists } = await client.Record.findAll({
  lists: [
    ['$it', 'isA', 'TodoList'],
    ['$it', '$isMemberOf', todoListsId],
    ['$it', '$latest(stateIs)', `$not(${archivedStateId})`]
  ]
});
```

**Archive a list:**
```typescript
await client.Fact.createAll([
  [listId, 'stateIs', archivedStateId]
]);
```

## Configuration

Environment variables:

### Database
- `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### OIDC
- `AUTH_ISSUER_BASE_URL` - OIDC provider
- `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`
- `AUTH_COOKIE_SIGNING_SECRET`
- `AUTH_TOKEN_AUDIENCE` (public client mode)

### CORS & Frontend
- `CORS_ORIGIN` - JSON array of origins
- `FRONTEND_BASE_URL`
- `SERVER_BASE_URL`

### S3 (optional)
- `S3_ENDPOINT`, `S3_BUCKET`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `S3_USE_SSL`

### Quotas
- `DEFAULT_STORAGE_SIZE_QUOTA` - MB per user
- `QUOTA_COUNT_KV_RECORDS`
- `QUOTA_COUNT_LT_RECORDS`

### Payment (optional)
- `PADDLE_API_KEY`, `PADDLE_API_URL`
- `PADDLE_NOTIFICATION_SECRET`

### Performance
- `ENABLE_AUTH_RULE_CACHE`
- `SHORT_LIVED_ACCESS_TOKEN_SIGNING`

## API Endpoints

### Facts
- `GET /facts` - Query facts
- `POST /facts` - Create facts (body: plain JSON array of triples; 403 if any fact unauthorized, nothing saved)
- `POST /facts/delete` - Delete facts (body: plain JSON array of triples)

### Records
- `GET /records?query=...` - Query records
- `GET /records/:id` - Get record
- `POST /records?dtp=<kv|l|bl>` - Create record
- `PATCH /records/:id` - Apply CRDT/OT change to record
- `GET /records/:id/members` - List members/hosts of a record
- `POST /record-compositions` - Create multiple (blueprint)
- Legacy aliases: `/attributes` and `/attribute-compositions` route to the same handlers

### Other
- `GET /userinfo` - User information (`?email=` looks up a user ID by email)
- `GET /quota/:nodeId` - Storage quota
- `GET /oidc/discovery` - OIDC discovery (unauthenticated; usable as liveness probe)

## Browser SDK Usage

### Public Client Mode (cross-domain)
```typescript
import LinkedRecords from '@linkedrecords/browser';

const lr = new LinkedRecords(
  new URL('https://your-backend.com'),
  {
    client_id: 'your-client-id',
    redirect_uri: window.location.origin + '/callback'
  }
);

// Check auth
const isAuth = await lr.isAuthenticated();

// Login
lr.login();
```

### Confidential Client Mode (same domain)
```typescript
const lr = new LinkedRecords(new URL('https://your-backend.com'));
// Uses cookies automatically
```

## Development Workflow

```bash
npm install
npm start              # Build and run server (port 6543)
npm test               # Run unit tests
npm run wdio           # Run E2E tests
npm run lint           # ESLint
npm run build          # Build with Webpack
```

## Common Patterns

### 1. Always Declare Terms First
```typescript
await client.Fact.createAll([
  ['MyType', '$isATermFor', 'Description']
]);
```

### 2. Use Blueprint Pattern for Related Data
```typescript
const result = await client.Record.createAll({
  parent: { type: 'KeyValueAttribute', value: {}, facts: [...] },
  child: { type: 'KeyValueAttribute', value: {}, facts: [
    ['{{parent}}', '$isAccountableFor', '$it']
  ]}
});
```

### 3. Filter Queries with $latest and $not
```typescript
['$it', '$latest(status)', `$not(${deletedId})`]
```

### 4. Use $hasDataType to Filter by Type
```typescript
['$it', '$hasDataType', 'KeyValueAttribute']
```

### 5. Transfer Accountability for Quota Management
```typescript
[orgId, '$isAccountableFor', '$it']  // Org pays for storage
```

## Important Files

### Server
- `src/server/index.ts` - Server entry point
- `src/server/routes.ts` - Route definitions
- `src/server/controllers/facts_controller.ts` - Facts API
- `src/server/controllers/records_controller.ts` - Records API + blueprints
- `src/facts/server/index.ts` - Fact management and authorization
- `src/facts/server/authorization_sql_builder.ts` - Authorization SQL
- `src/records/record_query.ts` - Query engine

### SDK
- `src/browser_sdk/index.ts` - SDK entry point (LinkedRecords class)
- `src/browser_sdk/records_repository.ts` - `client.Record` repository
- `src/browser_sdk/facts_repository.ts` - `client.Fact` repository

### Storage
- `src/records/record_storage/psql/` - PostgreSQL backend
- `src/records/record_storage/s3/` - S3 blob backend

## Testing

### Unit Tests
- Run with `npm test`
- Located throughout codebase

### Integration Tests
- Run with `npm run wdio`
- `specs.wdio/browser_sdk/auth.spec.ts` - Authorization tests
- `specs.wdio/tinytodo/` - Complete example app
- Tests simulate multiple users, team membership, permissions

## Debugging Tips

1. **Check facts table** - Query PostgreSQL to see authorization state
2. **Verify terms declared** - All `isA` predicates need declared terms
3. **Check permissions** - User needs proper permissions to create facts
4. **Use test suite** - `specs.wdio/` has comprehensive examples
5. **Socket.IO issues** - Check WebSocket connections for real-time
6. **OIDC config** - Verify redirect URIs match exactly
7. **Filter by $isAccountableFor** - Prevents seeing other users' data

## Known Gotchas

1. **Terms must be declared** - Cannot use `['$it', 'isA', 'Foo']` without declaring 'Foo' first
2. **Creator is auto-accountable** - Don't need explicit `$isAccountableFor` for creator
3. **Authorization is decentralized** - Each user defines access for their own data
4. **Fact creation can fail silently** - Check return value to see if facts were created
5. **CORS must be configured** - Required for cross-domain setups
6. **Quota tracked by accountability** - Storage deducted from accountable node
7. **$isMemberOf vs $isHostOf** - Members can access, hosts can add new members
8. **Array fields in KeyValue records** - Arrays are **completely overwritten** on concurrent updates (last write wins), no merging happens. If you need array merging, use separate facts or records for array items.

## Design Principles

1. **Simplicity** - Facts + records as building blocks
2. **Flexibility** - Composable patterns for different use cases
3. **Decoupled** - Frontend apps independent of backend
4. **Authorization-first** - Access control built into triplestore
5. **Real-time** - Native collaboration support

## Related Resources

- README: `README.md`
- Example app: `specs.wdio/tinytodo/tinytodo.ts`
- Test suite: `specs.wdio/browser_sdk/auth.spec.ts`
- Helpers: `specs.wdio/helpers/`
