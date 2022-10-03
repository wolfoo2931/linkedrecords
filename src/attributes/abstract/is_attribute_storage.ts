export default interface IsAttributeStorage {
  createAttribute(
    attributeId: string,
    actorId: string,
    value: string
  ) : Promise<{ id: string }>;

  getAttributeLatestSnapshot(
    attributeId: string,
    criteria: { maxChangeId?: string }
  ) : Promise<{ value: string, changeId: string, actorId: string }>;

  getAttributeChanges(
    attributeId: string,
    criteria: { minChangeId?: string, maxChangeId?: string }
  ) : Promise<Array<any>>;

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string
  ) : Promise<string>;

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string
  ) : Promise<{ id: string }>;
}
