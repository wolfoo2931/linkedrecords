export default {
  async discovery(_req, res) {
    const authority = process.env['AUTH_ISSUER_BASE_URL'];

    if (!authority || typeof authority !== 'string' || !authority.trim()) {
      return res.status(500).send({ error: 'AUTH_ISSUER_BASE_URL is not configured' });
    }

    // Return without trailing slash for consistency
    const normalized = authority.replace(/\/$/, '');

    const result: Record<string, string> = {
      authority: normalized,
    };

    if (process.env['AUTH_CLIENT_ID']) {
      result['client_id'] = process.env['AUTH_CLIENT_ID'];
    }

    return res.status(200).send(result);
  },
};
