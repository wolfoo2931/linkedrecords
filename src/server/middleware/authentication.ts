/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/dot-notation */
import { decodeJwt } from 'jose';
import * as EmailValidator from 'email-validator';
import { auth } from 'express-openid-connect';
import { auth as authBearer, JWTPayload } from 'express-oauth2-jwt-bearer';
import { uid, hashUserId } from '../controllers/userinfo_controller';
import Fact from '../../facts/server';
import getCookieSettingsFromEnv from '../../../lib/cookie-settings-from-env';
import IsLogger from '../../../lib/is_logger';

const userInfoEndpointCache = {};

type TokenCacheEntry = {
  userInfo: any;
  expiresAt: number;
};

const tokenCache: Record<string, TokenCacheEntry | undefined> = {};

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(tokenCache).forEach((token) => {
    const entry = tokenCache[token];
    if (entry && entry.expiresAt < now) {
      delete tokenCache[token];
    }
  });
}, 60 * 60 * 1000);

function assignWhenAuthenticatedFunction(req, res) {
  req.whenAuthenticated = async (fn) => {
    if (!req?.oidc?.user?.sub || !req.oidc.isAuthenticated()) {
      res.sendStatus(401);
    } else {
      req.hashedUserID = uid(req);
      await fn(uid(req));
    }
  };
}

// This is the user info endpoint provided by the OIDC provider not the
// linkedrecords user info endpoint
async function getUserInfoEndpoint(): Promise<string> {
  const issuerUrl = process.env['AUTH_ISSUER_BASE_URL']?.replace(/\/$/, '');

  if (!issuerUrl) {
    throw new Error('AUTH_ISSUER_BASE_URL needs to be defined');
  }

  if (userInfoEndpointCache[issuerUrl]) {
    return userInfoEndpointCache[issuerUrl];
  }

  const res = await fetch(`${issuerUrl}/.well-known/openid-configuration`);

  if (!res.ok) {
    throw new Error(`Failed to fetch OIDC configuration: ${res.status} ${res.statusText}`);
  }

  const config = await res.json();

  if (!config.userinfo_endpoint) {
    throw new Error('userinfo_endpoint not found in OIDC configuration');
  }

  userInfoEndpointCache[issuerUrl] = config.userinfo_endpoint;

  return config.userinfo_endpoint;
}

async function fetchUserInfo(accessToken: string): Promise<any> {
  const userinfoEndpoint = await getUserInfoEndpoint();

  const res = await fetch(userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function ensureUserIsInLocalDBAndVerified(
  userInfo: JWTPayload,
  logger: IsLogger,
) {
  const { email, email_verified, sub } = userInfo;

  if (email_verified === true
    && typeof email === 'string'
    && EmailValidator.validate(email)
    && typeof sub === 'string'
    && sub.trim()) {
    Fact.recordUserEmail(email, hashUserId(sub), logger);
    return true;
  }

  return false;
}

function confidentialClientAuthenticationMiddleware(req, res, next) {
  assignWhenAuthenticatedFunction(req, res);
  const cookieSettings = getCookieSettingsFromEnv();

  const authMiddleware = auth({
    baseURL: process.env['FRONTEND_BASE_URL'],
    issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
    clientID: process.env['AUTH_CLIENT_ID'],
    secret: process.env['AUTH_COOKIE_SIGNING_SECRET'],
    clientSecret: process.env['AUTH_CLIENT_SECRET'],
    errorOnRequiredAuth: true,
    enableTelemetry: false,
    idpLogout: process.env['AUTH_IDP_LOGOUT'] === 'true',
    afterCallback: async (_, __, session: any) => {
      const userInfo = decodeJwt(session.id_token);
      const isVerified = await ensureUserIsInLocalDBAndVerified(userInfo, req.log);

      if (isVerified !== true) {
        res.redirect('/?email-not-verified');
      }

      return session;
    },
    authorizationParams: {
      // We need offline_access because we do XHR call in the background
      // which can not be redirected for refreshing the token.
      scope: 'openid email offline_access profile',
      response_type: 'code',
      prompt: ['none', 'login', 'consent', 'select_account'].includes(req.query.prompt)
        ? req.query.prompt
        : undefined,
    },
    session: {
      cookie: cookieSettings,
    },
  });

  return authMiddleware(req, res, next);
}

async function httpAuthHeaderMiddleware(req, res, next) {
  const willExpireIn = (token, x) => {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp * 1000 < Date.now() + x * 1000;
  };

  assignWhenAuthenticatedFunction(req, res);

  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];
    const cachedToken = tokenCache[token];

    if (cachedToken) {
      if (!willExpireIn(token, 5)) {
        req.oidc = {
          user: {
            sub: cachedToken.userInfo.sub,
            picture: cachedToken.userInfo.picture,
            email: cachedToken.userInfo.email,
          },
          isAuthenticated: () => !!cachedToken.userInfo.sub?.trim(),
        };

        return next();
      }

      delete tokenCache[token];
    }
  }

  const authMiddleware = authBearer({
    issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
    audience: process.env['AUTH_TOKEN_AUDIENCE'],
  });

  return authMiddleware(req, res, async () => {
    if (!req.auth) {
      req.log.info('Request contained invalid access token in http authorization header.');
      return res.sendStatus(401);
    }

    const userInfo = await fetchUserInfo(req.auth.token);
    const isVerified = await ensureUserIsInLocalDBAndVerified(userInfo, req.log);

    if (isVerified !== true) {
      return res.redirect('/?email-not-verified');
    }

    const payload = JSON.parse(Buffer.from(req.auth.token.split('.')[1], 'base64').toString());

    tokenCache[req.auth.token] = {
      userInfo,
      expiresAt: payload.exp * 1000,
    };

    req.oidc = {
      user: {
        sub: userInfo.sub,
        picture: userInfo.picture,
        email: userInfo.email,
      },
      isAuthenticated: () => !!userInfo.sub?.trim(),
    };

    return next();
  });
}

export default function authentication() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (process.env['ALLOW_HTTP_AUTHENTICATION_HEADER'] === 'true' && authHeader) {
      return httpAuthHeaderMiddleware(req, res, next);
    }

    if (authHeader) {
      throw new Error('HTTP Authorization header authentication is not enabled. Set ALLOW_HTTP_AUTHENTICATION_HEADER=true to enable it.');
    }

    return confidentialClientAuthenticationMiddleware(req, res, next);
  };
}
