# Known Issues

- Implicit auth for tests
- Exception Handler Middleware
- Allow to upload blobs (so editor.setFilePersistHandler can upload images)
- Allow to use synced KV Stores for reference management
- In ServerSideEvents implement a joinCluster method dispatch changes to other server instances so they can inform their clients
- When the session expires, redirect the user to the same path he was before the login flow. Currently the user just comes back to the main page.
- Attribute.get function should cache current values when changes has been applied via changeset
- Attribute.get function should use a distributed semaphore when processing a changeset for a given variable