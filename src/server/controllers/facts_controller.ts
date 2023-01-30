import Fact from '../../facts/server';

export default {
  async index(req, res, isAuthorizedToReadFact) {
    const subject = req.query.subject ? JSON.parse(req.query.subject) : undefined;
    const predicate = req.query.predicate ? JSON.parse(req.query.predicate) : undefined;
    const object = req.query.object ? JSON.parse(req.query.object) : undefined;

    const facts = await Fact.findAll({
      subject,
      predicate,
      object,
    });

    res.status(200);
    res.send(facts.filter(isAuthorizedToReadFact));
  },

  async create(req, res) {
    const { subject, predicate, object } = req.body;
    const fact = new Fact(subject, predicate, object);
    await fact.save();

    res.status(200);
    res.send();
  },

  async deleteAll(req, res) {
    await Fact.deleteAll();

    res.status(200);
    res.send();
  },
};
