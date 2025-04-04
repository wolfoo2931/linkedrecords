import { Request, Response } from 'express';
import PaddlePaymentProvider from '../payment_provider/paddle';

export default function quotaUpgrade() {
  return (req: Request, res: Response) => {
    if (req.method.toLowerCase() === 'post' && req.path.toLowerCase() === '/paddle') {
      const paddleController = new PaddlePaymentProvider();
      try {
        paddleController.handleCallback(req, res);
      } catch (error) {
        req.log?.error('Error handling Paddle callback:', error);
        res.status(500).json({ error: 'Internal server error processing payment notification' });
      }
    } else {
      res.sendStatus(404);
    }
  };
}
