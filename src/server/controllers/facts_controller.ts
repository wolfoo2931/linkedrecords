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

    const authorizedChecks = facts.map((fact) => fact.isAuthorizedToSave(req.hashedUserID));

    const containsUnauthorizedFacts = (await Promise.all(authorizedChecks))
      .includes((isAuthorized) => !isAuthorized);

    if (containsUnauthorizedFacts) {
      res.status(401);
      res.send({});
    } else {
      const savedRawFacts: Fact[] = [];

      for (let i = 0; i < facts.length; i += 1) {
        await facts[i].save(req.hashedUserID);
        savedRawFacts.push(facts[i]);
      }

      res.status(200);
      res.send(await Promise.all(savedRawFacts));
    }
  },

  async delete(req, res) {
    const facts = req.body.map((rawFact) => new Fact(
      rawFact[0],
      rawFact[1],
      rawFact[2],
      req.log,
    ));

    const authorizedChecks = facts.map((fact) => fact.isAuthorizedToSave(req.hashedUserID));

    const containsUnauthorizedFacts = (await Promise.all(authorizedChecks))
      .includes((isAuthorized) => !isAuthorized);

    if (containsUnauthorizedFacts) {
      res.status(401);
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
