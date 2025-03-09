# LinkedRecords

LinkedRecords is a NoSQL database you can connect to directly from your single page application. You do not have to write any backend code.

- You can use any OpenID Connect provider for authentication. You don't have to implement login,
  password reset, etc. For now, automated tests run against Auth0. Other providers should work as well.
- A flexible authorization model is build into LinkedRecords.
- It allows you to build apps with real time collaboration. Under the hood it uses a simple
  Conflict-free replicated data type (CRDT) for key-value documents and operational transformation (OT)
  for large text.

Developer documentation follows. Curious readers can check out the specs.wdio/tinytodo directory for a simple usage example.

# Configuration

LinkedRecords is configured via environment variables. See table below.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| PGHOST | localhost | The hostname of the PostgreSQL server. |
| PGUSER | linkedrecords | The PostgreSQL user name. |
| PGPASSWORD | xxxx | The PostgreSQL password. |
| PGDATABASE | xxxx | The PostgreSQL database name. |
| SERVER_BASE_URL | http://localhost:6543 | The public URL of the linkedrecords server. |
| FRONTEND_BASE_URL | http://localhost:3001 | The base URL of the frontend. It will be used for the Access-Control-Allow-Origin HTTP header and is also required for the OpenID connect redirection. |
| CORS_ORIGIN | ["https://app.example.com", "https://app.example.app"] | The content of the cors origin header. If not provided the value of FRONTEND_BASE_URL will be used. |
| AUTH_COOKIE_SIGNING_SECRET | xxxx | The secret used to sign cookies. |
| AUTH_ISSUER_BASE_URL | https://xxx.us.auth0.com/ | The URL of the OIDC issuer. Can be any OpenID connect comply identity provider (e.g. Auth0, Okta). |
| AUTH_CLIENT_ID |  | The client id. Can be obtained from the identity provider. |
| AUTH_CLIENT_SECRET |  | The client secret. Can be obtained from the identity provider. |
| AUTH_IDP_LOGOUT | true | When set to true the user session will be destroyed in the application AND the within the identity provider. |
| DEFAULT_STORAGE_SIZE_QUOTA | 50 | The default storage size quota in MB. |
