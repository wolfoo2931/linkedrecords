import { Router, urlencoded } from 'express';
import {
  discoveryHandler,
  jwksHandler,
  authorizeGetHandler,
  authorizePostHandler,
  tokenHandler,
  userinfoHandler,
} from './endpoints';
import { initializeKeys } from './keys';

const router = Router();

// Parse URL-encoded bodies for form submissions
router.use(urlencoded({ extended: true }));

// OIDC Discovery
router.get('/.well-known/openid-configuration', discoveryHandler);

// JWKS endpoint
router.get('/jwks', jwksHandler);

// Authorization endpoint
router.get('/authorize', authorizeGetHandler);
router.post('/authorize', authorizePostHandler);

// Token endpoint
router.post('/token', tokenHandler);

// Userinfo endpoint
router.get('/userinfo', userinfoHandler);

export { initializeKeys };
export default router;
