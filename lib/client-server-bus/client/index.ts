// eslint-disable-next-line import/no-cycle
import ClientServerBus from '../drivers/server-side-events/client';

export default ClientServerBus;

export interface IsSubscribable {
  subscribe(
    url: string,
    channel: string,
    handler: (data: any) => any
  ): Promise<[string, (data: any) => any]>;

  unsubscribe([subId, handler]: [string, (data: any) => any]);

  unsubscribeAll();
}
