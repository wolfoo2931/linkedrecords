import Fact from '../../facts/server';

const asyncFilter = async (arr, fn) => {
  const results = await Promise.all(arr.map(fn));
  return arr.filter((_v, index) => results[index]);
};

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
    res.send(await asyncFilter(facts, isAuthorizedToReadFact));
  },

  async create(req, res, isAuthorizedToCreateFact) {
    const rawFacts = req.body;
    const savedRawFacts: object[] = [];

    for (let i=0; i < rawFacts.length; i++) {
      const fact = new Fact(rawFacts[i][0], rawFacts[i][1], rawFacts[i][2]);

      if(await isAuthorizedToCreateFact(fact)) {
        await fact.save(req.hasedUserID);

        savedRawFacts.push(fact.toJSON());
      }
    }

    res.status(200);
    res.send(savedRawFacts);
  }
};
