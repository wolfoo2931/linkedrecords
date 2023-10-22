/* eslint-disable import/no-cycle */
import IsLogger from '../../../lib/is_logger';
import Fact from '../../facts/server';

export default class AuthorizationError extends Error {
  constructor(userId: string, entityType: string, entity: string | Fact, logger: IsLogger) {
    super(`User ${userId} is not authorized to access ${entityType}`);
    logger.warn(`User ${userId} is not authorized to access ${entityType} ${entity}`);
  }
}
