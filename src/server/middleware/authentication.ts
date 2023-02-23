const { auth } = require('express-openid-connect');

export default function authentication() {
  if (process.env['DISABLE_AUTH'] === 'true') {
    return (req, res, next) => next();
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
