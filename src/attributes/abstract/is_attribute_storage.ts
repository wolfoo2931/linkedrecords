export default interface IsAttributeStorage {
  createAttribute(
    attributeId: string,
    actorId: string,
    value: string
  ) : Promise<{ id: string }>;

  getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    criteria: { maxChangeId?: string }
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
  ) : Promise<{ id: string }>;
}
