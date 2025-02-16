import format = require('pg-format');

export default class EnsureIsValid {
  static tableName(tableName: string): string {
    if (typeof tableName !== 'string') {
      throw new Error(`Invalid tableName. must be string: ${tableName}`);
    }

    // PostgreSQL table names must start with a letter or underscore,
    // followed by letters, numbers, or underscores
    const validTableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    if (!tableName) {
      throw new Error('Table name cannot be empty');
    }

    if (tableName.length > 63) {
      throw new Error(`Table name exceeds the maximum allowed length of 63 characters: ${tableName}`);
    }

    if (!validTableNameRegex.test(tableName)) {
      throw new Error('Invalid table name. Must start with a letter or underscore and contain only letters, numbers, or underscores');
    }

    return format('%I', tableName);
  }

  static userId(userId: string): string {
    if (typeof userId !== 'string') {
      throw new Error(`Invalid userId. must be string: ${userId}`);
    }

    // User ID must start with 'us-' followed by a valid MD5 hash (32 hexadecimal characters)
    const validUserIdRegex = /^us-[a-fA-F0-9]{32}$/;

    if (!userId) {
      throw new Error('User ID cannot be empty');
    }

    if (!validUserIdRegex.test(userId)) {
      throw new Error("Invalid User ID. Must start with 'us-' followed by a 32-character MD5 hash");
    }

    return format('%s', userId);
  }

  static subject(subject: string): string {
    if (typeof subject !== 'string') {
      throw new Error(`Invalid subject. must be string: ${subject}`);
    }

    if (subject.match(/^[a-zA-Z0-9-]{1,40}$/)) {
      return format('%s', subject);
    }

    throw new Error(`Invalid subject. Must contain only letters and be 40 or less chars long: ${subject}`);
  }

  static predicate(predicate: string): string {
    if (typeof predicate !== 'string') {
      throw new Error(`Invalid predicate. must be string: ${predicate}`);
    }

    if (predicate.match(/^\$?[a-zA-Z]{1,32}$/) || predicate.match(/^[a-zA-Z]{1,32}\*?$/)) {
      return format('%s', predicate);
    }

    throw new Error(`Invalid predicate. Must contain only letters and be 32 or less chars long (can start with $ or end with *): ${predicate}`);
  }

  static object(object: string): string {
    if (typeof object !== 'string') {
      throw new Error(`Invalid object. must be string: ${object}`);
    }

    if (object.match(/^[a-zA-Z0-9-]{1,40}$/)) {
      return object;
    }

    throw new Error(`Invalid object. Must contain only letters and be 40 or less chars long: ${object}`);
  }

  static nodeId(nodeId: string): string {
    if (EnsureIsValid.subject(nodeId) || EnsureIsValid.object(nodeId)) {
      return format('%s', nodeId);
    }

    throw new Error('Invalid node-id.');
  }

  static term(term: string): string {
    if (typeof term !== 'string') {
      throw new Error(`Invalid term. must be string: ${term}`);
    }

    if (term.match(/^[a-zA-Z]{1,32}$/)) {
      return format('%s', term);
    }

    throw new Error('Invalid term. Must contain only letters and be 32 or less chars long.');
  }

  static factBoxId(id: string | number): string | number {
    if (typeof id === 'number' || id.match(/^\d+$/)) {
      return id;
    }

    throw new Error('Invalid fact box Id. Must be a number');
  }
}
