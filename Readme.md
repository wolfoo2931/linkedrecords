# LinkedRecords

LinkedRecords is a NoSQL database you can connect to directly from your single page application. You do not have to write any backend code.

- You can use any OpenID Connect provider for authentication. You don't have to implement login,
  password reset, etc. For now, automated tests run against Auth0. Other providers should work as well.
- A flexible authorization model is build into LinkedRecords.
- It allows you to build apps with real time collaboration. Under the hood it uses a simple
  Conflict-free replicated data type (CRDT) for key-value documents and operational transformation (OT)
  for large text.

Developer documentation follows. Curious readers can check out the specs.wdio/tinytodo directory for a simple usage example.

# Concept

You can think of LinkedRecords as a bucket in which anybody can sign up and write data into it.
As long as you do not share this data with other users or groups, only you can access the data you have written to the bucket.

In theory every user can use the LinkedRecords API to write and retrieve data. But this would be quite inconvenient to a user - the same way you would
not expect your user to write SQL queries you would not expect your users to use the LinkedRecords API. A LinkedRecords app is a specialized
frontend which hides the LinkedRecords API from the user and provides them a convenient user interface to accomplish their use cases.

In the traditional SQL world, inconvenience is not the only reason why you do not let the user access your database with SQL: Authentication and
Authorization challenges are by far the stronger argument not to do this. This is not a problem within LinkedRecords as authorization is built into
the LinkedRecords API.

When it comes to the LinkedRecords API - simplicity, flexibility and a decoupled architecture are the main qualities we strive to achieve.

- Simplicity: The API should not have many endpoints or methods but instead consists of a few fundamental building blocks.
- Flexibility: The few available endpoints can be composed to serve a variety of use cases.
- Decoupled: LinkedRecords should be decoupled from the single page applications which use it as data storage

Think of it as SQL you can call directly from your React app without worrying about permissions; it is easier to read than SQL and provides live updates.

# Configuration

LinkedRecords is configured via environment variables. See tables below.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| PGHOST | localhost | The hostname of the PostgreSQL server. |
| PGUSER | linkedrecords | The PostgreSQL user name. |
| PGPASSWORD | xxxx | The PostgreSQL password. |
| PGDATABASE | xxxx | The PostgreSQL database name. |
| CORS_ORIGIN | ["https://app.example.com", "https://app.example.app"] | The content of the cors origin header. If not provided, the value of FRONTEND_BASE_URL will be used. |
| SERVER_BASE_URL | http://localhost:6543 | The public URL of the linkedrecords server. |
| DEFAULT_STORAGE_SIZE_QUOTA | 50 | The default storage size quota in MB. |
| QUOTA_COUNT_KV_ATTRIBUTES | false | If the storage space for KeyValue attributes are deducted from the accountee quota. |
| QUOTA_COUNT_LT_ATTRIBUTES | false | If the storage space for LongText attributes are deducted from the accountee quota. |
| ENABLE_AUTH_RULE_CACHE | false | Enable cache for authorization lookups. Might require a lot of memory. |
| SHORT_LIVED_ACCESS_TOKEN_SIGNING | xxxx | Configuring this is optional but can reduce load on the database because short lived access token will be used for checking access when a client subscribes to attribute changes. |

## Confidential Client Mode

The environment variables in this section are all optional if the configuration described in the section "Public Client Mode" are provided.

If LinkedRecords runs in confidential client mode, then a session token will be stored in an HttpOnly cookie. From a security standpoint
this is considered the suggested method. However, this is not possible if the LinkedRecord server and the frontend do not share the same domain.
Across different domains the cookie becomes a third-party cookie, so this mode cannot be used.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| FRONTEND_BASE_URL | http://localhost:3001 | The base URL of the frontend. It will be used for the Access-Control-Allow-Origin HTTP header and is also required for the OpenID connect redirection. |
| AUTH_ISSUER_BASE_URL | https://xxx.us.auth0.com/ | The URL of the OIDC issuer. Can be any OpenID Connect compliant identity provider (e.g. Auth0, Okta). |
| AUTH_CLIENT_ID |  | The client id. Can be obtained from the identity provider. |
| AUTH_CLIENT_SECRET |  | The client secret. Can be obtained from the identity provider. |
| AUTH_IDP_LOGOUT | true | When set to true the user session will be destroyed in the application AND the within the identity provider. |
| AUTH_COOKIE_SIGNING_SECRET | xxxx | The secret used to sign cookies. |

## Public Client Mode

In case the single page application is hosted on a different domain then the LinkedRecords server, the single page application has
to store the access token in the browser. In this scenario the following environment variables need to be configured.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| ALLOW_HTTP_AUTHENTICATION_HEADER | true | Allows public clients to make requests providing an access token via http authentication header. |
| AUTH_ISSUER_BASE_URL | https://xxx.us.auth0.com/ | The URL of the OIDC issuer. Can be any OpenID Connect compliant identity provider (e.g. Auth0, Okta). |
| AUTH_TOKEN_AUDIENCE | your-audience-id | LinkedRecords will check the audience specified in the JWT bearer token against the value specified in this field. |

The single page application needs to initialize the LinkedRecords SDK as shown below:

```js
import LinkedRecords from './src/browser_sdk';

const oidcConfig = {
  client_id: 'your-client-id',
  redirect_uri: window.location.origin + '/callback',
};

// Instantiating LinkedRecords will automatically handle the OIDC redirect callback
const lr = new LinkedRecords(new URL('https://your-backend.com'), oidcConfig);

// To check if the user is authenticated:
// const isAuth = await lr.isAuthenticated();

// To start login flow (e.g., on a button click):
// lr.login();
```

## Optional Configuration

### S3

If S3 is configured it will be used to store blob attribute values. If it is not configured they will be stored in PostgreSQL database.
It is recommended to configure S3.

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| S3_COPY_FROM_BL_ATTRIBUTE_TABLE | false | This is used for migration blob storage from postgresql to S3. |
| S3_ENDPOINT | s3.system.svc.cluster.local | The hostname of the S3 endpoint. |
| S3_BUCKET | linkedrecords-blobs | The name of a bucket. The bucket must exist already. |
| S3_ACCESS_KEY | xxx | The access key id to upload blobs to S3. |
| S3_SECRET_KEY | xxx | The secret key id to upload blobs to S3. |
| S3_USE_SSL | false | Do not use TLS when uploading/downloading to S3. |

### Paddle

| Environment Variable Name | Example | Description |
| ------------------------- | ------- | ----------- |
| PADDLE_NOTIFICATION_SECRET | xxxx | If paddle is used for upgrading quotas this needs to be the notification secret to verify the signature of the webhook content. |
| PADDLE_API_URL | https://sandbox-api.paddle.com | The URL of the paddle api. |
| PADDLE_API_KEY | xxx | the paddle API key. |
