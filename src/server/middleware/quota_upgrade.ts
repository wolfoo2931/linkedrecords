import { Request, Response } from 'express';
import PaddlePaymentProvider from '../payment_provider/paddle';
import Quota from '../quota';

export default function quotaUpgrade() {
  return async (req: Request, res: Response) => {
    if (req.method.toLowerCase() === 'post' && req.path.toLowerCase() === '/paddle') {
      try {
        const paddleController = new PaddlePaymentProvider();
        const quotaEvent = await paddleController.handleCallback(req, res);

        if (!quotaEvent) {
          req.log.warn('quota event does not match an event handler');
          res.sendStatus(422);
        } else {
          const quota = new Quota(quotaEvent.nodeId, req.log);
          await quota.set(
            quotaEvent.totalStorageAvailable,
            quotaEvent.providerId,
            quotaEvent.paymentProvider,
            quotaEvent.providerPayload,
            quotaEvent.validFrom,
          );

          res.send(quotaEvent);
        }
      } catch (error) {
        req.log?.error(`Error handling payment provider callback: ${error}`);
        res.status(500).json({ error: 'Internal server error processing payment notification' });
      }
    } else {
      res.sendStatus(404);
    }
  };
}
