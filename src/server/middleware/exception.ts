export default function exeptionMiddleware() {
  return (req, res, next) => {
    try {
      next();
    } catch (ex) {
      console.error('Exception catched in middleware', ex);
      res.status(500).send({ error: 'Unkown server error' });
    }
  };
}
