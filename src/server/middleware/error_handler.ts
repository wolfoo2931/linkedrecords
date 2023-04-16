export default function errorHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch(ex) {
      res.sendStatus(500);
      req.log.error(ex);
    }
  }
}