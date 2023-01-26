import IsSerializable from './is_serializable';

export default class SerializedChangeWithMetadata<Change extends IsSerializable> {
  public attributeId: string;

  public actorId: string;

  public clientId: string;

  public change: Change;

  public updatedAt: Date | undefined;

  constructor(
    attributeId: string,
    actorId: string,
    clientId: string,
    change: Change,
    updatedAt: Date | undefined = undefined,
  ) {
    this.attributeId = attributeId;
    this.actorId = actorId;
    this.clientId = clientId;
    this.change = change;
    this.updatedAt = updatedAt;
  }

  toJSON(): any {
    return {
      attributeId: this.attributeId,
      change: this.change.toJSON(),
      actorId: this.actorId,
      clientId: this.clientId,
      updatedAt: this.updatedAt,
    };
  }
}
