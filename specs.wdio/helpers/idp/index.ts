import IdpAdapter from './types';
import Auth0 from './auth0';

const adapters: Record<string, () => IdpAdapter> = {
  auth0: () => new Auth0(),
};

export default function getIdpAdapter(): IdpAdapter {
  const name = process.env['TEST_IDP'] || 'auth0';
  const factory = adapters[name];

  if (!factory) {
    throw new Error(`Unknown TEST_IDP '${name}'. Available providers: ${Object.keys(adapters).join(', ')}`);
  }

  return factory();
}
