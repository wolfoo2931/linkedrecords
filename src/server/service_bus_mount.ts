/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import http from 'http';
import clientServerBus from '../../lib/client-server-bus/server';
import IsLogger from '../../lib/is_logger';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import { getAttributeByMessage } from './middleware/attribute';
import Fact from '../facts/server';
import { uid } from './controllers/userinfo_controller';

class WSAccessControl {
  app: any;

  constructor(app) {
    this.app = app;
  }

  public verifyAuthenticated(
    request: http.IncomingMessage,
  ): Promise<string> {
    const response = new http.ServerResponse(request);

    return new Promise((resolve, reject) => {
      this.app.handle(request, response, () => {
        const { oidc } = request as any;

        if (!oidc || !oidc.isAuthenticated() || !oidc?.user?.sub) {
          reject(new Error('No user id found in request'));
        } else {
          resolve(uid(request));
        }
      });
    });
  }

  public async verifyAuthorizedChannelJoin(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    return Fact.isAuthorizedToReadPayload(channel, userId, request.log as unknown as IsLogger);
  }

  public async verifyAuthorizedSend(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    return Fact.isAuthorizedToModifyPayload(channel, userId, request.log as unknown as IsLogger);
  }
}

export default async function mountServiceBus(httpServer, app) {
  const sendMessage = await clientServerBus(httpServer, app, new WSAccessControl(app), async (attributeId, change, request) => {
    const attribute = getAttributeByMessage(attributeId, change, request.log as unknown as IsLogger);

    const committedChange: SerializedChangeWithMetadata<any> = await attribute.change(
      change,
    );

    console.log('----------->', attributeId, JSON.stringify(committedChange));
    sendMessage(attributeId, committedChange);
  });
}
