export type AttributeSnapshot = {
  value: string,
  changeId: string,
  actorId: string,
  createdAt: number,
  updatedAt: number
};

export type AttributeChange = {
  id: string,
  updatedAt: Date,
};

export type AttributeChangeCriteria = {
  inAuthorizedContext?: boolean,
  minChangeId?: string,
  maxChangeId?: string,
};
