export default function errorHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (ex) {
      req.log.error(ex);
      res.sendStatus(500);
    }
  };
}
