export default {
  async discovery(_req, res) {
    const authority = process.env['AUTH_ISSUER_BASE_URL'];

    if (!authority || typeof authority !== 'string' || !authority.trim()) {
      return res.status(500).send({ error: 'AUTH_ISSUER_BASE_URL is not configured' });
    }

    // Return without trailing slash for consistency
    const normalized = authority.replace(/\/$/, '');
    return res.status(200).send({ authority: normalized });
  },
};


