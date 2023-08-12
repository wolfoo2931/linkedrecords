const { auth } = require('express-openid-connect');

function isSameHostname(origin1, origin2) {
  try {
    const url1 = new URL(origin1);
    const url2 = new URL(origin2);

    return url1.hostname === url2.hostname && url1.protocol === url2.protocol;
  } catch (ex) {
    return false;
  }
}

export default function authentication() {
  if (process.env['DISABLE_AUTHENTICATION'] === 'true') {
    return (req, res, next) => {
      const toBeUser = req?.cookies?.pretendToBeUser;

      if (!['testuser-1-id', 'testuser-2-id', 'testuser-unauthorized-id'].includes(toBeUser)) {
        throw new Error(`${toBeUser} is not in the allowed test user whitelist. This is probably a configuration issue. ${req.method} ${req.path}`);
      }

      req.oidc = {
        user: { sub: toBeUser },
        isAuthenticated: () => true,
      };

      next();
    };
  }

  return (req, res, next) => {
    const authMiddleware = auth({
      baseURL: process.env['FRONTEND_BASE_URL'],
      issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
      clientID: process.env['AUTH_CLIENT_ID'],
      secret: process.env['AUTH_COOKIE_SIGNING_SECRET'],
      clientSecret: process.env['AUTH_CLIENT_SECRET'],
      errorOnRequiredAuth: true,
      authorizationParams: {
        scope: 'openid offline_access',
        response_type: 'code',
      },
      session: {
        cookie: {
          domain: process.env['COOKIE_DOMAIN'],
          sameSite: isSameHostname(process.env['FRONTEND_BASE_URL'], process.env['SERVER_BASE_URL']) ? undefined : 'None',
        },
      },
    });

    return authMiddleware(req, res, next);
  };
}
