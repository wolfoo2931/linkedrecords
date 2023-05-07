export type SubjectQuery = (string | string[])[];

export type FactQuery = {
  subject?: SubjectQuery,
  predicate?: string[],
  object?: SubjectQuery
};
