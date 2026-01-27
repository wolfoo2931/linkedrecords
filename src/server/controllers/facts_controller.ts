/* eslint-disable no-await-in-loop */
import Fact from '../../facts/server';

export default {
  async index(req, res) {
    const subject = req.query.subject ? JSON.parse(req.query.subject) : undefined;
    const predicate = req.query.predicate ? JSON.parse(req.query.predicate) : undefined;
    const object = req.query.object ? JSON.parse(req.query.object) : undefined;

    const facts = await Fact.findAll({
      subject,
      predicate,
      object,
    }, req.hashedUserID, req.log);

    res.status(200);
    res.send(facts);
  },

  async create(req, res) {
    const facts = req.body.map((rawFact) => new Fact(
      rawFact[0],
      rawFact[1],
      rawFact[2],
      req.log,
    ));

    const authorizedChecks = await Promise.all(
      facts.map((fact) => fact.isAuthorizedToSave(req.hashedUserID)),
    );

    const containsUnauthorizedFacts = authorizedChecks.some((x) => !x);

    if (containsUnauthorizedFacts) {
      res.status(403);
      res.send({});
    } else {
      await Fact.saveAllWithoutAuthCheck(facts, req.hashedUserID, undefined, req.log);

      res.status(200);
      res.send(facts);
    }
  },

  async delete(req, res) {
    const facts = req.body.map((rawFact) => new Fact(
      rawFact[0],
      rawFact[1],
      rawFact[2],
      req.log,
    ));

    const authorizedChecks = await Promise.all(
      facts.map((fact) => fact.isAuthorizedToSave(req.hashedUserID)),
    );

    const containsUnauthorizedFacts = authorizedChecks.some((x) => !x);

    if (containsUnauthorizedFacts) {
      res.status(403);
      res.send({});
    } else {
      for (let i = 0; i < facts.length; i += 1) {
        await facts[i].delete(req.hashedUserID);
      }

      res.status(200);
      res.send({ status: 'ok' });
    }
  },
};
