/* eslint-disable class-methods-use-this */

import { Client } from 'minio';
import { Readable } from 'stream';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { AttributeSnapshot, AttributeChangeCriteria } from '../types';

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  minioClient: Client;

  bucketName: string;

  constructor(logger: IsLogger) {
    this.logger = logger;

    ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_USE_SSL'].forEach((envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`Missing ${envVar} environment variable`);
      }
    });

    this.bucketName = process.env['S3_BUCKET']!;

    this.minioClient = new Client({
      endPoint: process.env['S3_ENDPOINT']!,
      port: parseInt(process.env['S3_PORT'] || '9000', 10),
      useSSL: process.env['S3_USE_SSL'] === 'true',
      accessKey: process.env['S3_ACCESS_KEY']!,
      secretKey: process.env['S3_SECRET_KEY']!,
    });
  }

  async getSizeInBytesForAllAttributes(nodes: string[]): Promise<number> {
    const stats = await Promise.all(
      nodes.map((nodeId) => this.minioClient.statObject(this.bucketName, nodeId)),
    );

    return stats.reduce((acc, stat) => {
      if (stat.size) {
        return acc + stat.size;
      }
      return acc;
    }, 0);
  }

  async createAllAttributes(
    attrs: { attributeId: string, actorId: string, value: string }[],
  ) : Promise<{ id: string }[]> {
    if (!attrs.length) {
      return [];
    }

    return Promise.all(
      attrs.map((attr) => this.createAttribute(attr.attributeId, attr.actorId, attr.value)),
    );
  }

  async createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    if (await Fact.areKnownSubjects([attributeId], this.logger)) {
      throw new Error('attributeId is invalid');
    }

    return this.createAttributeWithoutFactsCheck(
      attributeId,
      actorId,
      value,
    );
  }

  async createAttributeWithoutFactsCheck(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    await this.minioClient.putObject(
      this.bucketName,
      attributeId,
      value,
      undefined,
      {
        actorId, createdAt: new Date(), updatedAt: new Date(),
      },
    );

    return { id: attributeId };
  }

  async getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    { inAuthorizedContext = false }: AttributeChangeCriteria = {},
  ) : Promise<AttributeSnapshot> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(attributeId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
      }
    }

    const [stats, dataStream] = await Promise.all([
      this.minioClient.statObject(this.bucketName, attributeId),
      this.minioClient.getObject(this.bucketName, attributeId),
    ]);

    return {
      value: await streamToString(dataStream),
      changeId: '2147483647',
      actorId: stats.metaData['actorId'],
      createdAt: Date.parse(stats.metaData['createdAt']),
      updatedAt: Date.parse(stats.metaData['updatedAt']),
    };
  }

  async getAttributeChanges() : Promise<Array<any>> {
    return [];
  }

  async insertAttributeChange() : Promise<{ id: string, updatedAt: Date }> {
    throw new Error('insertAttributeChange is not implemented for psql storage, use psql_with_history instead');
  }

  async insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }

    const updatedAt = new Date();

    await this.minioClient.putObject(
      this.bucketName,
      attributeId,
      value,
      undefined,
      {
        actorId, createdAt: new Date(), updatedAt,
      },
    );

    return { id: '2147483647', updatedAt };
  }
}
