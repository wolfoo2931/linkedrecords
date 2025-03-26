import crypto from 'crypto';
import Quota, { QuotaEvent } from '../quota';

function readBody(req): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function safeCompare(str1, str2) {
  return crypto.timingSafeEqual(new Uint8Array(Buffer.from(str1, 'utf-8')), new Uint8Array(Buffer.from(str2, 'utf-8')));
}

export default class PaddlePaymentProvider {
  secretKey: string;

  constructor() {
    if (!process.env['PADDLE_NOTIFICATION_SECRET']) {
      throw new Error('this linkedrecords instance is not configured to handle paddle callbacks. PADDLE_NOTIFICATION_SECRET env var needs to be provided.');
    }

    this.secretKey = process.env['PADDLE_NOTIFICATION_SECRET'];
  }

  getSignature(payload: string, timestamp?: string): string {
    const ts = timestamp || Math.round((Date.now() / 1000));
    const toBeHashed = `${ts}:${payload}`;

    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(toBeHashed);
    const hash = hmac.digest('hex');
    return `ts=${ts};h1=${hash}`;
  }

  async handlePaddleEvent(req, res) {
    const payload: any = await this.getPaddlePayload(req, res);

    if (!payload) {
      return;
    }

    let quotaEvent;

    if (payload.event_type === 'subscription.created') {
      quotaEvent = PaddlePaymentProvider.handlePaddleSubscriptionCreated(payload, req, res);
    }

    if (!quotaEvent) {
      req.log.warn(`quota event does not match an event handler: ${JSON.stringify(payload)}`);
      res.sendStatus(422);
      return;
    }

    const quota = new Quota(quotaEvent.nodeId, req.logger);
    await quota.set(quotaEvent.totalStorageAvailable, 'paddle', JSON.stringify(payload));

    res.send(quotaEvent);
  }

  async getPaddlePayload(req, res): Promise<object | undefined> {
    const signature: string = req.headers['paddle-signature'];

    if (!signature) {
      req.log.warn('no signature header present in paddle callback');
      res.sendStatus(422);
      return undefined;
    }

    const rawRequestBody = await readBody(req);
    const rawTs = signature.split(';')[0];

    if (!rawTs) {
      req.log.warn('paddle signature header does not contain timestamp');
      res.sendStatus(422);
      return undefined;
    }

    const ts = rawTs.split('=')[1];

    if (!ts) {
      req.log.warn('paddle signature header does not contain valid timestamp');
      res.sendStatus(422);
      return undefined;
    }

    if (!safeCompare(this.getSignature(rawRequestBody, ts), signature)) {
      req.log.error('invalid paddle signature detected');
      res.sendStatus(422);
      return undefined;
    }

    return JSON.parse(rawRequestBody);
  }

  static handlePaddleSubscriptionCreated(payload, req, res): QuotaEvent | undefined {
    const nodeId = payload
      ?.data
      ?.custom_data
      ?.nodeId;

    const totalStorageAvailableAsString = payload
      ?.data
      ?.items[0]
      ?.product.custom_data
      ?.total_storage_available;

    req.log.info(`handle paddle subscription created (node: ${nodeId}, storage: ${totalStorageAvailableAsString}) - ${JSON.stringify(payload)}`);

    if (!nodeId || !totalStorageAvailableAsString) {
      req.log.warn('Error updating quota: nodeId or totalStorageAvailableAsString are not available');
      res.sendStatus(422);
      return undefined;
    }

    const totalStorageAvailable = parseInt(totalStorageAvailableAsString, 10);

    if (Number.isNaN(totalStorageAvailable)) {
      req.log.warn('Error updating quota: totalStorageAvailable is not a valid number. Check Paddle product configuration.');
      res.sendStatus(422);
      return undefined;
    }

    return {
      nodeId,
      totalStorageAvailable,
      paymentProvider: 'paddle',
    };
  }
}
