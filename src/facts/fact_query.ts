export type SubjectQuery = string | [string, string, ('$it' | '$not($it)')?];

export type SubjectQueries = SubjectQuery[];

export type FactQuery = {
  subject?: SubjectQueries,
  predicate?: string[],
  object?: SubjectQueries
};
