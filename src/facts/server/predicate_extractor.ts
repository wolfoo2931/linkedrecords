import { type CompoundAttributeQuery } from '../../attributes/attribute_query';

export default class PredicateExtractor {
  /**
   * Extracts all predicates and object values from a compound query for indexing
   */
  static extractFromQuery(query: CompoundAttributeQuery): Set<string> {
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
