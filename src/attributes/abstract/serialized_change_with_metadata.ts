import IsSerializable from './is_serializable';

export default class SerializedChangeWithMetadata<Change extends IsSerializable> {
  public attributeId: string;

  public actorId: string;

  public clientId: string;

  public change: Change;

  constructor(attributeId: string, actorId: string, clientId: string, change: Change) {
    this.attributeId = attributeId;
    this.actorId = actorId;
    this.clientId = clientId;
    this.change = change;
  }

  toJSON(): any {
    return {
      attributeId: this.attributeId,
      change: this.change.toJSON(),
      actorId: this.actorId,
      clientId: this.clientId,
    };
  }
}
