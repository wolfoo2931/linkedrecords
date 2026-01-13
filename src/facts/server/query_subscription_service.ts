/* eslint-disable import/no-cycle */
import type Fact from '.';
import IsLogger from '../../../lib/is_logger';
import { getSubscribedQueries, notifyQueryResultMightHaveChanged } from '../../server/service_bus_mount';
import { CompoundAttributeQuery, isValidCompoundAttributeQuery } from '../../attributes/attribute_query';
import FactBox from './fact_box';

export default class QuerySubscriptionService {
  logger: IsLogger;

  constructor(logger: IsLogger) {
    this.logger = logger;
  }

  async onFactsDeleted(
    facts: Fact[],
  ): Promise<void> {
    try {
      await this.notifyFactChanged(facts);
    } catch (ex: any) {
      this.logger.warn(`Failed to notify query subscribers on fact deleted: ${ex?.message}`);
    }
  }

  async onFactsAdded(
    facts: Fact[],
  ): Promise<void> {
    try {
      await this.notifyFactChanged(facts);
    } catch (ex: any) {
      this.logger.warn(`Failed to notify query subscribers on fact added: ${ex?.message}`);
    }
  }

  private async notifyFactChanged(
    facts: Fact[],
  ): Promise<void> {
    const allSubscribedQueries = await getSubscribedQueries(this.logger);

    await Promise.all(allSubscribedQueries.map(async ({ userIds, query }) => {
      const affectedUsers = await Promise.all(
        userIds.map(async (userId) => ({
          userId,
          affected: await this.factsChangeMightAffectQuery(facts, query, userId),
        })),
      );

      affectedUsers
        .filter(({ affected }) => affected)
        .forEach(({ userId }) => notifyQueryResultMightHaveChanged(query, userId));
    }));
  }

  private async factsChangeMightAffectQuery(
    facts: Fact[],
    query: CompoundAttributeQuery,
    userId: string,
  ): Promise<boolean> {
    const results = await Promise.all(
      facts.map((f) => this.factChangeMightAffectQuery(f, query, userId)),
    );

    return results.some((result) => result);
  }

  private async factChangeMightAffectQuery(
    fact: Fact,
    query: CompoundAttributeQuery,
    userid: string, // does the query result change for this user
  ): Promise<boolean> {
    this.logger.debug(`check if fact (${fact.subject}, ${fact.predicate}, ${fact.object}) change might affect query: ${JSON.stringify(query)}`);

    if (!isValidCompoundAttributeQuery(query)) {
      throw new Error(`invalid query: ${JSON.stringify(query)}`);
    }

    if (!fact.factBox) {
      this.logger.warn(`unexpected FactBox miss for fact: ${fact.subject}, ${fact.predicate}, ${fact.object}. Determining fact box ...`);
      const fb = await FactBox.getFactBoxPlacement(userid, fact, this.logger);

      fact.setFactBox(fb);

      if (!fact.factBox) {
        throw new Error(`could not determine fact box for fact: ${fact.subject}, ${fact.predicate}, ${fact.object}.`);
      }
    }

    if (fact.predicate === '$isATermFor') {
      // When we query for a term which is not defined yet,
      // this query will not be updated once the term is defined.
      // This should be an edge case, we accept this for now.
      return false;
    }

    if (!(await FactBox.isUserAssociatedToFactBox(fact.factBox.id, userid, this.logger))) {
      return false;
    }

    const predicates = QuerySubscriptionService.extractAllPredicatesFromQuery(query);

    return predicates.has(fact.predicate);
  }

  private static extractAllPredicatesFromQuery(query: CompoundAttributeQuery): Set<string> {
    const predicates = new Set<string>();

    // Process each query in the compound query
    Object.values(query).forEach((singleQuery) => {
      if (typeof singleQuery === 'string') {
        // Direct ID query - doesn't need indexing by predicate
        return;
      }

      if (Array.isArray(singleQuery)) {
        singleQuery.forEach((queryRecord) => {
          const predicate = queryRecord.length === 2
            ? queryRecord[0]
            : queryRecord[1];

          if (typeof predicate === 'string') {
            const modifierMatch = predicate.match(/.*\((.*?)\)/);

            if (modifierMatch && modifierMatch[1]) {
              predicates.add(modifierMatch[1]);
            } else {
              predicates.add(predicate);
            }
          }
        });
      }
    });

    return predicates;
  }
}
