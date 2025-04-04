/* eslint-disable import/no-cycle */
import { Request, Response } from 'express';
import { QuotaEvent } from '../quota';

export default abstract class AbstractPaymentProvider {
  static paymentProviderId: string;

  abstract handleCallback(req: Request, res: Response): Promise<QuotaEvent | undefined>;

  abstract loadDetailsForAccountee(provider_id: string): Promise<Record<string, string>>;
}
