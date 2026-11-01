// Thrown by the SDK's read methods (Fact.findAll, Record.findAll, getQuota,
// getUserIdByEmail, ...) when their request failed: the session expired, the
// user may not do this, the server answered with an error, or the connection
// was lost. The matching handler (login, authorization error, unknown server
// error, connection lost) has been called by then, so the application has
// already been told; callers can tell a failure from an empty result (#227).
export default class RequestFailedError extends Error {
  // e.g. "GET /facts"; without the query, which can contain e-mail addresses
  readonly request: string;

  constructor(request: string) {
    super(`request failed: ${request}`);
    // set explicitly: the class name doesn't survive minification
    this.name = 'RequestFailedError';
    this.request = request;
  }
}
