export type SubjectQuery = string | [string, string, ('$it' | '$not($it)')?];

export type SubjectQueries = SubjectQuery[];

export type FactQuery = {
  subject?: SubjectQueries,
  subjectBlacklist?: [string, string][],
  predicate?: string[],
  object?: SubjectQueries
  objectBlacklist?: [string, string][],
};
