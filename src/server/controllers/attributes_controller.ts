/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
import { uuidv7 as uuid } from 'uuidv7';
import SerializedChangeWithMetadata from '../../attributes/abstract/serialized_change_with_metadata';
import QueryExecutor, { AttributeQuery } from '../../attributes/attribute_query';
import Fact from '../../facts/server';
import PgPoolWithLog from '../../../lib/pg-log';
import Quota from '../quota';
import AuthCache from '../../facts/server/auth_cache';
import IsLogger from '../../../lib/is_logger';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';

const attributePrefixMap = {
  KeyValueAttribute: 'kv',
  LongTextAttribute: 'l',
  BlobAttribute: 'bl',
};

export default class Controller {
  static async index(req, res) {
    const { clientId, actorId } = req;
    const query: AttributeQuery = JSON.parse(req.query.query);
    const queryExecutor = new QueryExecutor(req.log);
    const result = await queryExecutor.resolveToAttributes(
      query,
      clientId,
      actorId,
    );

    await AuthCache.cacheQueryResult(actorId, result, req.log);

    res.send(result);
  }

  static async getMembers(req, res) {
    if (!req.attribute) {
      throw new Error('Attribute is not initialized');
    }

    const pool = new PgPoolWithLog(req.log);

    const hasAccess = await Fact.hasAccess(req.hashedUserID, ['creator', 'host'], req.attribute.id, req.log);

    if (!hasAccess) {
      res.send({
        notVisibleToUser: true,
      });
      return;
    }

    const users = await pool.query(`SELECT id, username FROM users WHERE id IN
      (SELECT subject
      FROM facts
      WHERE subject LIKE 'us-%'
      AND predicate IN ('$isMemberOf', '$isHostOf', '$isAccountableFor')
      AND object=$1)`, [req.attribute.id]);

    res.send(
      users.rows.map((row) => ({
        id: row.id.trim(),
        username: row.username.trim(),
      })),
    );
  }

  static async createComposition(req, res) {
    const composition = req.body;

    const nameIdMap = Controller.getNamedAttributesToIdDictionaryAndAnnotateComposition(
      composition,
      req.clientId,
      req.actorId,
      req.log,
    );

    const resolvedFacts = Controller.resolvePlaceholdersInFactComposition(
      composition,
      req.actorId,
      req.log,
      nameIdMap,
    );

    const unauthorizedFacts = await Controller.findUnauthorizedFacts(
      resolvedFacts,
      req.hashedUserID,
      nameIdMap,
    );

    if (unauthorizedFacts.length) {
      req.log.info(`Attribute was not saved because the request contained unauthorized facts: ${JSON.stringify(unauthorizedFacts)}`);

      res.status(401);
      res.send({ unauthorizedFacts });
      return;
    }

    const attributesByAttributeClass = Controller.groupCompositionByAttributeClass(
      composition,
    );

    const attributeSavePromises: Promise<any>[] = [];
    const attributesToSaveEntries = attributesByAttributeClass.entries();

    await Quota.ensureStorageSpaceToSave(
      req.actorId,
      Array.from(attributesByAttributeClass.values()).flat(),
      req.log,
      resolvedFacts,
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const [AC, attributesAndValues] of attributesToSaveEntries) {
      attributeSavePromises.push(AC.createAll(attributesAndValues));
    }

    const isNewUserScopedGraph = await Fact.isNewUserScopedGraph(
      resolvedFacts,
      Object.values(nameIdMap),
      req.hashedUserID,
      req.log,
    );

    const savedAttributeIds = await Promise.all(attributeSavePromises).then((r) => r.flat());

    // TODO: This is slow
    const factBox = await Fact.saveAllWithoutAuthCheck(
      resolvedFacts,
      req.hashedUserID,
      isNewUserScopedGraph,
      req.log,
    );

    if (factBox) {
      await Fact.moveAllAccountabilityFactsToFactBox(savedAttributeIds, factBox, req.log);
    }

    res.send(await Controller.getCompositionResult(composition, nameIdMap));
  }

