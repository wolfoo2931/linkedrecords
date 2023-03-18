# LinkedRecords

# Configuration

LinkedRecords is configured via environment variables. See table below.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| PGHOST | localhost | The hostname of the PostgreSQL server. |
| PGUSER | linkedrecords | The PostgreSQL user name. |
| PGPASSWORD | xxxx | The PostgreSQL password. |
| PGDATABASE | xxxx | The PostgreSQL database name. |
| HTTPS | true | Whether the server should be started with TLS certificates for HTTPS encryption. If this is true, you have to provide SSL_KEY and SSL_CRT. HTTPS is required for local development because of the way how cookies are used. Setting this to false only makes sense if you run LinkedRecords behind a reverse proxy that terminates the TLS certificates for you. |
| SSL_KEY | xxxx | The private key used for https termination. |
| SSL_CRT | xxxx | The public key used for https termination. |
| COOKIE_DOMAIN | localhost.com | The domain for which the cookies should be set. If your single-page application is available via "app.localhost.com" and the LinkedRecords endpoint is available via "api.localhost.com", you have to set this value to "localhost.com".|
| AUTH_COOKIE_SIGNING_SECRET | xxxx | The secret used to sign cookies. |
| APP_BASE_URL | https://app.localhost.com:3001 | The base URL of the frontend. It will be used for the Access-Control-Allow-Origin HTTP header and is also required for the OpenID connect redirections. |
| AUTH_ISSUER_BASE_URL | https://dev-onljhxvyw71o4mbs.us.auth0.com/ | The URL of the OIDC issuer. Can be any OpenID connect comply identity provider (e.g. Auth0, Okta). |
| AUTH_CLIENT_ID |  | The client id. Can be obtained from the identity provider. |
| AUTH_CLIENT_SECRET |  | The client secret. Can be obtained from the identity provider. |


## Next Improvement
- Exception Handler Middleware
- Implicit auth for tests
- Attribute.get function should cache current values when changes has been applied via changeset
- Attribute.get function should use a distributed semaphore when processing a changeset for a given variable
- When the session expires, redirect the user to the same path he was before the login flow. Currently the user just comes back to the main page
- In ServerSideEvents implement a joinCluster method dispatch changes to other server instances so they can inform their clients