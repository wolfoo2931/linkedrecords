import SerializedChangeWithMetadata from '../../attributes/abstract/serialized_change_with_metadata';

export default {
  async create(req, res) {
    await req.attribute.create(req.body.value);
    const result = await req.attribute.get();

    if (result instanceof Error) {
      console.error(`error in GET /attributes/${req.params.attributeId}`, result.message);
      res.status(404).send({ error: result.message });
    } else {
      res.send(result);
    }
  },

  async get(req, res) {
    const result = await req.attribute.get();

    if (result instanceof Error) {
      console.error(`error in GET /attributes/${req.params.id}`, result.message);
      res.status(404).send({ error: result.message });
    } else {
      res.send(result);
    }
  },

  async subsribe(req, res) {
    res.subscribeSEE(req.params.attributeId);
    res.send({ status: 'ok' });
  },

  async update(req, res) {
    const parsedChange: SerializedChangeWithMetadata<any> = req.body;
    const commitedChange: SerializedChangeWithMetadata<any> = await req.attribute.change(
      parsedChange,
    );

    res.sendSEE(req.params.attributeId, commitedChange);
    res.status(200);
    res.send();
  },
};
