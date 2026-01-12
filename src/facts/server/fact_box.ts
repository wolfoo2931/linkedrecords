/* eslint-disable import/no-cycle */
import Fact from '.';
import IsLogger from '../../../lib/is_logger';
import PgPoolWithLog from '../../../lib/pg-log';
import cache from '../../server/cache';

export default class FactBox {
  id: number;

  graphId: number | null;

  constructor(id: number, graphId: number | null) {
    this.id = id;
    this.graphId = graphId;
  }

  public static async getNewFactBoxId(logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);
    const newFactBoxIdResult = await pool.query("SELECT nextval('users__id_seq') as id");

    return newFactBoxIdResult.rows[0].id;
  }

  public static async getNewGraphId(logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);
    const newFactBoxIdResult = await pool.query("SELECT nextval('graph_id') as id");

    return newFactBoxIdResult.rows[0].id;
  }

  static async getFactBoxPlacement(userId: string, fact: Fact, logger: IsLogger): Promise<FactBox> {
    const internalUserId = await FactBox.getInternalUserId(userId, logger);

    if (fact.subject.startsWith('us-')) {
      // We end up here when e.g. when
      // us-82054609511ad4ead53fceedf9c2f6bb $isHostOf kv-01943bcc-5db6-7386-9d63-246e0d0f3185
      const objectFactPlacement = await FactBox.getFactPlacementOf(fact.object, userId, logger);
      const internalSubId = await FactBox.getInternalUserId(fact.subject, logger);

      if (!objectFactPlacement.graphId) {
        // this is not a private graph but a shared fact box
        // we just have to assign the userId given as subject to the fact box
        await FactBox.ensureUserIsAssignedToFactBox(internalSubId, objectFactPlacement, logger);
        return objectFactPlacement;
      }

      if (objectFactPlacement.id === internalSubId) {
        return objectFactPlacement;
      }

      const newFactBox = await FactBox.moveUserGraphToNewFactBox(
        objectFactPlacement,
        logger,
        [internalUserId, internalSubId],
      );

      return newFactBox;
    }

    if (fact.object.startsWith('us-')) {
      if (userId !== fact.object) {
        throw new Error('User can only use its own id as object');
      }

      const subjectFactPlacement = await FactBox.getFactPlacementOf(fact.subject, userId, logger);

      if (!subjectFactPlacement.graphId) {
        await FactBox.ensureUserIsAssignedToFactBox(internalUserId, subjectFactPlacement, logger);
        return subjectFactPlacement;
      }

      return subjectFactPlacement;
    }

    const [factBoxSubject, factBoxObject] = await Promise.all([
      FactBox.getFactPlacementOf(fact.subject, userId, logger),
      FactBox.getFactPlacementOf(fact.object, userId, logger),
    ]);

    // The object is a term so the fact goes into the fact box of the subject
    if (factBoxObject.id === 0) {
      return factBoxSubject;
    }

    // the subject is a term, so it goes into the term box
    if (factBoxSubject.id === 0) {
      return new FactBox(0, null);
    }

    // a) both nodes are from the user space
    //    -> getFactPlacementOf will make sure that it is the same user
    if (factBoxSubject.graphId && factBoxObject.graphId) {
      // Both nodes belong to the same graph of the same user
      if (factBoxSubject.id === internalUserId
        && factBoxObject.id === internalUserId
        && factBoxSubject.graphId === factBoxObject.graphId) {
        return factBoxObject;
      }

      // The nodes belong to the same user but different graphs
      if (factBoxSubject.id === internalUserId && factBoxObject.id === internalUserId) {
        const userGraph = await FactBox.mergeUserGraphs(factBoxSubject, factBoxObject, logger);
        return new FactBox(internalUserId, userGraph);
      }

      throw new Error('Unexpected error while trying to determine fact box id');
    }

    // b) None of the nodes is from a private graph
    if (!factBoxSubject.graphId && !factBoxObject.graphId) {
      const boxId = await FactBox.mergeFactBoxes(factBoxSubject.id, factBoxObject.id, logger);
      return new FactBox(boxId, null);
    }

    // c) subject is a private graph and object is a fact box
    if (!factBoxSubject.graphId && factBoxObject.graphId) {
      const boxId = await FactBox.mergeUserGraphToFactBox(factBoxObject, factBoxSubject, logger);
      return new FactBox(boxId, null);
    }

    // d) subject is a fact box and object is a graph box
    if (factBoxSubject.graphId && !factBoxObject.graphId) {
      const boxId = await FactBox.mergeUserGraphToFactBox(factBoxSubject, factBoxObject, logger);
      return new FactBox(boxId, null);
    }

    throw new Error('Unexpected error while trying to determine fact box id');
  }

  public static async isUserAssociatedToFactBox(
    factBoxId: number,
    userId: string,
    logger: IsLogger,
  ): Promise<boolean> {
    const pool = new PgPoolWithLog(logger);

    const internalUserId = await this.getInternalUserId(userId, logger);

    if (factBoxId === internalUserId) {
      return true;
    }

    return pool.findAny(`
      SELECT DISTINCT users.id
      FROM users_fact_boxes, users
      WHERE users_fact_boxes.user_id = users._id
      AND users_fact_boxes.fact_box_id=$1
      AND users.id=$2`, [factBoxId, userId]);
  }

  public static async getAllAssociatedUsersByNode(nodeId: string, logger: IsLogger) {
    const pool = new PgPoolWithLog(logger);

    const result = await pool.query(`
      SELECT DISTINCT users.id
      FROM users_fact_boxes, users
      WHERE users_fact_boxes.user_id = users._id
      AND users_fact_boxes.fact_box_id IN (SELECT fact_box_id FROM facts WHERE subject=$1 OR object=$1 LIMIT 1)`, [nodeId]);

    return result.rows.map((r) => r.id.trim());
  }

  public static async getInternalUserId(userid: string, logger: IsLogger): Promise<number> {
    const hit = cache.get(`internalUserId/${userid}`);

    if (hit) {
      return hit;
    }

    const pool = new PgPoolWithLog(logger);
    const result = await pool.query('SELECT _id as internal_user_id FROM users WHERE id=$1', [userid]);

    if (!result.rows[0]) {
      throw new Error(`User with id ${userid} does not exist`);
    }

    if (result) {
      cache.set(`internalUserId/${userid}`, result.rows[0].internal_user_id);
    }

    return result.rows[0].internal_user_id;
  }

  private static async getFactPlacementOf(
    nodeId: string,
    userId: string,
    logger: IsLogger,
  ): Promise<FactBox> {
    const pool = new PgPoolWithLog(logger);

    if (nodeId.startsWith('us-')) {
      if (nodeId !== userId) {
        throw new Error('Not allowed to access fact box of another user');
      }

      return {
        id: await FactBox.getInternalUserId(nodeId, logger),
        graphId: null, // Maybe we need another value here: like 0, or -1
      };
    }

    if (await Fact.isKnownTerm(nodeId, logger)) {
      return {
        id: 0,
        graphId: null,
      };
    }

    const result = await pool.query('SELECT fact_box_id, graph_id FROM facts WHERE subject=$1 OR object=$1 LIMIT 1', [nodeId]);

    if (!result.rows[0]) {
      return {
        id: await FactBox.getInternalUserId(userId, logger),
        graphId: await FactBox.getNewGraphId(logger),
      };
    }

    return {
      id: result.rows[0].fact_box_id,
      graphId: result.rows[0].graph_id,
    };
  }

  private static async ensureUserIsAssignedToFactBox(
    internalUserId: number,
    factBox: FactBox,
    logger: IsLogger,
  ) {
    const pool = new PgPoolWithLog(logger);

    if (await pool.findAny('SELECT * FROM users_fact_boxes WHERE fact_box_id=$1 AND fact_box_id=$2', [factBox.id, internalUserId])) {
      return;
    }

    cache.invalidate(`factScopeByUser/${internalUserId}`);

    await pool.query('INSERT INTO users_fact_boxes (fact_box_id, user_id) VALUES ($1, $2)', [factBox.id, internalUserId]);
  }

  private static async moveUserGraphToNewFactBox(
    graphBox: FactBox,
    logger: IsLogger,
    users: number[],
  ): Promise<FactBox> {
    const pool = new PgPoolWithLog(logger);
    const factBoxId = await FactBox.getNewFactBoxId(logger);

    if (!graphBox.id || !graphBox.graphId) {
      throw new Error('Cannot migration graph to new fact box as graphBox does not has an id');
    }

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1, graph_id=NULL WHERE graph_id=$2', [factBoxId, graphBox.graphId]),
      ...users.map((userId) => pool.query('INSERT INTO users_fact_boxes (fact_box_id, user_id) VALUES ($1, $2);', [factBoxId, userId])),
    ]);

    users.map((userId) => cache.invalidate(`factScopeByUser/${userId}`));

    return {
      id: factBoxId,
      graphId: null,
    };
  }

  // TODO: make sure the smaller graph box is merged into the bigger graph box;
  private static async mergeUserGraphs(
    gb1: FactBox,
    gb2: FactBox,
    logger: IsLogger,
  ): Promise<number> {
    const pool = new PgPoolWithLog(logger);

    if (!gb1.graphId || !gb2.graphId) {
      logger.warn(`Cannot merge a user graph: ${JSON.stringify(gb1)} and ${JSON.stringify(gb2)}`);
      throw new Error('Cannot merge a user graphs. At least one graph box is invalid');
    }

    await pool.query('UPDATE facts SET graph_id=$1 WHERE graph_id=$2', [gb1.graphId, gb2.graphId]);

    return gb1.graphId;
  }

  private static async mergeUserGraphToFactBox(
    graphBox: FactBox,
    factBox: FactBox,
    logger: IsLogger,
  ): Promise<number> {
    const pool = new PgPoolWithLog(logger);

    if (!graphBox.graphId && !graphBox.id) {
      logger.warn(`Cannot merge a user graph without a fact box. Graph box is invalid: ${JSON.stringify(graphBox)}`);
      throw new Error('Cannot merge a user graph without a fact box. Graph box is invalid');
    }

    if (factBox.graphId || !factBox.id) {
      logger.warn(`Cannot merge a user graph without a fact box. Fact box is invalid: ${JSON.stringify(factBox)}`);
      throw new Error('Cannot merge a user graph without a fact box. Fact box is invalid');
    }

    if (!graphBox.graphId || !factBox.id || !graphBox.id) {
      logger.warn(`Unexpected error when merging user graph to fact box, fact box is missing a value: FactBox: ${JSON.stringify(factBox)}, GraphBox: ${JSON.stringify(graphBox)}`);
      throw new Error('Unexpected error when merging user graph to fact box, fact box is missing a value');
    }

    cache.invalidate(`factScopeByUser/${graphBox.id}`);

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1, graph_id=NULL WHERE fact_box_id=$2 AND graph_id=$3', [factBox.id, graphBox.id, graphBox.graphId]),
      pool.query('UPDATE users_fact_boxes SET fact_box_id=$1 WHERE fact_box_id=$2', [factBox.id, graphBox.id]),
      FactBox.ensureUserIsAssignedToFactBox(graphBox.id, factBox, logger),
    ]);

    return factBox.id;
  }

  // TODO: make sure the smaller fact box is merged into the bigger fact box;
  private static async mergeFactBoxes(
    node1Id: number | undefined,
    node2Id: number | undefined,
    logger: IsLogger,
  ): Promise<number> {
    if (!node1Id && node2Id) {
      return node2Id;
    }

    if (!node2Id && node1Id) {
      return node1Id;
    }

    if (!node1Id && !node1Id) {
      throw new Error('Cannot merge fact boxes without ids');
    }

    if (node1Id === 0) {
      // eslint-disable-next-line no-param-reassign
      node1Id = node2Id;
      // eslint-disable-next-line no-param-reassign
      node2Id = 0;
    }

    const pool = new PgPoolWithLog(logger);

    const usersOfOldFactBox = await pool.query('SELECT user_id FROM users_fact_boxes WHERE fact_box_id=$1', [node1Id]);

    usersOfOldFactBox.rows.forEach((row) => {
      cache.invalidate(`factScopeByUser/${row.user_id}`);
    });

    await Promise.all([
      pool.query('UPDATE facts SET fact_box_id=$1 WHERE fact_box_id=$2', [node2Id, node1Id]),
      pool.query('UPDATE users_fact_boxes SET fact_box_id=$1 WHERE fact_box_id=$2', [node2Id, node1Id]),
    ]);

    if (!node2Id) {
      throw new Error('Unexpected error while merging fact boxes');
    }

    return node2Id;
  }
}
