import AuthModeStrategy from './types';
import ConfidentialClientMode from './confidential';

const modes: Record<string, () => AuthModeStrategy> = {
  confidential: () => new ConfidentialClientMode(),
};

export default function getAuthModeStrategy(): AuthModeStrategy {
  const name = process.env['TEST_AUTH_MODE'] || 'confidential';
  const factory = modes[name];

  if (!factory) {
    throw new Error(`Unknown TEST_AUTH_MODE '${name}'. Available modes: ${Object.keys(modes).join(', ')}`);
  }

  return factory();
}
