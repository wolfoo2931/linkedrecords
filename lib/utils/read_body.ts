import { Request } from 'express';
import getRawBody from 'raw-body';

export default function readBody(req: Request): Promise<string> {
  return getRawBody(req).then((buf) => buf.toString());
}
