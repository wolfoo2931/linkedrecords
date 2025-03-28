/* eslint-disable import/no-cycle */
import AbstractPaymentProvider from './abstract_provider';
import PaddlePaymentProvider from './paddle';

const providers = [PaddlePaymentProvider];

export default class PaymentProvider {
  static getById(paymentProviderId: string): AbstractPaymentProvider {
    const Provider = providers.find((p) => p.paymentProviderId === paymentProviderId);

    if (!Provider) {
      throw new Error(`Unknown payment provider: ${paymentProviderId}`);
    }

    return new Provider();
  }
}
