/* eslint-disable import/no-cycle */
import intersect from 'intersect';
import Fact from '../facts/server';
import { FactQuery, SubjectQuery } from '../facts/fact_query';
import LongTextAttribute from './long_text/server';
import KeyValueAttribute from './key_value/server';
import BlobAttribute from './blob/server';
import IsLogger from '../../lib/is_logger';
import AbstractAttributeClient from './abstract/abstract_attribute_client';

export type FactQueryWithOptionalSubjectPlaceholder =
  [string, string, string?] |
  [string, string, typeof AbstractAttributeClient<any, any>] |
  [string, typeof AbstractAttributeClient<any, any>];

export type AttributeQuery = string | FactQueryWithOptionalSubjectPlaceholder[];

export type CompoundAttributeQuery = {
  [key: string]: AttributeQuery
};

function factQueryWithOptionalSubjectPlaceholderToFactQuery(
  x: [string, string, string?],
): SubjectQuery {
  if (x.length === 3 && x[0] === '$it' && x[2]) {
    return [x[1], x[2]];
  }

  if (x.length === 3 && x[2] === '$it') {
    return [x[0], x[1], x[2]];
  }

  if (x.length === 2 && x[0] && x[1]) {
    return [x[0], x[1]];
  }

  throw new Error(`factQueryWithOptionalSubjectPlaceholderToFactQuery received invalid input: ${JSON.stringify(x)}`);
}

function filterUndefinedSubjectQueries(
  array: Array<SubjectQuery | undefined>,
): Array<SubjectQuery> {
  const result: Array<SubjectQuery> = [];

  array.forEach((el) => {
    if (el) {
      result.push(el);
    }
  });

  return result;
}

export default class QueryExecutor {
  logger: IsLogger;

  static getAttributeClassByAttributeId(id: string) : any {
    const attributeTypes = [LongTextAttribute, KeyValueAttribute, BlobAttribute];
    const [attributeTypePrefix] = id.split('-');
    return attributeTypes.find((c) => c.getDataTypePrefix() === attributeTypePrefix);
  }

  constructor(logger: IsLogger) {
    this.logger = logger;
  }

  async resolveToAttributes(
    query: AttributeQuery | CompoundAttributeQuery,
    clientId,
    actorId,
    storage,
  ) {
    let resultWithIds = await this.resolveToIds(query, actorId);

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

    flatIds = flatIds
      .filter((id) => id !== undefined)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (Array.isArray(resultWithIds)) {
      resultWithIds = resultWithIds.filter((id) => flatIds.includes(id));
    } else if (typeof resultWithIds === 'string' && flatIds.includes(resultWithIds)) {
      return undefined;
    } else {
      Object.keys(resultWithIds).forEach((group) => {
        if (!resultWithIds) {
          return;
        }

        if (typeof resultWithIds[group] === 'string') {
          if (!flatIds.includes(resultWithIds[group])) {
            resultWithIds[group] = undefined;
          }
        } else {
          resultWithIds[group] = resultWithIds[group]
            ? resultWithIds[group].filter((id) => flatIds.includes(id))
            : undefined;
        }
      });
    }

    const attributes = {};

    await Promise.all(flatIds.map(async (id) => {
      const AttributeClass = QueryExecutor.getAttributeClassByAttributeId(id);

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
      return resultWithIds
        .map((id) => attributes[id])
        .filter((x) => x);
    }

    Object.keys(resultWithIds).forEach((group) => {
      if (!resultWithIds) {
        return;
      }

      if (typeof resultWithIds[group] === 'string') {
        resultWithIds[group] = attributes[resultWithIds[group] as string];
      } else if (Array.isArray(resultWithIds[group])) {
        resultWithIds[group] = (resultWithIds[group] as string[])
          .map((id) => attributes[id])
          .filter((x) => x);
      }
    });

    return resultWithIds;
  }

  async resolveToIds(
    query: AttributeQuery | CompoundAttributeQuery,
    userid: string,
  ): Promise<undefined | string | string[] | { [key: string]: string | string[] }> {
    if (!userid) {
      throw new Error('resolveToIds needs to receive a valid userid!');
    }

    if (query === undefined) {
      throw new Error('query is undefined');
    }

    if (typeof query === 'string') {
      if (await Fact.isAuthorizedToReadPayload(query, userid, this.logger)) {
        return query;
      }

      return undefined;
    }

    if (!Array.isArray(query)) {
      return this.resolveCompoundQueryToIds(query, userid);
    }

    if (query.find((q) => (!q[0] && !q[1] && !q[2]))) {
      return [];
    }

    let dataTypeFilter;

    const queryWithoutDataTypeFilter = query.filter((q) => {
      if (q[1] === '$hasDataType') {
        [, , dataTypeFilter] = q;
        return false;
      }

      if (q[0] === '$hasDataType') {
        [, dataTypeFilter] = q;
        return false;
      }

      return true;
    }) as [string, string, string?][];

    const subjectFactsQuery: FactQuery = {
      subject: filterUndefinedSubjectQueries(queryWithoutDataTypeFilter
        .map(factQueryWithOptionalSubjectPlaceholderToFactQuery)
        .filter((x) => x && x.length === 2)),
    };

    const factsWhereItIsTheSubject = await Fact.findAll(subjectFactsQuery, userid, this.logger);

    let matchedIds = factsWhereItIsTheSubject.map((f) => f.subject);

    if (dataTypeFilter === 'KeyValueAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('kv-'));
    } else if (dataTypeFilter === 'LongTextAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('l-'));
    } else if (dataTypeFilter === 'BlobAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('bl-'));
    }

    const objectFactsQuery = queryWithoutDataTypeFilter
      .filter((q) => q.length === 3 && q[2] === '$it')
      .map(([subject, predicate]) => ({
        subject: [subject as string],
        predicate: [predicate as string],
      }));

    if (objectFactsQuery.length !== 0) {
      const factsWhereItIsTheObject = await Promise.all(
        objectFactsQuery.map((q) => Fact.findAll(q, userid, this.logger)),
      );

      const mapped: string[][] = [];

      factsWhereItIsTheObject.forEach((allResults) => {
        mapped.push(allResults.map((f) => f.object));
      });

      const matchedObjectIds = intersect(mapped);

      matchedIds = intersect(matchedIds, matchedObjectIds);
    }

    return matchedIds.filter((value, index, array) => array.indexOf(value) === index);
  }

  async resolveCompoundQueryToIds(query: CompoundAttributeQuery, userid: string): Promise<({
    [key: string]: string | string[]
  })> {
    if (!userid) {
      throw new Error('resolveCompoundQueryToIds needs to receive a valid userid!');
    }

    const result = {};
    const promises: Promise<any>[] = [];
    const qEntries = Object.entries(query);

    for (let j = 0; j < qEntries.length; j += 1) {
      const qEntry = qEntries[j];

      if (qEntry) {
        const n = qEntry[0];
        const q = qEntry[1];

        result[n] = this.resolveToIds(q, userid);
        promises.push(result[n]);
      }
    }

    await Promise.all(promises);

    Object.keys(result).forEach(async (key) => {
      result[key] = await result[key];
    });

    return result;
  }
}
