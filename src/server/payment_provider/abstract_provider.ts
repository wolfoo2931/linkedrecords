import { Request, Response } from 'express';

export default abstract class AbstractPaymentProvider {
  static paymentProviderId: string;

  abstract handleCallback(req: Request, res: Response): Promise<void>;

  abstract loadDetailsForAccountee(provider_id: string): Promise<object>;
}
