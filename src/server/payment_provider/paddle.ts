/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-cycle */
import crypto from 'crypto';
import assert from 'assert';
import Quota, { QuotaEvent } from '../quota';
import safeCompare from '../../../lib/utils/safe_compare';
import readBody from '../../../lib/utils/read_body';
import AbstractPaymentProvider from './abstract_provider';

export default class PaddlePaymentProvider extends AbstractPaymentProvider {
  secretKey: string;

  apiKey: string;

  paddleURL: string;

  static paymentProviderId: string = 'paddle';

  constructor() {
    super();
    const missingConfig: string[] = [];

    if (!process.env['PADDLE_NOTIFICATION_SECRET']) {
      missingConfig.push('PADDLE_NOTIFICATION_SECRET');
    }

    if (!process.env['PADDLE_API_KEY']) {
      missingConfig.push('PADDLE_API_KEY');
    }

    if (!process.env['PADDLE_API_URL']) {
      missingConfig.push('PADDLE_API_URL');
    }

    if (missingConfig.length) {
      throw new Error(`this linkedrecords instance is not configured to handle paddle callbacks. The following configurations are missing: ${missingConfig.join(', ')}`);
    }

    assert(process.env['PADDLE_API_URL']);
    assert(process.env['PADDLE_API_KEY']);
    assert(process.env['PADDLE_NOTIFICATION_SECRET']);

    this.paddleURL = process.env['PADDLE_API_URL'];
    this.apiKey = process.env['PADDLE_API_KEY'];
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

  async handleCallback(req, res) {
    const payload: any = await this.getPaddlePayload(req, res);

    if (!payload) {
      return;
    }

    let quotaEvent;

    if (payload.event_type === 'subscription.created') {
      quotaEvent = await this.handlePaddleSubscriptionCreated(payload, req, res);
    } else if (payload.event_type === 'subscription.updated' && payload?.data?.scheduled_change?.action === 'cancel') {
      quotaEvent = await this.handlePaddleSubscriptionCanceled(payload, req, res);
    }

    if (!quotaEvent) {
      req.log.warn(`quota event does not match an event handler: ${JSON.stringify(payload)}`);
      res.sendStatus(422);
      return;
    }

    const quota = new Quota(quotaEvent.nodeId, req.logger);
    await quota.set(quotaEvent.totalStorageAvailable, quotaEvent.providerId, 'paddle', JSON.stringify(payload), quotaEvent.validFrom);

    res.send(quotaEvent);
  }

  async loadDetailsForAccountee(subscriptionId: string): Promise<object> {
    const response = await fetch(`${this.paddleURL}/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    return response.json();
  }

  private async getPaddlePayload(req, res): Promise<object | undefined> {
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

  private handlePaddleSubscriptionCreated(payload, req, res): QuotaEvent | undefined {
    const nodeId = payload
      ?.data
      ?.custom_data
      ?.nodeId;

    const providerId = payload
      ?.data
      ?.id;

    const totalStorageAvailableAsString = payload
      ?.data
      ?.items?.[0]
      ?.product.custom_data
      ?.total_storage_available;

    req.log.info(`handle paddle subscription created (node: ${nodeId}, storage: ${totalStorageAvailableAsString}) - ${JSON.stringify(payload)}`);

    if (!nodeId || !totalStorageAvailableAsString || !providerId) {
      req.log.error('Error updating quota: nodeId, subscriptionId and/or totalStorageAvailableAsString are not available');
      res.sendStatus(422);
      return undefined;
    }

    let totalStorageAvailable;

    try {
      totalStorageAvailable = Number.parseInt(totalStorageAvailableAsString, 10);
    } catch (ex) {
      req.log.error('Error parsing totalStorageAvailable');
    }

    if (totalStorageAvailable === undefined || Number.isNaN(totalStorageAvailable)) {
      req.log.warn('Error updating quota: totalStorageAvailable is not a valid number. Check Paddle product configuration.');
      res.sendStatus(422);
      return undefined;
    }

    return {
      nodeId,
      totalStorageAvailable,
      providerId,
      paymentProvider: PaddlePaymentProvider.paymentProviderId,
    };
  }

  private handlePaddleSubscriptionCanceled(payload, req, res): QuotaEvent | undefined {
    const nodeId = payload
      ?.data
      ?.custom_data
      ?.nodeId;

    const providerId = payload
      ?.data
      ?.id;

    const totalStorageAvailable = null;

    const validFrom = new Date(payload?.data?.scheduled_change?.effective_at);

    req.log.info(`handle paddle subscription canceled (node: ${nodeId}, storage: ${totalStorageAvailable}) - ${JSON.stringify(payload)}`);

    if (!nodeId || !providerId) {
      req.log.error('Error updating quota: nodeId and/or subscriptionId are not available');
      res.sendStatus(422);
      return undefined;
    }

    return {
      nodeId,
      totalStorageAvailable,
      providerId,
      validFrom,
      paymentProvider: PaddlePaymentProvider.paymentProviderId,
    };
  }
}
