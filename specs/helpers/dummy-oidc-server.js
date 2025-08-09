const express = require('express');
const { SignJWT, jwtVerify, importSPKI, generateKeyPair } = require('jose');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3002;
const ISSUER = `http://localhost:${PORT}`;
const CLIENT_ID = 'test-client';

const users = {
  'testuser-1-id': { id: 'testuser-1-id', email: 'testuser-1@example.com', name: 'Test User 1' },
  'testuser-2-id': { id: 'testuser-2-id', email: 'testuser-2@example.com', name: 'Test User 2' },
  'testuser-unauthorized-id': { id: 'testuser-unauthorized-id', email: 'testuser-unauthorized@example.com', name: 'Unauthorized User' },
};

// Generate RSA key pair for asymmetric signing
let privateKey, publicKey, jwks;

async function generateKeys() {
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;

  const exportedPublicKey = await importSPKI(await publicKey.export({ type: 'spki', format: 'pem' }), 'RS256');
  const jwk = await exportedPublicKey.export({ format: 'jwk' });

  jwks = {
    keys: [Object.assign({}, jwk, {
      kid: 'test-key-id',
      use: 'sig',
      alg: 'RS256'
    })]
  };
};

const keysPromise = generateKeys().catch(console.error);

app.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    jwks_uri: `${ISSUER}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    claims_supported: ['sub', 'email', 'email_verified', 'name'],
  });
});

app.post('/token', async (req, res) => {
  const { user_id: userId } = req.body;

  await keysPromise;

  const user = users[userId];
  if (!user) {
    return res.status(401).json({ error: 'invalid_user' });
  }

  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    sub: userId,
    email: user.email,
    email_verified: true,
    aud: 'localhost:3000',
    iss: ISSUER,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuedAt()
    .setExpirationTime(now + 3600) // 1 hour
    .sign(privateKey);

  const idToken = await new SignJWT({
    sub: userId,
    email: user.email,
    email_verified: true,
    aud: CLIENT_ID,
    iss: ISSUER,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuedAt()
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'openid profile email',
  });
});

app.get('/userinfo', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, publicKey);
    const userId = payload.sub;
    const user = users[userId];

    if (!user) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    res.json({
      sub: userId,
      email: user.email,
      email_verified: true,
      name: user.name,
    });
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'invalid_token' });
  }
});

app.get('/jwks', async (req, res) => {
  await keysPromise;

  res.json(jwks);
});

app.listen(PORT, () => {
  console.log(`Dummy OIDC server running on http://localhost:${PORT}`);
});

module.exports = app;
