---
title: Authentication
layout: home
nav_order: 4
---

# Authentication

LinkedRecords uses OpenID Connect (OIDC) for authentication, which means you can use any OIDC provider like Auth0, Okta, Google, or your own identity server. This eliminates the need to implement login, password reset, or user management features in your application.

## Overview

LinkedRecords supports the Authorization Code flow with PKCE (Proof Key for Code Exchange) for secure authentication. The authentication process is handled automatically by the SDK, and you can focus on building your application's features.

## Setup

### 1. Configure Your OIDC Provider

First, you'll need to configure your OIDC provider. Here are examples for common providers:

#### Auth0 Configuration

1. Create an Auth0 application
2. Set the callback URL to: `https://your-linkedrecords-instance.com/auth/callback`
3. Enable the Authorization Code flow with PKCE

#### Okta Configuration

1. Create an Okta application
2. Set the redirect URI to: `https://your-linkedrecords-instance.com/auth/callback`
3. Enable the Authorization Code flow

### 2. Initialize LinkedRecords with OIDC

```javascript
// Initialize with OIDC configuration
const client = new LinkedRecords(
  new URL('https://your-linkedrecords-instance.com'),
  {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret', // Optional for public clients
    redirectUri: 'https://your-linkedrecords-instance.com/auth/callback',
    authority: 'https://your-auth0-domain.auth0.com', // Your OIDC provider URL
    scope: 'openid profile email'
  }
);

// Ensure user is authenticated
await client.ensureUserIdIsKnown();
```

### 3. Handle Login Flow

The SDK automatically handles the OIDC redirect flow:

```javascript
// The SDK will automatically detect if the user is on the callback URL
// and handle the authentication process
if (client.oidcManager) {
  // Handle redirect callback if needed
  await client.oidcManager.handleRedirectCallback();
}
```

## User Management

### Getting User Information

```javascript
// Get the current user's ID
const userId = await client.ensureUserIdIsKnown();

// Get user info by email
const userInfo = await client.getUserIdByEmail('user@example.com');
```

### User Sessions

LinkedRecords automatically manages user sessions:

```javascript
// Check if user is authenticated
const isAuthenticated = await client.ensureUserIdIsKnown();
if (isAuthenticated) {
  console.log('User is authenticated');
} else {
  console.log('User needs to login');
}
```

## Login and Logout

### Programmatic Login

```javascript
// Redirect user to login
if (client.oidcManager) {
  await client.oidcManager.signinRedirect();
}
```

### Logout

```javascript
// Logout the current user
if (client.oidcManager) {
  await client.oidcManager.signoutRedirect();
}
```

### Silent Authentication

```javascript
// Try to authenticate silently (without redirect)
try {
  await client.oidcManager.signinSilent();
} catch (error) {
  // Silent authentication failed, redirect to login
  await client.oidcManager.signinRedirect();
}
```

## Error Handling

### Handle Authentication Errors

```javascript
// Set up error handlers
client.unknownServerErrorHandler = (response) => {
  console.error('Server error:', response);
};

client.quotaViolationErrorHandler = (response) => {
  console.error('Quota violation:', response);
};
```

### Handle Connection Issues

```javascript
client.connectionLostHandler = (err) => {
  console.error('Connection lost:', err);
  // Implement reconnection logic
};
```

## Security Best Practices

### 1. Use HTTPS

Always use HTTPS in production to secure authentication tokens:

```javascript
const client = new LinkedRecords(
  new URL('https://your-linkedrecords-instance.com'), // Use HTTPS
  oidcConfig
);
```

### 2. Secure Token Storage

The SDK automatically handles secure token storage, but ensure your application follows security best practices:

```javascript
// Don't store tokens in localStorage or sessionStorage
// The SDK handles this securely
```

### 3. Validate Redirect URIs

Always validate redirect URIs in your OIDC provider configuration:

```javascript
// In your OIDC provider settings
const allowedRedirectUris = [
  'https://your-app.com/auth/callback',
  'https://your-app.com/silent-renew'
];
```

### 4. Handle Token Expiration

The SDK automatically handles token refresh, but you can set up handlers:

```javascript
client.loginHandler = () => {
  // Handle successful login
  console.log('User logged in successfully');
};
```

## Integration Examples

### React Application

```jsx
import { useEffect, useState } from 'react';
import LinkedRecords from 'linkedrecords/browser_sdk';

function App() {
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initClient = async () => {
      const lrClient = new LinkedRecords(
        new URL('https://your-linkedrecords-instance.com'),
        {
          clientId: 'your-client-id',
          redirectUri: 'https://your-app.com/auth/callback',
          authority: 'https://your-auth0-domain.auth0.com'
        }
      );

      try {
        await lrClient.ensureUserIdIsKnown();
        setClient(lrClient);
        setUser(await lrClient.ensureUserIdIsKnown());
      } catch (error) {
        console.error('Authentication failed:', error);
      }
    };

    initClient();
  }, []);

  const login = async () => {
    if (client?.oidcManager) {
      await client.oidcManager.signinRedirect();
    }
  };

  const logout = async () => {
    if (client?.oidcManager) {
      await client.oidcManager.signoutRedirect();
    }
  };

  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}
```

### Vue.js Application

```vue
<template>
  <div>
    <div v-if="user">
      <p>Welcome, {{ user }}!</p>
      <button @click="logout">Logout</button>
    </div>
    <button v-else @click="login">Login</button>
  </div>
</template>

<script>
import LinkedRecords from 'linkedrecords/browser_sdk';

export default {
  data() {
    return {
      client: null,
      user: null
    };
  },
  async mounted() {
    await this.initClient();
  },
  methods: {
    async initClient() {
      this.client = new LinkedRecords(
        new URL('https://your-linkedrecords-instance.com'),
        {
          clientId: 'your-client-id',
          redirectUri: 'https://your-app.com/auth/callback',
          authority: 'https://your-auth0-domain.auth0.com'
        }
      );

      try {
        await this.client.ensureUserIdIsKnown();
        this.user = await this.client.ensureUserIdIsKnown();
      } catch (error) {
        console.error('Authentication failed:', error);
      }
    },
    async login() {
      if (this.client?.oidcManager) {
        await this.client.oidcManager.signinRedirect();
      }
    },
    async logout() {
      if (this.client?.oidcManager) {
        await this.client.oidcManager.signoutRedirect();
      }
    }
  }
};
</script>
```

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Ensure the redirect URI in your OIDC provider matches exactly
   - Check for trailing slashes and protocol differences

2. **CORS Issues**
   - Ensure your OIDC provider allows requests from your domain
   - Check that your LinkedRecords instance is properly configured

3. **Token Expiration**
   - The SDK should handle token refresh automatically
   - Check your OIDC provider's token expiration settings

4. **Silent Authentication Fails**
   - This is normal for first-time users
   - Implement a fallback to redirect-based authentication

### Debug Mode

Enable debug logging to troubleshoot authentication issues:

```javascript
// Enable debug mode (if supported by your OIDC provider)
const client = new LinkedRecords(
  new URL('https://your-linkedrecords-instance.com'),
  {
    ...oidcConfig,
    debug: true
  }
);
```

## Next Steps

- [Authorization](authorization.md) - Learn how to control access to data
- [Attributes](attributes.md) - Start creating and managing data
- [Facts](facts.md) - Create relationships between your data
