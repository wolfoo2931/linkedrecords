# Known Issues

- In ServerSideEvents implement a joinCluster method dispatch changes to other server instances so they can inform their clients
- Attribute.get function should cache current values when changes has been applied via changeset
- Attribute.get function should use a distributed semaphore when processing a changeset for a given variable
