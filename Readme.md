# LinkedRecords

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
| AUTH_COOKIE_SIGNING_SECRET | xxxx | The secret used to sign cookies. |
| AUTH_ISSUER_BASE_URL | https://dev-onljhxvyw71o4mbs.us.auth0.com/ | The URL of the OIDC issuer. Can be any OpenID connect comply identity provider (e.g. Auth0, Okta). |
| AUTH_CLIENT_ID |  | The client id. Can be obtained from the identity provider. |
| AUTH_CLIENT_SECRET |  | The client secret. Can be obtained from the identity provider. |
| DEFAULT_STORAGE_SIZE_QUOTA | 50 | The default storage size quota in MB. |


## Start Postgres Database

```
docker run --name linkedrecords-db -e POSTGRES_PASSWORD=lrdbpass -p 5432:5432 -d postgres
```

# FAQ

## You use PostgreSQL as a triblestore, will it scale?

If you do not use joins you do NO SQL.
