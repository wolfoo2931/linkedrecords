const { auth } = require('express-openid-connect');

export default function authentication() {
  if (process.env['DISABLE_AUTHENTICATION'] === 'true') {
    return (req, res, next) => {
      const toBeUser = req?.cookies?.pretendToBeUser;

      if (!['testuser-1-id', 'testuser-2-id', 'testuser-unauthorized-id'].includes(toBeUser)) {
        throw new Error(`${toBeUser} is not in the allowed test user whitlist. This is probably a configuration issue. ${req.method} ${req.path}`);
      }

      req.oidc = {
        user: { sub: toBeUser },
        isAuthenticated: () => true,
      };

      next();
    };
  }

  return auth({
    baseURL: process.env['APP_BASE_URL'],
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
        sameSite: 'None',
        secure: true,
      },
    },
  });
}
