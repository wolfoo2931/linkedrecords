/* eslint-disable class-methods-use-this */

import { Client } from 'minio';
import { text } from 'stream/consumers';
import assert from 'assert';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { AttributeSnapshot, AttributeChangeCriteria, AttributeSnapshotReadable } from '../types';

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  minioClient: Client;

  bucketName: string;

  static isConfigurationAvailable() {
    return !!process.env['S3_ENDPOINT'];
  }

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
    const sizes = await Promise.all(nodes.map((node) => this.getObjectSize(node)));
    return sizes.reduce((acc, x) => acc + x, 0);
  }

  async createAllAttributes(
    attrs: { attributeId: string, actorId: string, value: string | Buffer }[],
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
    value: string | Buffer,
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
    value: string | Buffer,
  ) : Promise<{ id: string }> {
    const now = new Date();

    await this.minioClient.putObject(
      this.bucketName,
      attributeId,
      value,
      undefined,
      {
        actorId, createdAt: now, updatedAt: now,
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

    const [dataStream, stats] = await Promise.all([
      this.minioClient.getObject(this.bucketName, attributeId),
      this.minioClient.statObject(this.bucketName, attributeId),
    ]);

    return {
      value: await text(dataStream),
      changeId: '2147483647',
      actorId: stats.metaData['actorId'] || stats.metaData['actorid'],
      createdAt: new Date(stats.metaData['createdAt'] || stats.metaData['createdat']).getTime(),
      updatedAt: new Date(stats.metaData['updatedAt'] || stats.metaData['updatedat']).getTime(),
    };
  }

  async getAttributeLatestSnapshotAsReadable(
    attributeId: string,
    actorId: string,
    { inAuthorizedContext = false }: AttributeChangeCriteria = {},
  ) : Promise<AttributeSnapshotReadable> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(attributeId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
      }
    }

    const [dataStream, stats] = await Promise.all([
      this.minioClient.getObject(this.bucketName, attributeId),
      this.minioClient.statObject(this.bucketName, attributeId),
    ]);

    return {
      value: dataStream,
      changeId: '2147483647',
      actorId: stats.metaData['actorId'] || stats.metaData['actorid'],
      createdAt: new Date(stats.metaData['createdAt'] || stats.metaData['createdat']).getTime(),
      updatedAt: new Date(stats.metaData['updatedAt'] || stats.metaData['updatedat']).getTime(),
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
    value: string | Buffer,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }

    const updatedAt = new Date();

    assert(this.minioClient, 'S3 configuration was not found in the environment variables!');
    assert(this.bucketName, 'S3 configuration was not found in the environment variables!');

    await this.minioClient.putObject(
      this.bucketName,
      attributeId,
      value,
      undefined,
      {
        actorId, createdAt: new Date(), updatedAt,
      },
    );

    return {
      id: attributeId,
      updatedAt,
    };
  }

  private async getObjectSize(nodeId: string): Promise<number> {
    // const cacheKey = `node-size-${nodeId}`;
    // const cached = cache.get(cacheKey);

    // if (cached) {
    //   return cached;
    // }

    try {
      const stats = await this.minioClient.statObject(this.bucketName, nodeId);
      const { size } = stats;

      // cache.set(cacheKey, size);
      return size || 0;
    } catch (ex: any) {
      if (ex.code === 'NotFound') {
        return 0;
      }

      throw ex;
    }
  }
}
