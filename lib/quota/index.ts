import IsAttributeStorage from '../../src/attributes/abstract/is_attribute_storage';

export default async function getRemainingStorageSize(
  accounteeId: string,
  storage: IsAttributeStorage,
): Promise<number> {
  const mb = 1048576;

  const defaultStorageSizeQuota = process.env['DEFAULT_STORAGE_SIZE_QUOTA']
    ? parseInt(process.env['DEFAULT_STORAGE_SIZE_QUOTA'], 10) * mb
    : 500 * mb;

  const used = await storage.getSizeInBytesForAllAccountableAttributes(accounteeId);

  return defaultStorageSizeQuota - used;
}
