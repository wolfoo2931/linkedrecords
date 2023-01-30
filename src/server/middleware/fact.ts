import Fact from '../../facts/server';

export default function factMiddleware() {
  return (req, res, next) => {
    req.Fact = Fact;
    res.Fact = Fact;
    next();
  };
}
