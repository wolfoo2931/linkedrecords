import { Request, Response } from 'express';
import PaddlePaymentProvider from '../payment_provider/paddle';
import Quota from '../quota';

export default function quotaUpgrade() {
  return async (req: Request, res: Response) => {
    if (req.method.toLowerCase() === 'post' && req.path.toLowerCase() === '/paddle') {
      const paddleController = new PaddlePaymentProvider();
      try {
        const quotaEvent = await paddleController.handleCallback(req, res);

        if (!quotaEvent) {
          req.log.warn('quota event does not match an event handler}');
          res.sendStatus(422);
        } else {
          const quota = new Quota(quotaEvent.nodeId, req.logger);
          await quota.set(
            quotaEvent.totalStorageAvailable,
            quotaEvent.providerId,
            'paddle',
            quotaEvent.providerPayload,
            quotaEvent.validFrom,
          );

          res.send(quotaEvent);
        }
      } catch (error) {
        req.log?.error('Error handling payment provider callback callback:', error);
        res.status(500).json({ error: 'Internal server error processing payment notification' });
      }
    } else {
      res.sendStatus(404);
    }
  };
}
