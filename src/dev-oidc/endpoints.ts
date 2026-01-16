import { Request, Response } from 'express';
import * as jose from 'jose';
import * as crypto from 'crypto';
import {
  DEV_USERS, getIssuerUrl, getAudience, TOKEN_EXPIRY, CODE_EXPIRY,
} from './config';
import { getPrivateKey, getJWKS, getKeyId } from './keys';
import { generateLoginPage } from './login-page';

interface CustomUser {
  sub: string;
  email: string;
  name: string;
}

interface PendingAuthorization {
  userId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  customUser?: CustomUser;
}

const pendingAuthorizations = new Map<string, PendingAuthorization>();

// Cleanup expired codes periodically
setInterval(() => {
  const now = Date.now();
  Array.from(pendingAuthorizations.entries()).forEach(([code, auth]) => {
    if (auth.expiresAt < now) {
      pendingAuthorizations.delete(code);
    }
  });
}, 60 * 1000);

export function discoveryHandler(_req: Request, res: Response): void {
  const issuer = getIssuerUrl();

  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['none'],
    claims_supported: ['sub', 'email', 'email_verified', 'name', 'picture'],
    code_challenge_methods_supported: ['S256', 'plain'],
  });
}

export function jwksHandler(_req: Request, res: Response): void {
  res.json(getJWKS());
}

export function authorizeGetHandler(req: Request, res: Response): void {
  const {
    redirect_uri: redirectUri = '',
    state = '',
    nonce = '',
    code_challenge: codeChallenge = '',
    code_challenge_method: codeChallengeMethod = 'plain',
  } = req.query as Record<string, string>;

  const html = generateLoginPage(
    DEV_USERS,
    redirectUri,
    state,
    nonce,
    codeChallenge,
    codeChallengeMethod,
  );

  res.type('html').send(html);
}

export function authorizePostHandler(req: Request, res: Response): void {
  const {
    user_id: userId,
    custom_email: customEmail,
    redirect_uri: redirectUri,
    state = '',
    nonce = '',
    code_challenge: codeChallenge = '',
    code_challenge_method: codeChallengeMethod = 'plain',
  } = req.body;

  if (!redirectUri) {
    res.status(400).json({ error: 'missing_parameters', error_description: 'redirect_uri is required' });
    return;
  }

  if (!userId && !customEmail) {
    res.status(400).json({ error: 'missing_parameters', error_description: 'user_id or custom_email is required' });
    return;
  }

  let customUser: CustomUser | undefined;
  let finalUserId: string;

  if (customEmail) {
    // Create a custom user from the email
    const emailHash = crypto.createHash('md5').update(customEmail.toLowerCase()).digest('hex');
    finalUserId = `custom-${emailHash}`;
    const namePart = customEmail.split('@')[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    customUser = {
      sub: finalUserId,
      email: customEmail,
      name,
    };
  } else {
    const user = DEV_USERS.find((u) => u.sub === userId);
    if (!user) {
      res.status(400).json({ error: 'invalid_user', error_description: 'User not found' });
      return;
    }
    finalUserId = userId;
  }

  const code = crypto.randomBytes(32).toString('hex');

  pendingAuthorizations.set(code, {
    userId: finalUserId,
    redirectUri,
    state,
    nonce,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: Date.now() + CODE_EXPIRY,
    customUser,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  res.redirect(redirectUrl.toString());
}

export async function tokenHandler(req: Request, res: Response): Promise<void> {
  const {
    code,
    code_verifier: codeVerifier,
    grant_type: grantType,
  } = req.body;

  if (grantType !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
    return;
  }

  const auth = pendingAuthorizations.get(code);
  if (!auth) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired code' });
    return;
  }

  // Delete code immediately (single-use)
  pendingAuthorizations.delete(code);

  // Check if code expired
  if (auth.expiresAt < Date.now()) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' });
    return;
  }

  // Verify PKCE if code_challenge was provided
  if (auth.codeChallenge) {
    if (!codeVerifier) {
      res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier is required' });
      return;
    }

    let computedChallenge: string;
    if (auth.codeChallengeMethod === 'S256') {
      computedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    } else {
      computedChallenge = codeVerifier;
    }

    if (computedChallenge !== auth.codeChallenge) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' });
      return;
    }
  }

  // Get user from predefined list or custom user stored in authorization
  const predefinedUser = DEV_USERS.find((u) => u.sub === auth.userId);
  const user = auth.customUser || predefinedUser;

  if (!user) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
    return;
  }

  const issuer = getIssuerUrl();
  const audience = getAudience();
  const now = Math.floor(Date.now() / 1000);

  const idTokenPayload: jose.JWTPayload = {
    iss: issuer,
    sub: user.sub,
    aud: audience,
    exp: now + TOKEN_EXPIRY,
    iat: now,
    email: user.email,
    email_verified: true,
    name: user.name,
  };

  if (auth.nonce) {
    idTokenPayload['nonce'] = auth.nonce;
  }

  if ('picture' in user && user.picture) {
    idTokenPayload['picture'] = user.picture;
  }

  const privateKey = getPrivateKey();

  const idToken = await new jose.SignJWT(idTokenPayload)
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .sign(privateKey);

  // Access token with same claims for simplicity
  const accessToken = await new jose.SignJWT({
    iss: issuer,
    sub: user.sub,
    aud: audience,
    exp: now + TOKEN_EXPIRY,
    iat: now,
    email: user.email,
    email_verified: true,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .sign(privateKey);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_EXPIRY,
    id_token: idToken,
  });
}

export function userinfoHandler(req: Request, res: Response): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Decode without verification (userinfo endpoint trusts the token since it was issued by us)
    const payload = jose.decodeJwt(token);

    if (!payload.sub || !payload['email']) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    // Use claims directly from token - works for both predefined and custom users
    const response: Record<string, unknown> = {
      sub: payload.sub,
      email: payload['email'],
      email_verified: true,
      name: payload['name'] || payload['email'],
    };

    if (payload['picture']) {
      response['picture'] = payload['picture'];
    }

    res.json(response);
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
