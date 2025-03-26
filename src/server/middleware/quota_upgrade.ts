import PaddlePaymentProvider from '../payment_provider/paddle';

export default function quotaUpgrade() {
  return (req, res) => {
    if (req.method.toLowerCase() === 'post' && req.path.toLowerCase() === '/paddle') {
      const paddleController = new PaddlePaymentProvider();
      paddleController.handlePaddleEvent(req, res);
    } else {
      req.sendStatus(404);
    }
  };
}
