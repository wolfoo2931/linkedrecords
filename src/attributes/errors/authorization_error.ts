/* eslint-disable import/no-cycle */
import IsLogger from '../../../lib/is_logger';
import Fact from '../../facts/server';

export default class AuthorizationError extends Error {
  constructor(userId: string, entityType: string, entity: string | Fact, logger: IsLogger) {
    super(`User ${userId} is not authorized to access ${entityType}`);

    let record = '';

    try {
      record = JSON.stringify(entity);
    } catch {
      logger.warn('error logging an error, something could not be serialized');
    }

    logger.warn(`User ${userId} is not authorized to access ${entityType} ${record}`);
  }
}
