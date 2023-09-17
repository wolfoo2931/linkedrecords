import SerializedChangeWithMetadata from '../../attributes/abstract/serialized_change_with_metadata';
import QueryExecutor, { AttributeQuery } from '../../attributes/attribute_query';
import Fact from '../../facts/server';

export default {
  async index(req, res, isAuthorizedToReadAttribute) {
    const { clientId, actorId, attributeStorage } = req;
    const query: AttributeQuery = JSON.parse(req.query.query);
    const queryExecutor = new QueryExecutor(req.log);
    const result = await queryExecutor.resolveToAttributes(
      query,
      clientId,
      actorId,
      attributeStorage,
      isAuthorizedToReadAttribute,
    );

    res.send(result);
  },

  async create(req, res, isAuthorizedToCreateFact?) {
    await req.attribute.create(req.body.value);
    const result = await req.attribute.get();
    const rawFacts = req.body.facts || [];

    if (typeof isAuthorizedToCreateFact === 'function' && rawFacts.length) {
      await Promise.all(rawFacts.map(async (rawFact) => {
        if (rawFact.length === 2) {
          const fact = new Fact(req.attribute.id, rawFact[0], rawFact[1], req.log);

          if (await isAuthorizedToCreateFact(fact)) {
            await fact.save(req.hashedUserID);
          }
        }
      }));
    }

    if (result instanceof Error) {
      console.error(`error in POST /attributes/${req.params.attributeId}`, result.message);
      res.status(404).send({ error: result.message });
    } else {
      res.send(result);
    }
  },

  async get(req, res) {
    let result = await req.attribute.get();
    const mimetype = result?.value?.type;
    const isBlob = result.value instanceof Blob;

    if (result instanceof Error) {
      console.error(`error in GET /attributes/${req.params.attributeId}`, result.message);
      res.status(404).send({ error: result.message });
      return;
    }

    if (typeof result?.value?.arrayBuffer === 'function') {
      result.value = Buffer.from(await result.value.arrayBuffer());
    }

    if (req.query.valueOnly === 'true') {
      if (mimetype) {
        res.set('Content-Type', mimetype);
      }

      result = result.value;
    }

    if (isBlob) {
      result.value = `data:${mimetype};base64,${(result.value || result).toString('base64')}`;
    }

    res.send(result);
  },

  async subscribe(req, res) {
    res.subscribeClientServerbus(req.params.attributeId);
    res.send({ status: 'ok' });
  },

  async update(req, res) {
    const parsedChange: SerializedChangeWithMetadata<any> = req.body;
    const committedChange: SerializedChangeWithMetadata<any> = await req.attribute.change(
      parsedChange,
    );

    res.sendClientServerMessage(req.params.attributeId, committedChange);
    res.status(200);
    res.send();
  },
};
