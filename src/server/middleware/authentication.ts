/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/dot-notation */
import { decodeJwt } from 'jose';
import * as EmailValidator from 'email-validator';
import { uid, hashUserId } from '../controllers/userinfo_controller';
import Fact from '../../facts/server';

const { auth } = require('express-openid-connect');

function biggestCommonSuffix(str1, str2) {
  let i = str1.length - 1;
  let j = str2.length - 1;

  while (i >= 0 && j >= 0 && str1[i] === str2[j]) {
    i -= 1;
    j -= 1;
  }

  return str1.substring(i + 1);
}

function getCookieSettings(frontendURL: string, backendURL: string) {
  const frontend = new URL(frontendURL);
  const backend = new URL(backendURL);
  const backendHost = backend.host.replace(/:\d*$/, '');
  const frontendHost = frontend.host.replace(/:\d*$/, '');

  let commonHostSuffix = biggestCommonSuffix(
    backendHost,
    frontendHost,
  );

  if (backendHost === 'localhost' && frontendHost === 'localhost') {
    return {
      domain: backendHost,
    };
  }

  if (commonHostSuffix) {
    commonHostSuffix = commonHostSuffix.replace(/^\./, '');
  }

  if (!commonHostSuffix || !commonHostSuffix.match(/\./)) {
    return {
      domain: backendHost,
      sameSite: 'None',
    };
  }

  return {
    domain: commonHostSuffix,
  };
}

export default function authentication() {
  if (!process.env['FRONTEND_BASE_URL']) {
    throw new Error('FRONTEND_BASE_URL environment variable must be provided');
  }

  if (!process.env['SERVER_BASE_URL']) {
    throw new Error('SERVER_BASE_URL environment variable must be provided');
  }

  const cookieSettings = getCookieSettings(process.env['FRONTEND_BASE_URL'], process.env['SERVER_BASE_URL']);

  if (process.env['DISABLE_AUTHENTICATION'] === 'true') {
    return (req, res, next) => {
      const toBeUser = req?.cookies?.pretendToBeUser;

      if (!['testuser-1-id', 'testuser-2-id', 'testuser-unauthorized-id'].includes(toBeUser)) {
        throw new Error(`${toBeUser} is not in the allowed test user whitelist. This is probably a configuration issue. ${req.method} ${req.path}`);
      }

      req.whenAuthenticated = async (fn) => {
        if (!req?.oidc?.user?.sub || !req.oidc.isAuthenticated()) {
          res.sendStatus(401);
        } else {
          if (!req.signedCookies.userId) {
            res.cookie('userId', uid(req), {
              ...cookieSettings,
              signed: true,
              httpOnly: false,
            });
          }

          req.hashedUserID = uid(req);
          await fn(uid(req));
        }
      };

      req.oidc = {
        user: { sub: toBeUser },
        isAuthenticated: () => true,
      };

      next();
    };
  }

  return (req, res, next) => {
    req.whenAuthenticated = async (fn) => {
      if (!req?.oidc?.user?.sub || !req.oidc.isAuthenticated()) {
        res.sendStatus(401);
      } else {
        if (!req.signedCookies.userId) {
          res.cookie('userId', uid(req), {
            ...cookieSettings,
            signed: true,
            httpOnly: false,
          });
        }

        req.hashedUserID = uid(req);
        await fn(uid(req));
      }
    };

    const authMiddleware = auth({
      baseURL: process.env['FRONTEND_BASE_URL'],
      issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
      clientID: process.env['AUTH_CLIENT_ID'],
      secret: process.env['AUTH_COOKIE_SIGNING_SECRET'],
      clientSecret: process.env['AUTH_CLIENT_SECRET'],
      errorOnRequiredAuth: true,
      enableTelemetry: false,
      afterCallback: (_, __, session: any) => {
        const { email, email_verified, sub } = decodeJwt(session.id_token);

        if (email_verified === true
          && typeof email === 'string'
          && EmailValidator.validate(email)
          && typeof sub === 'string'
          && sub.trim()) {
          Fact.recordUserEmail(email, hashUserId(sub), req.log);
        }

        if (!email_verified || email_verified === 'false') {
          res.redirect('/?email-not-verified');
        }

        return session;
      },
      authorizationParams: {
        // We need offline_access because we do XHR call in the background
        // which can not be redirected for refreshing the token.
        scope: 'openid email offline_access',
        response_type: 'code',
      },
      session: {
        cookie: cookieSettings,
      },
    });

    return authMiddleware(req, res, next);
  };
}
