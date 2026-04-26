/* eslint-disable class-methods-use-this, import/no-cycle */

import { Client } from 'minio';
import { text } from 'stream/consumers';
import assert from 'assert';
import IsRecordStorage from '../../abstract/is_record_storage';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { RecordSnapshot, RecordChangeCriteria, RecordSnapshotReadable } from '../types';

export default class AttributeStorage implements IsRecordStorage {
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

  async getSizeInBytesForAllRecords(nodes: string[]): Promise<number> {
    const sizes = await Promise.all(nodes.map((node) => this.getObjectSize(node)));
    return sizes.reduce((acc, x) => acc + x, 0);
  }

  async createAllRecords(
    attrs: { recordId: string, actorId: string, value: string | Buffer }[],
  ) : Promise<{ id: string }[]> {
    if (!attrs.length) {
      return [];
    }

    return Promise.all(
      attrs.map((attr) => this.createRecord(attr.recordId, attr.actorId, attr.value)),
    );
  }

  async createRecord(
    recordId: string,
    actorId: string,
    value: string | Buffer,
  ) : Promise<{ id: string }> {
    if (await Fact.areKnownSubjects([recordId], this.logger)) {
      throw new Error('recordId is invalid');
    }

    return this.createRecordWithoutFactsCheck(
      recordId,
      actorId,
      value,
    );
  }

  async createRecordWithoutFactsCheck(
    recordId: string,
    actorId: string,
    value: string | Buffer,
  ) : Promise<{ id: string }> {
    const now = new Date();

    await this.minioClient.putObject(
      this.bucketName,
      recordId,
      value,
      undefined,
      {
        actorId, createdAt: now, updatedAt: now,
      },
    );

    return { id: recordId };
  }

  async getRecordLatestSnapshot(
    recordId: string,
    actorId: string,
    { inAuthorizedContext = false }: RecordChangeCriteria = {},
  ) : Promise<RecordSnapshot> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(recordId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'record', recordId, this.logger);
      }
    }

    const [dataStream, stats] = await Promise.all([
      this.minioClient.getObject(this.bucketName, recordId),
      this.minioClient.statObject(this.bucketName, recordId),
    ]);

    return {
      id: recordId,
      value: await text(dataStream),
      changeId: '2147483647',
      actorId: stats.metaData['actorId'] || stats.metaData['actorid'],
      createdAt: new Date(stats.metaData['createdAt'] || stats.metaData['createdat']).getTime(),
      updatedAt: new Date(stats.metaData['updatedAt'] || stats.metaData['updatedat']).getTime(),
    };
  }

  async getRecordLatestSnapshotAsReadable(
    recordId: string,
    actorId: string,
    { inAuthorizedContext = false }: RecordChangeCriteria = {},
  ) : Promise<RecordSnapshotReadable> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(recordId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'record', recordId, this.logger);
      }
    }

    const [dataStream, stats] = await Promise.all([
      this.minioClient.getObject(this.bucketName, recordId),
      this.minioClient.statObject(this.bucketName, recordId),
    ]);

    return {
      value: dataStream,
      changeId: '2147483647',
      actorId: stats.metaData['actorId'] || stats.metaData['actorid'],
      createdAt: new Date(stats.metaData['createdAt'] || stats.metaData['createdat']).getTime(),
      updatedAt: new Date(stats.metaData['updatedAt'] || stats.metaData['updatedat']).getTime(),
    };
  }

  async getRecordChanges() : Promise<Array<any>> {
    return [];
  }

  async insertRecordChange() : Promise<{ id: string, updatedAt: Date }> {
    throw new Error('insertRecordChange is not implemented for psql storage, use psql_with_history instead');
  }

  async insertRecordSnapshot(
    recordId: string,
    actorId: string,
    value: string | Buffer,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(recordId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'record', recordId, this.logger);
    }

    const updatedAt = new Date();

    assert(this.minioClient, 'S3 configuration was not found in the environment variables!');
    assert(this.bucketName, 'S3 configuration was not found in the environment variables!');

    await this.minioClient.putObject(
      this.bucketName,
      recordId,
      value,
      undefined,
      {
        actorId, createdAt: new Date(), updatedAt,
      },
    );

    return {
      id: recordId,
      updatedAt,
    };
  }

  private async getObjectSize(nodeId: string): Promise<number> {
    try {
      const stats = await this.minioClient.statObject(this.bucketName, nodeId);
      const { size } = stats;
      return size || 0;
    } catch (ex: any) {
      if (ex.code === 'NotFound') {
        return 0;
      }

      throw ex;
    }
  }
}
