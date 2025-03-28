import PaddlePaymentProvider from '../payment_provider/paddle';

export default function quotaUpgrade() {
  return (req, res) => {
    if (req.method.toLowerCase() === 'post' && req.path.toLowerCase() === '/paddle') {
      const paddleController = new PaddlePaymentProvider();
      paddleController.handleCallback(req, res);
    } else {
      res.sendStatus(404);
    }
  };
}
