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

const cookieSettings = getCookieSettingsFromEnv();
const tokenCache = {};
const userInfoCache = {};

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

async function getUserInfoEndpoint(): Promise<string> {
  const issuerUrl = process.env['AUTH_ISSUER_BASE_URL'];

  if (!issuerUrl) {
    throw new Error('AUTH_ISSUER_BASE_URL needs to be defined');
  }

  if (userInfoCache[issuerUrl]) {
    return userInfoCache[issuerUrl];
  }

  const res = await fetch(`${process.env['AUTH_ISSUER_BASE_URL']}.well-known/openid-configuration`);

  if (!res.ok) {
    throw new Error('Failed to fetch OIDC configuration');
  }

  const config = await res.json();

  if (!config.userinfo_endpoint) {
    throw new Error('userinfo_endpoint not found in OIDC configuration');
  }

  userInfoCache[issuerUrl] = config.userinfo_endpoint;

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
    throw new Error('Failed to fetch user info');
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

function dummyUserAuthenticationMiddleware(req, res, next) {
  const toBeUser = req?.cookies?.pretendToBeUser;

  if (!['testuser-1-id', 'testuser-2-id', 'testuser-unauthorized-id'].includes(toBeUser)) {
    res.sendStatus(401);
    req.log.info(`${toBeUser} is not in the allowed test user whitelist. This is probably a configuration issue. ${req.method} ${req.path}`);
    return;
  }

  Fact.recordUserEmail(`${toBeUser}@example.com`, hashUserId(toBeUser), req.log);

  assignWhenAuthenticatedFunction(req, res);

  req.oidc = {
    user: { sub: toBeUser },
    isAuthenticated: () => true,
  };

  next();
}

function confidentialClientAuthenticationMiddleware(req, res, next) {
  assignWhenAuthenticatedFunction(req, res);

  const authMiddleware = auth({
    baseURL: process.env['FRONTEND_BASE_URL'],
    issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
    clientID: process.env['AUTH_CLIENT_ID'],
    secret: process.env['AUTH_COOKIE_SIGNING_SECRET'],
    clientSecret: process.env['AUTH_CLIENT_SECRET'],
    errorOnRequiredAuth: true,
    enableTelemetry: false,
    idpLogout: process.env['AUTH_IDP_LOGOUT'] === 'true',
    afterCallback: (_, __, session: any) => {
      const userInfo = decodeJwt(session.id_token);
      const isVerified = ensureUserIsInLocalDBAndVerified(userInfo, req.log);

      if (!isVerified) {
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
    const userInfo = tokenCache[token];

    if (userInfo) {
      if (!willExpireIn(token, 60)) {
        req.oidc = {
          user: {
            sub: userInfo.sub,
            picture: userInfo.picture,
          },
          isAuthenticated: () => !!userInfo.sub?.trim(),
        };

        return next();
      }

      tokenCache[token] = undefined;
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
    const isVerified = ensureUserIsInLocalDBAndVerified(userInfo, req.log);

    if (!isVerified) {
      return res.redirect('/?email-not-verified');
    }

    tokenCache[req.auth.token] = userInfo;

    req.oidc = {
      user: {
        sub: userInfo.sub,
        picture: userInfo.picture,
      },
      isAuthenticated: () => !!userInfo.sub?.trim(),
    };

    return next();
  });
}

export default function authentication() {
  if (process.env['DISABLE_AUTHENTICATION'] === 'true') {
    return dummyUserAuthenticationMiddleware;
  }

  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (process.env['ALLOW_HTTP_AUTHENTICATION_HEADER'] === 'true' && authHeader) {
      return httpAuthHeaderMiddleware(req, res, next);
    }

    if (authHeader) {
      throw new Error('HTTP authorization header is not activated');
    }

    return confidentialClientAuthenticationMiddleware(req, res, next);
  };
}
