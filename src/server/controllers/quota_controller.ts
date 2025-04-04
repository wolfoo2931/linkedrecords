import Fact from '../../facts/server';
import Quota from '../quota';

export default {
  async get(req, res) {
    if (!req.params.nodeId) {
      throw new Error('no nodeId given to retrieve quota');
    }

    const quota = new Quota(req.params.nodeId, req.log);

    const asAccountee = await Fact.isAuthorizedToManageQuota(
      req.params.nodeId,
      req.hashedUserID,
      req.logger,
    );

    res.send(await quota.toJSON(asAccountee));
  },
};
