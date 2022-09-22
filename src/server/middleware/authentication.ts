const { auth } = require('express-openid-connect');

export default function authentication() {
  return auth({
    baseURL: process.env['APP_BASE_URL'],
    issuerBaseURL: process.env['AUTH_ISSUER_BASE_URL'],
    clientID: process.env['AUTH_CLIENT_ID'],
    secret: process.env['AUTH_COOKIE_SIGNING_SECRET'],
    clientSecret: process.env['AUTH_CLIENT_SECRET'],
    authorizationParams: {
      scope: 'openid offline_access',
      response_type: 'code',
    },
    afterCallback: (req, res, session) => {
      // const claims = jose.JWT.decode(session.id_token); // using jose library to decode JWT
      console.log(session);
      return session;
    },
  });
}
