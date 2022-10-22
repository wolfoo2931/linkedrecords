# Known Issues & TODOs
## MVP
- Authorization

## Next Improvement
- Allow to upload blobs (so editor.setFilePersistHandler can upload images)
- Exception Handler Middleware
- Connection handler in AbstractAttributeClient
- Implicit auth for tests
- Attribute.get function should cache current values when changes has been applied via changeset
- Attribute.get function should use a distributed semaphore when processing a changeset for a given variable
- When the session expires, redirect the user to the same path he was before the login flow. Currently the user just comes back to the main page.
- In ServerSideEvents implement a joinCluster method dispatch changes to other server instances so they can inform their clients


-> All documents

User
Team
Document

documents can be read by users
dcouments can be modfied by users
user can be part of a team

