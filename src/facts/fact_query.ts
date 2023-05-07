export type SubjectQuery = string | [string, string, '$it'?];

export type SubjectQueries = SubjectQuery[];

export type FactQuery = {
  subject?: SubjectQueries,
  predicate?: string[],
  object?: SubjectQueries
};
