/* eslint-disable class-methods-use-this */

import { Client } from 'minio';
import { Readable } from 'stream';
import assert from 'assert';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { AttributeSnapshot, AttributeChangeCriteria } from '../types';
import PsqlAttributeStorage from '../psql';

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function isS3Configured() {
  return !!process.env['S3_ENDPOINT'];
}

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  psqlStorage: PsqlAttributeStorage;

  minioClient?: Client;

  bucketName?: string;

  constructor(logger: IsLogger) {
    this.logger = logger;

    this.psqlStorage = new PsqlAttributeStorage(this.logger, 'bl');

    if (isS3Configured()) {
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
  }

  async getSizeInBytesForAllAttributes(nodes: string[]): Promise<number> {
    return this.psqlStorage.getSizeInBytesForAllAttributes(nodes);
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
    const toBeStored = await this.getRecordValueInDB(attributeId, actorId, value);

    await this.psqlStorage.createAttributeWithoutFactsCheck(
      attributeId,
      actorId,
      toBeStored,
      Buffer.byteLength(value, 'utf8'),
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

    let value;

    const dbEntry = await this
      .psqlStorage
      .getAttributeLatestSnapshot(attributeId, actorId, { inAuthorizedContext });

    if (dbEntry.value.startsWith('s3://')) {
      const s3Details = JSON.parse(dbEntry.value.replace(/^s3:\/\//, ''));

      assert(this.minioClient, 'S3 configuration was not found in the environment variables!');
      assert(s3Details.bucket, 'Could not find bucket name in s3 reference');
      assert(s3Details.object, 'Could not find object name in s3 reference');

      const dataStream = await this.minioClient.getObject(s3Details.bucket, s3Details.object);
      value = await streamToString(dataStream);
    } else {
      value = dbEntry.value;
    }

    return {
      value,
      changeId: '2147483647',
      actorId: dbEntry.actorId,
      createdAt: dbEntry.createdAt,
      updatedAt: dbEntry.updatedAt,
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

    const toBeStored = await this.getRecordValueInDB(attributeId, actorId, value);

    return this.psqlStorage.insertAttributeSnapshot(
      attributeId,
      actorId,
      toBeStored,
      undefined,
      Buffer.byteLength(value, 'utf8'),
    );
  }

  private async getRecordValueInDB(
    attributeId: string,
    actorId: string,
    value: string,
  ): Promise<string> {
    if (!isS3Configured()) {
      return value;
    }

    assert(this.minioClient, 'S3 configuration was not found in the environment variables!');
    assert(this.bucketName, 'S3 configuration was not found in the environment variables!');

    await this.minioClient.putObject(
      this.bucketName,
      attributeId,
      value,
      undefined,
      {
        actorId, createdAt: new Date(), updatedAt: new Date(),
      },
    );

    return `s3://${JSON.stringify({ bucket: this.bucketName, object: attributeId })}`;
  }
}
