export default function errorHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (ex: any) {
      if (ex?.message?.startsWith('Not enough storage space available')) {
        res.status(403).send('Not enough storage space available');
      } else {
        req.log.error(ex);
        res.sendStatus(500);
      }
    }
  };
}