  static async create(req, res) {
    const attributesInCreation = req.attribute.id;
    const rawFacts = req.body.facts || [];
    const facts = rawFacts
      .filter((rawFact) => rawFact.length === 2 || (rawFact.length === 3 && rawFact[2] === '$it')) // TODO: what is with: '$it', 'isA', 'Team' ?? this will be fileted out
      .map((rawFact) => {
        if (rawFact.length === 2) {
          return new Fact(
            attributesInCreation,
            rawFact[0],
            rawFact[1],
            req.log,
          );
        }

        return new Fact(
          rawFact[0],
          rawFact[1],
          attributesInCreation,
          req.log,
        );
      });

    const unauthorizedFacts: Fact[] = [];

    for (let index = 0; index < facts.length; index++) {
      const fact = facts[index];
      if (!(await fact.isAuthorizedToSave(req.hashedUserID, { attributesInCreation }))) {
        unauthorizedFacts.push(fact);
      }
    }

    if (unauthorizedFacts.length) {
      req.log.info(`Attribute was not saved because the request contained unauthorized facts: ${JSON.stringify(unauthorizedFacts)}`);

      res.status(401);
      res.send({ unauthorizedFacts });
      return;
    }

    await Quota.ensureStorageSpaceToSave(
      req.actorId,
      [[req.attribute, req.body.value]],
      req.log,
      facts,
    );

    await req.attribute.create(req.body.value);
    const result = {
      ...await req.attribute.get(),
      id: req.attribute.id,
    };

    await Fact.saveAllWithoutAuthCheck(facts, req.hashedUserID, undefined, req.log);

    if (result instanceof Error) {
      req.log.error(`error in POST /attributes/${req.params.attributeId}`, result.message);
      res.status(404).send({ error: result.message });
    } else {
      res.send(result);
    }
  }

  static async get(req, res) {
    let result = await req.attribute.get();
    const mimetype = result?.value?.type;
    const isBlob = result.value instanceof Blob;

    if (result instanceof Error) {
      req.log.error(`error in GET /attributes/${req.params.attributeId}`, result.message);
      res.status(404).send({ error: result.message });
      return;
    }

    if (typeof result?.value?.arrayBuffer === 'function') {
      result.value = Buffer.from(await result.value.arrayBuffer());
    }

    if (req.query.valueOnly === 'true') {
      if (mimetype) {
        res.set('Content-Type', mimetype);
      }

      result = result.value;
    }

    if (isBlob) {
      result.value = `data:${mimetype};base64,${(result.value || result).toString('base64')}`;
    }

    res.send(result);
  }

  static async update(req, res) {
    const parsedChange: SerializedChangeWithMetadata<any> = req.body;
    const committedChange: SerializedChangeWithMetadata<any> = await req.attribute.change(
      parsedChange,
    );

    res.sendClientServerMessage(req.params.attributeId, committedChange);
    res.status(200);
    res.send();
  }

  // This has a side effect: It annotates the map with the composition parameter - which is
  // passed by reference - with the actual attribute obj.
  private static getNamedAttributesToIdDictionaryAndAnnotateComposition(
    composition,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ): Record<string, string> {
    const nameIdMap: Record<string, string> = {};

    Object.entries(composition).forEach(([attributeName, config]: [string, any]) => {
      const attributePrefix = attributePrefixMap[config.type] || 'kv';
      const attributeId = `${attributePrefix}-${uuid()}`;
      const AttributeClass = QueryExecutor.getAttributeClassByAttributeId(attributeId);

      if (!AttributeClass) {
        throw new Error(`could not find Attribute class for attribute id: ${attributeId}`);
      }

      const attribute = new AttributeClass(
        attributeId,
        clientId,
        actorId,
        logger,
      );

      // eslint-disable-next-line no-param-reassign
      composition[attributeName].attribute = attribute;
      nameIdMap[attributeName] = attributeId;
    });

    return nameIdMap;
  }

