---
title: Installation and Setup
layout: home
nav_order: 6
---

# Installation and Setup

This guide will help you get started with LinkedRecords, whether you're using it as a hosted service or setting up your own instance.

## Quick Start

### Using the Browser SDK

The fastest way to get started is to include the LinkedRecords SDK in your web application:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My LinkedRecords App</title>
</head>
<body>
    <div id="app">
        <h1>Welcome to LinkedRecords</h1>
        <button id="login">Login</button>
        <div id="content"></div>
    </div>

    <script src="https://unpkg.com/linkedrecords@latest/dist/browser_sdk.js"></script>
    <script>
        // Initialize LinkedRecords
        const client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));

        // Handle login
        document.getElementById('login').addEventListener('click', async () => {
            try {
                await client.ensureUserIdIsKnown();
                document.getElementById('content').innerHTML = '<p>Logged in successfully!</p>';
            } catch (error) {
                console.error('Login failed:', error);
            }
        });
    </script>
</body>
</html>
```

### Using npm/yarn

For more control and better development experience, install via npm:

```bash
npm install linkedrecords
```

Then import and use in your application:

```javascript
import LinkedRecords from 'linkedrecords/browser_sdk';

const client = new LinkedRecords(new URL('https://your-linkedrecords-instance.com'));
await client.ensureUserIdIsKnown();
```

## Setting Up Your Own Instance

### Prerequisites

To run your own LinkedRecords instance, you'll need:

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- An OpenID Connect provider (Auth0, Okta, etc.)

### 1. Clone the Repository

```bash
git clone https://github.com/wolfoo2931/linkedrecords.git
cd linkedrecords
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/linkedrecords
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# OIDC Configuration
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=https://your-auth0-domain.auth0.com
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback

# Storage Configuration (optional)
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
S3_BUCKET=your-s3-bucket
S3_REGION=us-east-1

# Logging
LOG_LEVEL=info
```

### 3. Database Setup

#### PostgreSQL Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE linkedrecords;
CREATE USER linkedrecords_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE linkedrecords TO linkedrecords_user;
```

2. Run database migrations:

```bash
npm run migrate
```

#### Redis Setup

1. Install Redis (if not already installed):

```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Windows
# Download from https://redis.io/download
```

2. Start Redis:

```bash
redis-server
```

### 4. OIDC Provider Setup

#### Auth0 Configuration

1. Create an Auth0 application
2. Set the callback URL to: `http://localhost:3000/auth/callback`
3. Enable the Authorization Code flow with PKCE
4. Copy the Client ID and Client Secret to your `.env` file

#### Okta Configuration

1. Create an Okta application
2. Set the redirect URI to: `http://localhost:3000/auth/callback`
3. Enable the Authorization Code flow
4. Copy the Client ID and Client Secret to your `.env` file

### 5. Start the Server

```bash
npm start
```

The server will be available at `http://localhost:3000`.

## Development Setup

### Running Tests

```bash
# Run unit tests
npm test

# Run integration tests
npm run wdio

# Run load tests
npm run wdio:load
```

### Building

```bash
# Build the project
npm run build

# Watch for changes during development
npm run build -- --watch
```

### Linting

```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

## Production Deployment

### Docker Deployment

LinkedRecords includes a Dockerfile for containerized deployment:

```bash
# Build the Docker image
docker build -t linkedrecords .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e OIDC_CLIENT_ID=your-client-id \
  -e OIDC_CLIENT_SECRET=your-client-secret \
  -e OIDC_ISSUER=https://your-auth0-domain.auth0.com \
  linkedrecords
```

### Environment Variables for Production

```env
# Production settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (use connection pooling in production)
DATABASE_URL=postgresql://user:pass@host:5432/linkedrecords?pool=20

# Redis (use Redis Cluster for high availability)
REDIS_URL=redis://host:6379

# OIDC (use production OIDC provider)
OIDC_CLIENT_ID=your-production-client-id
OIDC_CLIENT_SECRET=your-production-client-secret
OIDC_ISSUER=https://your-production-auth0-domain.auth0.com
OIDC_REDIRECT_URI=https://your-domain.com/auth/callback

# Security
SESSION_SECRET=your-session-secret
CORS_ORIGIN=https://your-frontend-domain.com

# Monitoring
LOG_LEVEL=warn
```

### Reverse Proxy Setup

For production, use a reverse proxy like nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Configuration Options

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `localhost` | Server host |
| `NODE_ENV` | `development` | Environment mode |

### Database Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |

### OIDC Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_CLIENT_ID` | Yes | OIDC client identifier |
| `OIDC_CLIENT_SECRET` | Yes | OIDC client secret |
| `OIDC_ISSUER` | Yes | OIDC provider URL |
| `OIDC_REDIRECT_URI` | Yes | OAuth callback URL |

### Storage Configuration

| Variable | Optional | Description |
|----------|----------|-------------|
| `S3_ACCESS_KEY_ID` | Yes | AWS S3 access key |
| `S3_SECRET_ACCESS_KEY` | Yes | AWS S3 secret key |
| `S3_BUCKET` | Yes | S3 bucket name |
| `S3_REGION` | Yes | S3 region |

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check your `DATABASE_URL` format
   - Ensure PostgreSQL is running
   - Verify database credentials

2. **Redis Connection Failed**
   - Check your `REDIS_URL` format
   - Ensure Redis is running
   - Verify Redis configuration

3. **OIDC Authentication Failed**
   - Verify OIDC provider configuration
   - Check redirect URI matches exactly
   - Ensure client ID and secret are correct

4. **Port Already in Use**
   - Change the `PORT` environment variable
   - Check for other services using the port

### Debug Mode

Enable debug logging for troubleshooting:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Check

Check if your instance is running properly:

```bash
curl http://localhost:3000/health
```

## Next Steps

- [Authentication](authentication.md) - Configure OpenID Connect authentication
- [Attributes](attributes.md) - Start creating and managing data
- [Facts](facts.md) - Create relationships between your data
- [Authorization](authorization.md) - Set up permissions and access control
