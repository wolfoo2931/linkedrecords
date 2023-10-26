export default function errorHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (ex) {
      console.log('custom logger', ex);
      req.log.error(ex);
      res.sendStatus(500);
    }
  };
}
