# Performance Optimization Backlog

Findings from a codebase performance analysis (July 2026). Ranked roughly by
bang-for-buck (best effort/effect ratio first) within each section.

Context: the query architecture already avoids the classic triple-store
scaling problem — fact boxes partition the graph by sharing cluster, so query
cost scales with the data *visible to the user*, not with total database size
(see the load test chart in the README). Almost all remaining waste is
constant-factor: sequential DB round trips, per-request rebuilding of
middleware, and one DDL-per-record design. The two exceptions that change
scaling behavior are #12 and #13.

## Server / product code

| # | Optimization | Effort | Effect | Where it helps | Status |
|---|---|---|---|---|---|
| 1 | Make pool size configurable, raise from `max: 3` (`lib/pg-log/index.ts`; also `connectionTimeoutMillis: 2000` fails under load) | Trivial | Medium | Load-test measurement: `fetchDocument` max latency ~50ms → ~30ms (its 9-group compound query fans out into 9 parallel statements, which no longer queue in waves of 3). `fetchDocuments` (single group, nothing to parallelize) and `createDocument` (dependent sequential writes) unchanged, as expected | **Done** — configurable via `PG_POOL_SIZE`, default 10 (branch `tune_db_pool_size`) |
| 2 | Build the OIDC `auth()` middleware once instead of per request (`src/server/middleware/authentication.ts` — memoize per `prompt` variant, hoist the bearer middleware). Saves ~0.3ms CPU per request (isolated bench: 0.73 → 0.44 ms/req) and restores per-instance OIDC discovery caching | Low | Low — not measurable in the load test | No effect on load-test numbers: operations are 30–600ms and DB-bound, so a sub-ms CPU saving is below the noise floor; steady-state cookie sessions validate locally and never hit discovery (only login does, 3× per run). Would only surface under high request concurrency / WS connection churn, which a single sequential test client never produces | Tried, reverted |
| 3 | Index tuning in `Fact.initDB`: added `(predicate, object)` (pattern lookups, `$latest`/`$not` subqueries) and `(fact_box_id, predicate)` (auth CTE scope filter); dropped `idx_facts_subject`, `idx_facts_predicate`, `idx_facts_fact_box_id` (all prefixes of composite indexes) and the boolean `idx_facts_latest` — net one index fewer to maintain per write. Caveat: plain `CREATE INDEX` blocks writes while building; on a large existing production `facts` table, build the two new indexes manually with `CREATE INDEX CONCURRENTLY` before deploying | Low | Medium | Load-test measurement (plateau ≳3,400 docs, default pool of 3): `fetchDocument` 54 → 46 ms (−15%, max 56 → 47), `fetchDocuments` 41 → 38 ms (−7%) — the read paths' `$latest`/`$not` subqueries and pattern lookups now hit `(predicate, object)` directly. `createDocument` unchanged (33.1 → 32.4 ms): index-maintenance savings are invisible next to its sequential round trips. Scaling expectation: vs *total* DB growth the percentage stays roughly constant (fact boxes keep both plans flat), but the composites guard against planner cliffs — the old single-column predicate/object indexes grow with the whole DB (terms and predicates are shared across tenants) and bitmap plans over them degrade at scale. Vs *per-user* data growth the gain widens: the saved scan work is proportional to partition size while fixed per-request costs are not (measured at only 300 docs/user — re-measure with a raised `maxDocumentsForOrgUnderTest` to confirm) | **Done** — merged as PR #185 |
| 4 | Parallelize read-only auth checks with `Promise.all` (`findUnauthorizedFacts` in `records_controller.ts`, fact loops in `facts_controller.ts`) | Low | Low–Medium | Record/composition creation, `POST /facts` | Open |
| 5 | Return in-memory values from `getCompositionResult` instead of re-reading all just-created records from the DB (`records_controller.ts`) | Low | Low–Medium | Composition creation (~8 queries per request in the load test blueprint) | Open |
| 6 | Quota: `('kv' \|\| '-' \|\| id) IN (...)` defeats the index on `id` — strip prefixes in JS and use `id = ANY($1::uuid[])` (`record_storage/psql/index.ts`). Also `getAccounteeIdForNode`'s recursive CTE has no fact-box filter (TODO already in code) | Low | Low (removes spikes) | Quota recomputation | Open |
| 7 | `refreshLatestState` rewrites *all* rows for a `(subject, predicate)` pair on every insert (dead tuples + index churn). Use targeted `UPDATE … SET latest=false WHERE … AND latest=true` + insert with `latest=true`, served by a partial index | Low–Medium | Low–Medium | Fact writes; less table bloat long-term | Open |
| 8 | Batch accountability-fact placement for compositions: compute the composition fact box once when `isNewUserScopedGraph`, pass it into `createAll`, batch-insert accountability facts, drop the `moveAllAccountabilityFactsToFactBox` UPDATE. Compositions connecting to existing graphs keep the sequential path, since later facts may rely on auth facts and placements written earlier in the same request | Medium | High | `createDocument` blueprint: 76 → 42 SQL queries per request (−45%) | **Done** |
| 9 | Lazy/batched WS subscriptions: every record a client loads subscribes to a change channel forever; `getSubscribedQueries` iterates the entire channel set on every fact save. Subscribe only when `.subscribe()` is called on a record; index `query-sub:` channels separately from record channels | Medium | Medium (grows with total live subscriptions) | Long-running clients, fact-write cost at scale | Open |
| 10 | Bound `AuthCache` / the in-process `cache` Map with LRU/TTL — currently unbounded growth, which makes `ENABLE_AUTH_RULE_CACHE` a slow memory leak in production | Low | — (robustness; unblocks enabling auth caching in prod) | Memory safety | Open |
| 11 | Migrate `CHAR(40)` columns to `TEXT` — blank-padding wastes index space, forces the `.trim()` calls throughout, and risks padding-semantics surprises against `TEXT` columns | Medium | Low–Medium | Index size, every query slightly | Open |
| 12 | Execute compound queries as one SQL statement: `resolveCompoundQueryToIds` currently runs one full query per group, each rebuilding the `auth_nodes`/`auth_facts` CTEs (a 9-group `fetchDocument` computes the user's auth scope 9 times). Emit a single statement with one shared CTE, or materialize the auth scope per request | High | High | All compound reads (~÷ group count on DB work) | Open — a draft existed (shared `auth_nodes`/`auth_facts` CTE + one `UNION ALL` branch per group, tagged `SELECT <i> AS grp, node`; predicate filter unioned over groups is safe because every clause refilters by its own predicate); changes were not retained and verification never completed |
| 13 | Replace the per-record `CREATE TABLE` for LongText records (`record_storage/psql_with_history`) with shared snapshot/change tables keyed by record id. DDL per create is expensive (catalog locks/bloat, autovacuum churn); thousands of tables also break the `information_schema` quota scan and vacuum/backup performance | High | High | Record creation, quota path, cluster health | Open |
| 14 | Pagination / result limits for queries: `findAll`-style queries return the *entire* matching set (`fetchDocuments` loads every visible document — values, readTokens, client-side record instantiation). For users with large partitions this linear result-set cost eventually dominates regardless of index tuning, and it is the remaining reason read latency grows with per-user data at all | High (API change) | High at scale (bounds the per-user growth axis) | Users with thousands of visible records; caps response size, marshalling, and JWT signing per request | Open |

## Load-test harness (wall clock only, chart semantics unchanged)

`specs.wdio/load/documents/documents.spec.ts`:

| # | Optimization | Effort | Effect |
|---|---|---|---|
| 1 | Track user2's document count locally instead of running the gate-check `fetchDocuments` every 10th iteration (~500 heavy unmeasured fetches, each loading up to 300 records) | Trivial | Medium |
| 2 | Keep created content IDs in a test-local array instead of `getRandomContentIds` re-querying all content every 20 iterations (~250 full-list fetches) | Trivial | Medium |
| 3 | Use a local document counter for the chart x-axis instead of `SELECT count(*)` before every `timeIt` (~7,000 queries) | Trivial | Low–Medium |
| 4 | Cache the three actor IDs once instead of a WebdriverIO round trip per operation | Trivial | Low–Medium |
| 5 | Stop at ~4,000 iterations — the chart's plateau is established by ~3,000 documents | Trivial | Medium (~20% of run) |
| 6 | Batch N operations per `executeAsync` call and time them in-browser with `performance.now()` — removes WebdriverIO round-trip overhead from wall time and from measurement noise | Medium | Medium |
| 7 | Time only every k-th create; bulk-create the filler documents in parallel batches (the chart needs the documents to exist, not 5,000 individual timings — averaging collapses to 20 buckets anyway) | Medium | High (2–4× wall clock) |

## Dependencies

- Server items 8 and 13 also shrink the load test's wall clock
  substantially, since ~5,000 `createDocument` calls dominate the run.
- Server items 12 and 14 are the only entries that change the *shape* of read
  scaling (per-request CTE recomputation and unbounded result sets);
  everything else is constant-factor.
- Full order-independent fact batching (beyond item 8's safe subset) would
  additionally require threading a "pending facts in this batch" context
  through `isAuthorizedToSave`/`isValidAccountabilityTransfer`, and resolving
  fact-box placement for a whole batch via connected components in memory.
  High effort; only worth it if the connecting-composition path shows up in
  profiles.
