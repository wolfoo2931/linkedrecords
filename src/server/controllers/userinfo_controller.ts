import md5 from 'md5';

export const hashUserId = (id) => `us-${md5(id)}`;
export const uid = (req) => req?.oidc?.user?.sub && hashUserId(req.oidc.user.sub);

export default {
  async userinfo(req, res) {
    await req.whenAuthenticated(async () => {
      if (req.query?.email) {
        const user = await req.Fact.getUserIdByEmail(req.query.email, req.log);

        if (user) {
          res.status(200).send({ id: user });
        } else {
          res.status(200).send({ id: undefined });
        }
      } else {
        res.status(200).send({
          userId: uid(req),
          userPicture: req?.oidc?.user?.picture,
        });
      }
    });
  },
};
