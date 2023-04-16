import morgan from 'morgan';

function jsonLogFormat(tokens, req, res) {
  return JSON.stringify({
    'remote-address': tokens['remote-addr'](req, res),
    time: tokens.date(req, res, 'iso'),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    'http-version': tokens['http-version'](req, res),
    'status-code': tokens.status(req, res),
    'content-length': tokens.res(req, res, 'content-length'),
    referrer: tokens.referrer(req, res),
    'user-agent': tokens['user-agent'](req, res),
    'response-time': tokens['response-time'](req, res),
  });
}

export default function logging() {
  return morgan(jsonLogFormat, { skip: (req) => req.method === 'OPTIONS' });
};