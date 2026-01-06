import { CompoundAttributeQuery, AttributeQuery, FactQueryWithOptionalSubjectPlaceholder } from '../../attributes/attribute_query';
import Fact from '../../facts/server';

export default class PredicateExtractor {
  /**
   * Extracts all predicates and object values from a compound query for indexing
   */
  static extractFromQuery(query: CompoundAttributeQuery): {
    predicates: Set<string>,
    objectValues: Set<string>
  } {
    const predicates = new Set<string>();
    const objectValues = new Set<string>();

    // Process each query in the compound query
    Object.values(query).forEach((singleQuery) => {
      if (typeof singleQuery === 'string') {
        // Direct ID query - doesn't need indexing by predicate
        return;
      }

      if (Array.isArray(singleQuery)) {
        this.extractFromFactQuery(singleQuery as FactQueryWithOptionalSubjectPlaceholder[], predicates, objectValues);
      }
    });

    return { predicates, objectValues };
  }

  /**
   * Extracts predicates and object values from a fact query array
   */
  private static extractFromFactQuery(
    factQuery: FactQueryWithOptionalSubjectPlaceholder[],
    predicates: Set<string>,
    objectValues: Set<string>
  ): void {
    factQuery.forEach((query) => {
      // Handle [predicate, object] or [subject, predicate, object] format
      const predicate = query.length === 2 ? query[0] as string : query[1] as string;
      const object = query.length === 2 ? query[1] : query[2];

      // Skip special predicates that don't need notification
      if (predicate === '$hasDataType') {
        return;
      }

      // Add predicate to index
      predicates.add(predicate);

      // For transitive predicates like 'isA*', also index the base predicate
      if (predicate.endsWith('*')) {
        predicates.add(predicate.slice(0, -1));
      }

      // Extract object value if it's not a placeholder or class reference
      if (typeof object === 'string' && object !== '$it' && !object.startsWith('$')) {
        objectValues.add(object);
      }
    });
  }

  /**
   * Extracts predicates and objects from a fact
   */
  static extractFromFact(fact: Fact): {
    predicate: string,
    object: string,
    subject: string
  } {
    return {
      predicate: fact.predicate,
      object: fact.object,
      subject: fact.subject
    };
  }
}
