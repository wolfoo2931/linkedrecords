import intersect from 'intersect';
import Fact from '../facts/server';
import LongTextAttribute from './long_text/server';
import KeyValueAttribute from './key_value/server';
import BlobAttribute from './blob/server';

export type AttributeQuery = string | string[][];

export type CompoundAttributeQuery = {
  [key: string]: AttributeQuery
};

export default {

  getAttributeClassByAttributeId(id: string) : any {
    const attributeTypes = [LongTextAttribute, KeyValueAttribute, BlobAttribute];
    const [attributeTypePrefix] = id.split('-');
    return attributeTypes.find((c) => c.getDataTypePrefix() === attributeTypePrefix);
  },

  async resolveToAttributes(
    query: AttributeQuery | CompoundAttributeQuery,
    clientId,
    actorId,
    storage,
  ) {
    const resultWithIds = await this.resolveToIds(query);

    if (!resultWithIds) {
      return [];
    }

    let flatIds;

    if (Array.isArray(resultWithIds)) {
      flatIds = resultWithIds;
    } else if (typeof resultWithIds === 'string') {
      flatIds = [resultWithIds];
    } else {
      flatIds = Object.values(resultWithIds).flat();
    }

    flatIds = flatIds.filter((value, index, array) => array.indexOf(value) === index);

    // TODO: filter the auth stuff here

    const attributes = {};

    await Promise.all(flatIds.map(async (id) => {
      const AttributeClass = this.getAttributeClassByAttributeId(id);

      if (!AttributeClass) {
        attributes[id] = null;
      } else {
        attributes[id] = new AttributeClass(id, clientId, actorId, storage);
        attributes[id] = await attributes[id].get();
        attributes[id].id = id;
      }
    }));

    if (typeof resultWithIds === 'string') {
      return attributes[resultWithIds];
    }

    if (Array.isArray(resultWithIds)) {
      return resultWithIds.map((id) => attributes[id]);
    }

    Object.keys(resultWithIds).forEach((group) => {
      if (typeof resultWithIds[group] === 'string') {
        resultWithIds[group] = attributes[resultWithIds[group] as string];
      } else if (Array.isArray(resultWithIds[group])) {
        resultWithIds[group] = (resultWithIds[group] as string[]).map((id) => attributes[id]);
      }
    });

    return resultWithIds;
  },

  async resolveToIds(
    query: AttributeQuery | CompoundAttributeQuery,
  ): Promise<string | string[] | { [key: string]: string | string[] }> {
    if (query === undefined) {
      throw new Error('query is undefined');
    }

    if (typeof query === 'string') {
      return query;
    }

    if (!Array.isArray(query)) {
      return this.resolveCompoundQueryToIds(query);
    }

    if (query.find((q) => (!q[0] && !q[1] && !q[2]))) {
      return [];
    }

    const subjectFactsQuery = {
      subject: query
        .map((x) => ((x.length === 3 && x[0] === '$it') ? [x[1] as string, x[2] as string] : x))
        .filter((x) => x.length === 2),
    };

    const factsWhereItIsTheSubject = await Fact.findAll(subjectFactsQuery);

    let matchedIds = factsWhereItIsTheSubject.map((f) => f.subject);

    const objectFactsQuery = query
      .filter((q) => q.length === 3 && q[2] === '$it')
      .map(([subject, predicate]) => ({
        subject: [subject as string],
        predicate: [predicate as string],
      }));

    if (objectFactsQuery.length !== 0) {
      const factsWhereItIsTheObject = await Promise.all(
        objectFactsQuery.map((q) => Fact.findAll(q)),
      );

      const mapped: string[][] = [];

      factsWhereItIsTheObject.forEach((allResults) => {
        mapped.push(allResults.map((f) => f.object));
      });

      const matchedObjectIds = intersect(mapped);

      matchedIds = intersect(matchedIds, matchedObjectIds);
    }

    return matchedIds.filter((value, index, array) => array.indexOf(value) === index);
  },

  async resolveCompoundQueryToIds(query: CompoundAttributeQuery): Promise<({
    [key: string]: string | string[]
  })> {
    const result = {};
    const qEntries = Object.entries(query);

    for (let j = 0; j < qEntries.length; j += 1) {
      const qEntry = qEntries[j];

      if (qEntry) {
        const n = qEntry[0];
        const q = qEntry[1];

        // TODO: fix await in loop
        // eslint-disable-next-line no-await-in-loop
        result[n] = await this.resolveToIds(q);
      }
    }

    return result;
  },
};