  private static resolvePlaceholdersInFactComposition(
    composition,
    actorId: string,
    logger: IsLogger,
    nameIdMap: Record<string, string>,
  ): Fact[] {
    const resolvedFacts: Fact[] = [];

    const getIdByReferenceName = (node?: string | undefined, rawFact?): string => {
      if (!node) {
        throw new Error(`invalid composition creation request: ${rawFact}`);
      }

      const match = node.match(/^{{(.+)}}$/);

      if (!match) {
        return node;
      }

      const id = nameIdMap[match[1]!];

      if (!id) {
        throw new Error(`attribute reference "${match[0]}" is not an attribute created within this request. Available names are: ${Object.keys(nameIdMap)}`);
      }

      return id;
    };

    Object.entries(composition).forEach(([attributeName, config]: [string, any]) => {
      const facts = (config.facts || [])
        .filter((rawFact) => rawFact[1] !== '$isAccountableFor' || rawFact[0] !== actorId)
        .filter((rawFact) => rawFact.length === 2 || (rawFact.length === 3 && rawFact[2] === '$it') || (rawFact.length === 3 && rawFact[0] === '$it'))
        .map((rawFact) => {
          if (rawFact.length === 2) {
            return new Fact(
              nameIdMap[attributeName]!,
              rawFact[0],
              getIdByReferenceName(rawFact[1], rawFact),
              logger,
            );
          }

          if (rawFact.length === 3 && rawFact[0] === '$it' && rawFact[2] === '$it' && rawFact[1] === '$isHostOf') {
            return new Fact(
              nameIdMap[attributeName]!,
              rawFact[1],
              nameIdMap[attributeName]!,
              logger,
            );
          }

          if (rawFact.length === 3 && rawFact[0] === '$it') {
            return new Fact(
              nameIdMap[attributeName]!,
              rawFact[1],
              getIdByReferenceName(rawFact[2], rawFact),
              logger,
            );
          }

          return new Fact(
            getIdByReferenceName(rawFact[0], rawFact),
            rawFact[1],
            nameIdMap[attributeName]!,
            logger,
          );
        });

      resolvedFacts.push(...facts);
    });

    return resolvedFacts;
  }

  private static async findUnauthorizedFacts(
    facts: Fact[],
    hashedUserID: string,
    nameIdMap: Record<string, string>,
  ): Promise<Fact[]> {
    const unauthorizedFacts: Fact[] = [];

    for (let index = 0; index < facts.length; index++) {
      const fact = facts[index];
      const authCheckArgs = { attributesInCreation: Object.values(nameIdMap) };

      if (!(await fact!.isAuthorizedToSave(hashedUserID, authCheckArgs))) {
        unauthorizedFacts.push(fact!);
      }
    }

    return unauthorizedFacts;
  }

  private static groupCompositionByAttributeClass(composition) {
    type AttrClass = typeof AbstractAttributeServer<any, any>;
    type A2CMapValue = [AbstractAttributeServer<any, any>, any][];
    const attributesByAttributeClass = new Map<AttrClass, A2CMapValue>();

    Object.entries(composition).forEach(([attributeName, config]: [string, any]) => {
      if (!config.value) {
        throw new Error(`invalid composition creation request: a value was not provided for ${attributeName}`);
      }

      if (composition[attributeName].attribute) {
        const AC = QueryExecutor
          .getAttributeClassByAttributeId(composition[attributeName].attribute.id);

        if (!AC) {
          throw new Error(`could not find Attribute class for attribute id: ${composition[attributeName].attribute.id}`);
        }

        if (!attributesByAttributeClass.get(AC)) {
          attributesByAttributeClass.set(AC, []);
        }

        let classArray = attributesByAttributeClass.get(AC);

        if (!classArray) {
          classArray = [];
          attributesByAttributeClass.set(AC, classArray);
        }

        classArray.push([composition[attributeName].attribute, config.value]);
      }
    });

    return attributesByAttributeClass;
  }

  private static async getCompositionResult(
    composition,
    nameIdMap: Record<string, string>,
  ): Promise<Record<string, { id: string }>> {
    const result: Record<string, { id: string }> = {};

    const fp = Object.entries(composition).map(([attributeName, config]: [string, any]) => config
      .attribute.get().then((attrData) => {
        result[attributeName] = {
          ...attrData,
          id: nameIdMap[attributeName],
        };
      }));

    await Promise.all(fp);

    return result;
  }
}
