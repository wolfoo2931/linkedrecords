import md5 from 'md5';

export const uid = (req) => req?.oidc?.user?.sub && `us-${md5(req.oidc.user.sub)}`;

export default {
  async userinfo(req, res) {
    if (!req?.oidc?.user?.sub) {
      res.sendStatus(401);
    } else {
      res.cookie('userId', uid(req), { signed: true, httpOnly: false, domain: process.env['COOKIE_DOMAIN'] });
      res.status(200).send('empty response');
    }
  },
};
