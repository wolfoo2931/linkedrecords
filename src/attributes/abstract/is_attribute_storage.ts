export default interface IsAttributeStorage {
  createAttributeWithoutFactsCheck(
    attributeId: string,
    actorId: string,
    value: string
  ) : Promise<{ id: string }>;

  createAttribute(
    attributeId: string,
    actorId: string,
    value: string
  ) : Promise<{ id: string }>;

  createAllAttributes(
    attr: { attributeId: string, actorId: string, value: string }[]
  ) : Promise<{ id: string }[]>;

  getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    criteria: { maxChangeId?: string, inAuthorizedContext?: boolean }
  ) : Promise<{
    value: string,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  getAttributeChanges(
    attributeId: string,
    actorId: string,
    criteria: { inAuthorizedContext?: boolean, minChangeId?: string, maxChangeId?: string }
  ) : Promise<Array<any>>;

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string
  ) : Promise<{ id: string, updatedAt: Date }>;

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
    changeId?: string,
  ) : Promise<{ id: string, updatedAt: Date }>;

  getSizeInBytesForAllAccountableAttributes(
    nodes: string[],
  ): Promise<number>;
}
