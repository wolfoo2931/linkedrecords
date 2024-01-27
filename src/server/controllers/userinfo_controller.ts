import md5 from 'md5';

export const hashUserId = (id) => `us-${md5(id)}`;
export const uid = (req) => req?.oidc?.user?.sub && hashUserId(req.oidc.user.sub);

export default {
  async userinfo(req, res) {
    await req.whenAuthenticated(async () => {
      res.status(200).send('empty response');
    });
  },
};
