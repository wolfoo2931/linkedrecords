/* eslint-disable import/no-cycle */
import Fact from '../facts/server';
import { SubjectQuery } from '../facts/fact_query';
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

type ResolveToIdsResult = undefined | string | string[] | { [key: string]: string | string[] };
export type ResolveToAttributesResult =
  undefined |
  AbstractAttributeClient<any, any> |
  AbstractAttributeClient<any, any>[] |
  { [key: string]: AbstractAttributeClient<any, any> | AbstractAttributeClient<any, any>[] };

type Attribute = typeof LongTextAttribute | typeof KeyValueAttribute | typeof BlobAttribute;

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

function resolvedIdsToFlatArray(resultWithIds: ResolveToIdsResult): string[] {
  if (!resultWithIds) {
    throw new Error('expected ResolveToIdsResult to not be undefined');
  }

  let flatIds;

  if (Array.isArray(resultWithIds)) {
    flatIds = resultWithIds;
  } else if (typeof resultWithIds === 'string') {
    flatIds = [resultWithIds];
  } else {
    flatIds = Object.values(resultWithIds).flat();
  }

  return flatIds
    .filter((id) => id !== undefined)
    .filter((value, index, array) => array.indexOf(value) === index);
}

export default class QueryExecutor {
  logger: IsLogger;

  constructor(logger: IsLogger) {
    this.logger = logger;
  }

  async resolveToAttributes(
    query: AttributeQuery | CompoundAttributeQuery,
    clientId,
    actorId,
  ): Promise<ResolveToAttributesResult> {
    // undefined | string | string[] | { [key: string]: string | string[] };
    let resultWithIds = await this.resolveToIds(query, actorId);

    if (!resultWithIds) {
      return [];
    }

    const flatIds = resolvedIdsToFlatArray(resultWithIds);

    if (Array.isArray(resultWithIds)) {
      resultWithIds = resultWithIds.filter((id) => flatIds.includes(id));
    } else if (typeof resultWithIds === 'string' && flatIds.includes(resultWithIds)) {
      return undefined;
    } else {
      Object.keys(resultWithIds).forEach((group) => {
        if (!resultWithIds) {
          throw new Error('resultWithIds is expected to be defined');
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

    const attributes = await this.loadAttributes(
      flatIds,
      clientId,
      actorId,
      { inAuthorizedContext: true },
    );

    if (typeof resultWithIds === 'string') {
      return attributes[resultWithIds];
    }

    if (Array.isArray(resultWithIds)) {
      return resultWithIds
        .map((id) => attributes[id])
        .filter((x) => x);
    }

    const resultWithAttr: ResolveToAttributesResult = {};
    Object.keys(resultWithIds).forEach((group) => {
      if (!resultWithIds) {
        return;
      }

      if (typeof resultWithIds[group] === 'string') {
        resultWithAttr[group] = attributes[resultWithIds[group]];
      } else if (Array.isArray(resultWithIds[group])) {
        resultWithAttr[group] = resultWithIds[group]
          .map((id) => attributes[id])
          .filter((x) => x);
      }
    });

    return resultWithAttr;
  }

  async resolveToIds(
    query: AttributeQuery | CompoundAttributeQuery,
    userid: string,
  ): Promise<ResolveToIdsResult> {
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
    const factQuery = query as FactQueryWithOptionalSubjectPlaceholder[];

    const queryWithoutDataTypeFilter = factQuery.filter((q) => {
      if (q[2] && typeof q[2] !== 'string') {
        return false;
      }

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

    const subjectQuery = queryWithoutDataTypeFilter
      .filter((q) => q.length < 3 || q[2] !== '$not($it)')
      .map(factQueryWithOptionalSubjectPlaceholderToFactQuery)
      .filter((x) => x && x.length === 2);

    const objectQuery = queryWithoutDataTypeFilter
      .filter((q) => q.length === 3 && q[2] === '$it')
      .map(([subject, predicate]) => ([subject, predicate])) as [string, string][];

    const nodeBlacklist: [string, string][] = queryWithoutDataTypeFilter
      .filter((q) => q.length === 3 && q[2] === '$not($it)')
      .map(([subject, predicate]) => [subject, predicate]);

    let matchedIds = await Fact.findNodes(
      subjectQuery,
      objectQuery,
      nodeBlacklist,
      userid,
      this.logger,
    );

    if (dataTypeFilter === 'KeyValueAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('kv-'));
    } else if (dataTypeFilter === 'LongTextAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('l-'));
    } else if (dataTypeFilter === 'BlobAttribute') {
      matchedIds = matchedIds.filter((id) => id.startsWith('bl-'));
    }

    return matchedIds;
  }

  async loadAttributes(
    attributeIDs: string[],
    clientId: string,
    actorId: string,
    args?: { inAuthorizedContext: boolean },
  ): Promise<Record<string, any>> {
    const attributesByType = QueryExecutor.groupAttributeIDsByClass(attributeIDs);
    const attributes = {};
    const promises: Promise<any>[] = [];

    attributesByType.forEach((ids, c) => {
      const promise = c.loadAll(
        ids,
        clientId,
        actorId,
        this.logger,
        args,
      ).then((attrs) => {
        attrs.forEach((attr) => {
          attributes[attr.id] = attr;
        });
      });

      promises.push(promise);
    });

    await Promise.all(promises);

    return attributes;
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

  static getAttributeClassByAttributeId(
    id: string,
  ) : Attribute | undefined {
    const attributeTypes = [LongTextAttribute, KeyValueAttribute, BlobAttribute];
    const [attributeTypePrefix] = id.split('-');
    return attributeTypes.find((c) => c.getDataTypePrefix() === attributeTypePrefix);
  }

  static groupAttributeIDsByClass(attributeIDs: string[]): Map<Attribute, string[]> {
    const attributesByType = new Map<Attribute, string[]>();

    attributeIDs.forEach((id) => {
      const AttributeClass = QueryExecutor.getAttributeClassByAttributeId(id);
      if (!AttributeClass) {
        return;
      }

      if (!attributesByType.get(AttributeClass)) {
        attributesByType.set(AttributeClass, []);
      }

      const ids = attributesByType.get(AttributeClass);

      if (ids) {
        ids.push(id);
      }
    });

    return attributesByType;
  }
}
