import {
  EXPIRER_EVENTS,
  PAIRING_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  RELAYER_EVENTS,
  VERIFY_SERVER,
} from "@walletconnect/core";

import {
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  payloadId,
  isJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  JsonRpcRequest,
  ErrorResponse,
  getBigIntRpcId,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, ONE_SECOND, toMiliseconds } from "@walletconnect/time";
import {
  EnginePrivate,
  EngineTypes,
  ExpirerTypes,
  IEngine,
  IEngineEvents,
  JsonRpcTypes,
  PendingRequestTypes,
  Verify,
  CoreTypes,
  ProposalTypes,
  RelayerTypes,
  SessionTypes,
  PairingTypes,
  AuthTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  createDelayedPromise,
  engineEvent,
  getInternalError,
  getSdkError,
  isConformingNamespaces,
  isExpired,
  isSessionCompatible,
  isUndefined,
  isValidController,
  isValidErrorReason,
  isValidEvent,
  isValidId,
  isValidNamespaces,
  isValidNamespacesChainId,
  isValidNamespacesEvent,
  isValidNamespacesRequest,
  isValidObject,
  isValidParams,
  isValidRelay,
  isValidRelays,
  isValidRequest,
  isValidRequestExpiry,
  hashMessage,
  isBrowser,
  isValidRequiredNamespaces,
  isValidResponse,
  isValidString,
  parseExpirerTarget,
  TYPE_1,
  handleDeeplinkRedirect,
  MemoryStore,
  getDeepLink,
  hashKey,
  getDidAddress,
  formatMessage,
  getMethodsFromRecap,
  buildNamespacesFromAuth,
  createEncodedRecap,
  getChainsFromRecap,
  mergeEncodedRecaps,
  getRecapFromResources,
  validateSignedCacao,
  getNamespacedDidChainId,
  parseChainId,
} from "@walletconnect/utils";
import EventEmmiter from "events";
import {
  ENGINE_CONTEXT,
  ENGINE_RPC_OPTS,
  PROPOSAL_EXPIRY_MESSAGE,
  SESSION_EXPIRY,
  SESSION_REQUEST_EXPIRY_BOUNDARIES,
  METHODS_TO_VERIFY,
  WALLETCONNECT_DEEPLINK_CHOICE,
  ENGINE_QUEUE_STATES,
  AUTH_PUBLIC_KEY_NAME,
} from "../constants";

export class Engine extends IEngine {
  public name = ENGINE_CONTEXT;

  private events: IEngineEvents = new EventEmmiter();
  private initialized = false;

  /**
   * Queue responsible for processing incoming requests such as session_update, session_event, session_ping etc
   * It's needed when the client receives multiple requests at once from the mailbox immediately after initialization and to avoid attempting to process them all at the same time
   */
  private requestQueue: EngineTypes.EngineQueue<EngineTypes.EventCallback<JsonRpcRequest>> = {
    state: ENGINE_QUEUE_STATES.idle,
    queue: [],
  };

  /**
   * Queue responsible for processing incoming session_request
   * The queue emits the next request only after the previous one has been responded to
   */
  private sessionRequestQueue: EngineTypes.EngineQueue<PendingRequestTypes.Struct> = {
    state: ENGINE_QUEUE_STATES.idle,
    queue: [],
  };

  private requestQueueDelay = ONE_SECOND;

  private expectedPairingMethodMap: Map<string, string[]> = new Map();

  // Ephemeral (in-memory) map to store recently deleted items
  private recentlyDeletedMap = new Map<
    string | number,
    "pairing" | "session" | "proposal" | "request"
  >();

  private recentlyDeletedLimit = 200;

  constructor(client: IEngine["client"]) {
    super(client);
  }

  public init: IEngine["init"] = async () => {
    if (!this.initialized) {
      await this.cleanup();
      this.registerRelayerEvents();
      this.registerExpirerEvents();
      this.registerPairingEvents();
      this.client.core.pairing.register({ methods: Object.keys(ENGINE_RPC_OPTS) });
      this.initialized = true;
      setTimeout(() => {
        this.sessionRequestQueue.queue = this.getPendingSessionRequests();
        this.processSessionRequestQueue();
      }, toMiliseconds(this.requestQueueDelay));
    }
  };

  // ---------- Public ------------------------------------------------ //

  public connect: IEngine["connect"] = async (params) => {
    await this.isInitialized();
    const connectParams = {
      ...params,
      requiredNamespaces: params.requiredNamespaces || {},
      optionalNamespaces: params.optionalNamespaces || {},
    };
    await this.isValidConnect(connectParams);
    const { pairingTopic, requiredNamespaces, optionalNamespaces, sessionProperties, relays } =
      connectParams;
    let topic = pairingTopic;
    let uri: string | undefined;
    let active = false;

    try {
      if (topic) {
        const pairing = this.client.core.pairing.pairings.get(topic);
        active = pairing.active;
      }
    } catch (error) {
      this.client.logger.error(`connect() -> pairing.get(${topic}) failed`);
      throw error;
    }
    if (!topic || !active) {
      const { topic: newTopic, uri: newUri } = await this.client.core.pairing.create();
      topic = newTopic;
      uri = newUri;
    }
    // safety check to ensure pairing topic is available
    if (!topic) {
      const { message } = getInternalError("NO_MATCHING_KEY", `connect() pairing topic: ${topic}`);
      throw new Error(message);
    }

    const publicKey = await this.client.core.crypto.generateKeyPair();

    const expiry = ENGINE_RPC_OPTS.wc_sessionPropose.req.ttl || FIVE_MINUTES;
    const expiryTimestamp = calcExpiry(expiry);
    const proposal = {
      requiredNamespaces,
      optionalNamespaces,
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
      expiryTimestamp,
      ...(sessionProperties && { sessionProperties }),
    };
    const {
      reject,
      resolve,
      done: approval,
    } = createDelayedPromise<SessionTypes.Struct>(expiry, PROPOSAL_EXPIRY_MESSAGE);
    this.events.once<"session_connect">(
      engineEvent("session_connect"),
      async ({ error, session }) => {
        if (error) reject(error);
        else if (session) {
          session.self.publicKey = publicKey;
          const completeSession = {
            ...session,
            requiredNamespaces: proposal.requiredNamespaces,
            optionalNamespaces: proposal.optionalNamespaces,
          };
          await this.client.session.set(session.topic, completeSession);
          await this.setExpiry(session.topic, session.expiry);
          if (topic) {
            await this.client.core.pairing.updateMetadata({
              topic,
              metadata: session.peer.metadata,
            });
          }
          resolve(completeSession);
        }
      },
    );
    const id = await this.sendRequest({
      topic,
      method: "wc_sessionPropose",
      params: proposal,
      throwOnFailedPublish: true,
    });
    await this.setProposal(id, { id, ...proposal });
    return { uri, approval };
  };

  public pair: IEngine["pair"] = async (params) => {
    await this.isInitialized();
    try {
      return await this.client.core.pairing.pair(params);
    } catch (error) {
      this.client.logger.error("pair() failed");
      throw error;
    }
  };

  public approve: IEngine["approve"] = async (params) => {
    await this.isInitialized();
    try {
      await this.isValidApprove(params);
    } catch (error) {
      this.client.logger.error("approve() -> isValidApprove() failed");
      throw error;
    }
    const { id, relayProtocol, namespaces, sessionProperties, sessionConfig } = params;
    let proposal;
    try {
      proposal = this.client.proposal.get(id);
    } catch (error) {
      this.client.logger.error(`approve() -> proposal.get(${id}) failed`);
      throw error;
    }

    let { pairingTopic, proposer, requiredNamespaces, optionalNamespaces } = proposal;
    pairingTopic = pairingTopic || "";

    const selfPublicKey = await this.client.core.crypto.generateKeyPair();
    const peerPublicKey = proposer.publicKey;
    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      selfPublicKey,
      peerPublicKey,
    );
    const sessionSettle = {
      relay: { protocol: relayProtocol ?? "irn" },
      namespaces,
      pairingTopic,
      controller: { publicKey: selfPublicKey, metadata: this.client.metadata },
      expiry: calcExpiry(SESSION_EXPIRY),
      ...(sessionProperties && { sessionProperties }),
      ...(sessionConfig && { sessionConfig }),
    };
    await this.client.core.relayer.subscribe(sessionTopic);
    const session = {
      ...sessionSettle,
      topic: sessionTopic,
      requiredNamespaces,
      optionalNamespaces,
      pairingTopic,
      acknowledged: false,
      self: sessionSettle.controller,
      peer: {
        publicKey: proposer.publicKey,
        metadata: proposer.metadata,
      },
      controller: selfPublicKey,
    };
    await this.client.session.set(sessionTopic, session);
    try {
      await this.sendResult<"wc_sessionPropose">({
        id,
        topic: pairingTopic,
        result: {
          relay: {
            protocol: relayProtocol ?? "irn",
          },
          responderPublicKey: selfPublicKey,
        },
        throwOnFailedPublish: true,
      });
      await this.sendRequest({
        topic: sessionTopic,
        method: "wc_sessionSettle",
        params: sessionSettle,
        throwOnFailedPublish: true,
      });
    } catch (error) {
      this.client.logger.error(error);
      // if the publish fails, delete the session and throw an error
      this.client.session.delete(sessionTopic, getSdkError("USER_DISCONNECTED"));
      await this.client.core.relayer.unsubscribe(sessionTopic);
      throw error;
    }

    await this.client.core.pairing.updateMetadata({
      topic: pairingTopic,
      metadata: proposer.metadata,
    });
    await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
    await this.client.core.pairing.activate({ topic: pairingTopic });
    await this.setExpiry(sessionTopic, calcExpiry(SESSION_EXPIRY));
    return {
      topic: sessionTopic,
      acknowledged: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(this.client.session.get(sessionTopic)), 5_00),
        ), // artificial delay to allow for the session to be processed by the peer
    };
  };

  public reject: IEngine["reject"] = async (params) => {
    await this.isInitialized();
    try {
      await this.isValidReject(params);
    } catch (error) {
      this.client.logger.error("reject() -> isValidReject() failed");
      throw error;
    }
    const { id, reason } = params;
    let pairingTopic;
    try {
      const proposal = this.client.proposal.get(id);
      pairingTopic = proposal.pairingTopic;
    } catch (error) {
      this.client.logger.error(`reject() -> proposal.get(${id}) failed`);
      throw error;
    }

    if (pairingTopic) {
      await this.sendError({
        id,
        topic: pairingTopic,
        error: reason,
        rpcOpts: ENGINE_RPC_OPTS.wc_sessionPropose.reject,
      });
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
    }
  };

  public update: IEngine["update"] = async (params) => {
    await this.isInitialized();
    try {
      await this.isValidUpdate(params);
    } catch (error) {
      this.client.logger.error("update() -> isValidUpdate() failed");
      throw error;
    }
    const { topic, namespaces } = params;

    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    const clientRpcId = payloadId();
    const relayRpcId = getBigIntRpcId().toString() as any;

    const oldNamespaces = this.client.session.get(topic).namespaces;
    this.events.once(engineEvent("session_update", clientRpcId), ({ error }: any) => {
      if (error) reject(error);
      else {
        resolve();
      }
    });
    // Update the session with the new namespaces, if the publish fails, revert to the old.
    // This allows the client to use the updated session like emitting events
    // without waiting for the peer to acknowledge
    await this.client.session.update(topic, { namespaces });
    await this.sendRequest({
      topic,
      method: "wc_sessionUpdate",
      params: { namespaces },
      throwOnFailedPublish: true,
      clientRpcId,
      relayRpcId,
    }).catch((error) => {
      this.client.logger.error(error);
      this.client.session.update(topic, { namespaces: oldNamespaces });
      reject(error);
    });
    return { acknowledged };
  };

  public extend: IEngine["extend"] = async (params) => {
    await this.isInitialized();
    try {
      await this.isValidExtend(params);
    } catch (error) {
      this.client.logger.error("extend() -> isValidExtend() failed");
      throw error;
    }

    const { topic } = params;
    const clientRpcId = payloadId();
    const { done: acknowledged, resolve, reject } = createDelayedPromise<void>();
    this.events.once(engineEvent("session_extend", clientRpcId), ({ error }: any) => {
      if (error) reject(error);
      else resolve();
    });

    await this.setExpiry(topic, calcExpiry(SESSION_EXPIRY));
    this.sendRequest({
      topic,
      method: "wc_sessionExtend",
      params: {},
      clientRpcId,
      throwOnFailedPublish: true,
    }).catch((e) => {
      reject(e);
    });

    return { acknowledged };
  };

  public request: IEngine["request"] = async <T>(params: EngineTypes.RequestParams) => {
    await this.isInitialized();
    try {
      await this.isValidRequest(params);
    } catch (error) {
      this.client.logger.error("request() -> isValidRequest() failed");
      throw error;
    }
    const { chainId, request, topic, expiry = ENGINE_RPC_OPTS.wc_sessionRequest.req.ttl } = params;
    const session = this.client.session.get(topic);
    const clientRpcId = payloadId();
    const relayRpcId = getBigIntRpcId().toString() as any;
    const { done, resolve, reject } = createDelayedPromise<T>(
      expiry,
      "Request expired. Please try again.",
    );
    this.events.once<"session_request">(
      engineEvent("session_request", clientRpcId),
      ({ error, result }) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    return await Promise.all([
      new Promise<void>(async (resolve) => {
        await this.sendRequest({
          clientRpcId,
          relayRpcId,
          topic,
          method: "wc_sessionRequest",
          params: {
            request: {
              ...request,
              expiryTimestamp: calcExpiry(expiry),
            },
            chainId,
          },
          expiry,
          throwOnFailedPublish: true,
        }).catch((error) => reject(error));
        this.client.events.emit("session_request_sent", {
          topic,
          request,
          chainId,
          id: clientRpcId,
        });
        resolve();
      }),
      new Promise<void>(async (resolve) => {
        // only attempt to handle deeplinks if they are not explicitly disabled in the session config
        if (!session.sessionConfig?.disableDeepLink) {
          const wcDeepLink = await getDeepLink(
            this.client.core.storage,
            WALLETCONNECT_DEEPLINK_CHOICE,
          );
          handleDeeplinkRedirect({ id: clientRpcId, topic, wcDeepLink });
        }
        resolve();
      }),
      done(),
    ]).then((result) => result[2]); // order is important here, we want to return the result of the `done` promise
  };

  public respond: IEngine["respond"] = async (params) => {
    await this.isInitialized();
    await this.isValidRespond(params);
    const { topic, response } = params;
    const { id } = response;
    if (isJsonRpcResult(response)) {
      await this.sendResult({ id, topic, result: response.result, throwOnFailedPublish: true });
    } else if (isJsonRpcError(response)) {
      await this.sendError({ id, topic, error: response.error });
    }
    this.cleanupAfterResponse(params);
  };

  public ping: IEngine["ping"] = async (params) => {
    await this.isInitialized();
    try {
      await this.isValidPing(params);
    } catch (error) {
      this.client.logger.error("ping() -> isValidPing() failed");
      throw error;
    }
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      const clientRpcId = payloadId();
      const relayRpcId = getBigIntRpcId().toString() as any;
      const { done, resolve, reject } = createDelayedPromise<void>();
      this.events.once(engineEvent("session_ping", clientRpcId), ({ error }: any) => {
        if (error) reject(error);
        else resolve();
      });
      await Promise.all([
        this.sendRequest({
          topic,
          method: "wc_sessionPing",
          params: {},
          throwOnFailedPublish: true,
          clientRpcId,
          relayRpcId,
        }),
        done(),
      ]);
    } else if (this.client.core.pairing.pairings.keys.includes(topic)) {
      await this.client.core.pairing.ping({ topic });
    }
  };

  public emit: IEngine["emit"] = async (params) => {
    await this.isInitialized();
    await this.isValidEmit(params);
    const { topic, event, chainId } = params;
    const relayRpcId = getBigIntRpcId().toString() as any;
    await this.sendRequest({
      topic,
      method: "wc_sessionEvent",
      params: { event, chainId },
      throwOnFailedPublish: true,
      relayRpcId,
    });
  };

  public disconnect: IEngine["disconnect"] = async (params) => {
    await this.isInitialized();
    await this.isValidDisconnect(params);
    const { topic } = params;
    if (this.client.session.keys.includes(topic)) {
      // await an ack to ensure the relay has received the disconnect request
      await this.sendRequest({
        topic,
        method: "wc_sessionDelete",
        params: getSdkError("USER_DISCONNECTED"),
        throwOnFailedPublish: true,
      });
      await this.deleteSession({ topic, emitEvent: false });
    } else if (this.client.core.pairing.pairings.keys.includes(topic)) {
      await this.client.core.pairing.disconnect({ topic });
    } else {
      const { message } = getInternalError(
        "MISMATCHED_TOPIC",
        `Session or pairing topic not found: ${topic}`,
      );
      throw new Error(message);
    }
  };

  public find: IEngine["find"] = (params) => {
    this.isInitialized();
    return this.client.session.getAll().filter((session) => isSessionCompatible(session, params));
  };

  public getPendingSessionRequests: IEngine["getPendingSessionRequests"] = () => {
    return this.client.pendingRequest.getAll();
  };

  // ---------- Auth ------------------------------------------------ //

  public authenticate: IEngine["authenticate"] = async (params) => {
    this.isInitialized();
    this.isValidAuthenticate(params);

    const {
      chains,
      statement = "",
      uri,
      domain,
      nonce,
      type,
      exp,
      nbf,
      methods = [],
      expiry,
    } = params;
    // reassign resources to remove reference as the array is modified and might cause side effects
    const resources = [...(params.resources || [])];

    const { topic: pairingTopic, uri: connectionUri } = await this.client.core.pairing.create({
      methods: ["wc_sessionAuthenticate"],
    });

    this.client.logger.info({
      message: "Generated new pairing",
      pairing: { topic: pairingTopic, uri: connectionUri },
    });

    const publicKey = await this.client.core.crypto.generateKeyPair();
    const responseTopic = hashKey(publicKey);

    await Promise.all([
      this.client.auth.authKeys.set(AUTH_PUBLIC_KEY_NAME, { responseTopic, publicKey }),
      this.client.auth.pairingTopics.set(responseTopic, { topic: responseTopic, pairingTopic }),
    ]);
    // Subscribe to response topic
    await this.client.core.relayer.subscribe(responseTopic);

    this.client.logger.info(`sending request to new pairing topic: ${pairingTopic}`);

    if (methods.length > 0) {
      const { namespace } = parseChainId(chains[0]);
      let recap = createEncodedRecap(namespace, "request", methods);
      const existingRecap = getRecapFromResources(resources);
      if (existingRecap) {
        // per Recaps spec, recap must occupy the last position in the resources array
        // using .pop to remove the element given we already checked it's a recap and will replace it
        const mergedRecap = mergeEncodedRecaps(recap, resources.pop() as string);
        recap = mergedRecap;
      }
      resources.push(recap);
    }

    // Ensure the expiry is greater than the minimum required for the request - currently 1h
    const authRequestExpiry =
      expiry && expiry > ENGINE_RPC_OPTS.wc_sessionAuthenticate.req.ttl
        ? expiry
        : ENGINE_RPC_OPTS.wc_sessionAuthenticate.req.ttl;

    const request = {
      authPayload: {
        type: type ?? "caip122",
        chains,
        statement,
        aud: uri,
        domain,
        version: "1",
        nonce,
        iat: new Date().toISOString(),
        exp,
        nbf,
        resources,
      },
      requester: { publicKey, metadata: this.client.metadata },
      expiryTimestamp: calcExpiry(authRequestExpiry),
    };

    // ----- build namespaces for fallback session proposal ----- //
    const namespaces = {
      eip155: {
        chains,
        // request `personal_sign` method by default to allow for fallback siwe
        methods: [...new Set(["personal_sign", ...methods])],
        events: ["chainChanged", "accountsChanged"],
      },
    };

    const proposal = {
      requiredNamespaces: {},
      optionalNamespaces: namespaces,
      relays: [{ protocol: "irn" }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
      expiryTimestamp: calcExpiry(ENGINE_RPC_OPTS.wc_sessionPropose.req.ttl),
    };

    const { done, resolve, reject } = createDelayedPromise(authRequestExpiry, "Request expired");

    // handle fallback session proposal response
    const onSessionConnect = async ({ error, session }: any) => {
      // cleanup listener for authenticate response
      this.events.off(engineEvent("session_request", id), onAuthenticate);
      if (error) reject(error);
      else if (session) {
        session.self.publicKey = publicKey;
        await this.client.session.set(session.topic, session);
        await this.setExpiry(session.topic, session.expiry);
        if (pairingTopic) {
          await this.client.core.pairing.updateMetadata({
            topic: pairingTopic,
            metadata: session.peer.metadata,
          });
        }
        const sessionObject = this.client.session.get(session.topic);
        await this.deleteProposal(fallbackId);
        resolve({
          session: sessionObject,
        });
      }
    };
    // handle session authenticate response
    const onAuthenticate = async (payload: any) => {
      // delete this auth request on response
      // we're using payload from the wallet to establish the session so we don't need to keep this around
      await this.deletePendingAuthRequest(id, { message: "fulfilled", code: 0 });

      if (payload.error) {
        // wallets that do not support wc_sessionAuthenticate will return an error
        // we should not reject the promise in this case as the fallback session proposal will be used
        const error = getSdkError("WC_METHOD_UNSUPPORTED", "wc_sessionAuthenticate");
        if (payload.error.code === error.code) return;

        // cleanup listener for fallback response
        this.events.off(engineEvent("session_connect"), onSessionConnect);
        return reject(payload.error.message);
      }
      // delete fallback proposal on successful authenticate as the proposal will not be responded to
      await this.deleteProposal(fallbackId);
      // cleanup listener for fallback response
      this.events.off(engineEvent("session_connect"), onSessionConnect);

      const {
        cacaos,
        responder,
      }: {
        cacaos: AuthTypes.SessionAuthenticateResponseParams["cacaos"];
        responder: AuthTypes.SessionAuthenticateResponseParams["responder"];
      } = payload.result;

      const approvedMethods: string[] = [];
      const approvedAccounts: string[] = [];
      for (const cacao of cacaos) {
        const isValid = await validateSignedCacao({ cacao, projectId: this.client.core.projectId });
        if (!isValid) {
          this.client.logger.error(cacao, "Signature verification failed");
          reject(getSdkError("SESSION_SETTLEMENT_FAILED", "Signature verification failed"));
        }

        const { p: payload } = cacao;
        const recap = getRecapFromResources(payload.resources);

        const approvedChains: string[] = [getNamespacedDidChainId(payload.iss) as string];
        const parsedAddress = getDidAddress(payload.iss) as string;

        if (recap) {
          const methodsfromRecap = getMethodsFromRecap(recap);
          const chainsFromRecap = getChainsFromRecap(recap);
          approvedMethods.push(...methodsfromRecap);
          approvedChains.push(...chainsFromRecap);
        }

        for (const chain of approvedChains) {
          approvedAccounts.push(`${chain}:${parsedAddress}`);
        }
      }
      const sessionTopic = await this.client.core.crypto.generateSharedKey(
        publicKey,
        responder.publicKey,
      );

      //create session object
      let session: SessionTypes.Struct | undefined;

      if (approvedMethods.length > 0) {
        session = {
          topic: sessionTopic,
          acknowledged: true,
          self: {
            publicKey,
            metadata: this.client.metadata,
          },
          peer: responder,
          controller: responder.publicKey,
          expiry: calcExpiry(SESSION_EXPIRY),
          requiredNamespaces: {},
          optionalNamespaces: {},
          relay: { protocol: "irn" },
          pairingTopic,
          namespaces: buildNamespacesFromAuth(
            [...new Set(approvedMethods)],
            [...new Set(approvedAccounts)],
          ),
        };

        await this.client.core.relayer.subscribe(sessionTopic);
        await this.client.session.set(sessionTopic, session);

        session = this.client.session.get(sessionTopic);
      }
      resolve({
        auths: cacaos,
        session,
      });
    };

    // set the ids for both requests
    const id = payloadId();
    const fallbackId = payloadId();

    // subscribe to response events
    this.events.once<"session_connect">(engineEvent("session_connect"), onSessionConnect);
    this.events.once(engineEvent("session_request", id), onAuthenticate);

    try {
      // send both (main & fallback) requests
      await Promise.all([
        this.sendRequest({
          topic: pairingTopic,
          method: "wc_sessionAuthenticate",
          params: request,
          expiry: params.expiry,
          throwOnFailedPublish: true,
          clientRpcId: id,
        }),
        this.sendRequest({
          topic: pairingTopic,
          method: "wc_sessionPropose",
          params: proposal,
          expiry: ENGINE_RPC_OPTS.wc_sessionPropose.req.ttl,
          throwOnFailedPublish: true,
          clientRpcId: fallbackId,
        }),
      ]);
    } catch (error) {
      // cleanup listeners on failed publish
      this.events.off(engineEvent("session_connect"), onSessionConnect);
      this.events.off(engineEvent("session_request", id), onAuthenticate);
      throw error;
    }

    await this.setProposal(fallbackId, { id: fallbackId, ...proposal });
    await this.setAuthRequest(id, {
      request: { ...request, verifyContext: {} as any },
      pairingTopic,
    });

    return {
      uri: connectionUri,
      response: done,
    } as EngineTypes.SessionAuthenticateResponsePromise;
  };

  public approveSessionAuthenticate: IEngine["approveSessionAuthenticate"] = async (
    sessionAuthenticateResponseParams,
  ) => {
    this.isInitialized();

    const { id, auths } = sessionAuthenticateResponseParams;

    const pendingRequest = this.getPendingAuthRequest(id);

    if (!pendingRequest) {
      throw new Error(`Could not find pending auth request with id ${id}`);
    }

    const receiverPublicKey = pendingRequest.requester.publicKey;
    const senderPublicKey = await this.client.core.crypto.generateKeyPair();
    const responseTopic = hashKey(receiverPublicKey);

    const encodeOpts = {
      type: TYPE_1,
      receiverPublicKey,
      senderPublicKey,
    };

    const approvedMethods: string[] = [];
    const approvedAccounts: string[] = [];
    for (const cacao of auths) {
      const isValid = await validateSignedCacao({ cacao, projectId: this.client.core.projectId });
      if (!isValid) {
        const invalidErr = getSdkError(
          "SESSION_SETTLEMENT_FAILED",
          "Signature verification failed",
        );

        await this.sendError({
          id,
          topic: responseTopic,
          error: invalidErr,
          encodeOpts,
        });

        throw new Error(invalidErr.message);
      }

      const { p: payload } = cacao;
      const recap = getRecapFromResources(payload.resources);

      const approvedChains: string[] = [getNamespacedDidChainId(payload.iss) as string];

      const parsedAddress = getDidAddress(payload.iss) as string;

      if (recap) {
        const methodsfromRecap = getMethodsFromRecap(recap);
        const chainsFromRecap = getChainsFromRecap(recap);
        approvedMethods.push(...methodsfromRecap);
        approvedChains.push(...chainsFromRecap);
      }
      for (const chain of approvedChains) {
        approvedAccounts.push(`${chain}:${parsedAddress}`);
      }
    }

    const sessionTopic = await this.client.core.crypto.generateSharedKey(
      senderPublicKey,
      receiverPublicKey,
    );
    let session: SessionTypes.Struct | undefined;
    if (approvedMethods?.length > 0) {
      session = {
        topic: sessionTopic,
        acknowledged: true,
        self: {
          publicKey: senderPublicKey,
          metadata: this.client.metadata,
        },
        peer: {
          publicKey: receiverPublicKey,
          metadata: pendingRequest.requester.metadata,
        },
        controller: receiverPublicKey,
        expiry: calcExpiry(SESSION_EXPIRY),
        authentication: auths,
        requiredNamespaces: {},
        optionalNamespaces: {},
        relay: { protocol: "irn" },
        pairingTopic: "",
        namespaces: buildNamespacesFromAuth(
          [...new Set(approvedMethods)],
          [...new Set(approvedAccounts)],
        ),
      };

      await this.client.core.relayer.subscribe(sessionTopic);
      await this.client.session.set(sessionTopic, session);
    }

    await this.sendResult<"wc_sessionAuthenticate">({
      topic: responseTopic,
      id,
      result: {
        cacaos: auths,
        responder: {
          publicKey: senderPublicKey,
          metadata: this.client.metadata,
        },
      },
      encodeOpts,
      throwOnFailedPublish: true,
    });
    await this.client.auth.requests.delete(id, { message: "fulfilled", code: 0 });
    await this.client.core.pairing.activate({ topic: pendingRequest.pairingTopic });
    return { session };
  };

  public rejectSessionAuthenticate: IEngine["rejectSessionAuthenticate"] = async (params) => {
    await this.isInitialized();

    const { id, reason } = params;

    const pendingRequest = this.getPendingAuthRequest(id);

    if (!pendingRequest) {
      throw new Error(`Could not find pending auth request with id ${id}`);
    }

    const receiverPublicKey = pendingRequest.requester.publicKey;
    const senderPublicKey = await this.client.core.crypto.generateKeyPair();
    const responseTopic = hashKey(receiverPublicKey);

    const encodeOpts = {
      type: TYPE_1,
      receiverPublicKey,
      senderPublicKey,
    };

    await this.sendError({
      id,
      topic: responseTopic,
      error: reason,
      encodeOpts,
      rpcOpts: ENGINE_RPC_OPTS.wc_sessionAuthenticate.reject,
    });
    await this.client.auth.requests.delete(id, { message: "rejected", code: 0 });
    await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
  };

  public formatAuthMessage: IEngine["formatAuthMessage"] = (params) => {
    this.isInitialized();
    const { request, iss } = params;
    return formatMessage(request, iss);
  };

  // ---------- Private Helpers --------------------------------------- //

  private cleanupDuplicatePairings: EnginePrivate["cleanupDuplicatePairings"] = async (
    session: SessionTypes.Struct,
  ) => {
    // older SDK versions are missing the `pairingTopic` prop thus we need to check for it
    if (!session.pairingTopic) return;

    try {
      const pairing = this.client.core.pairing.pairings.get(session.pairingTopic);
      const allPairings = this.client.core.pairing.pairings.getAll();
      const duplicates = allPairings.filter(
        (p) =>
          p.peerMetadata?.url &&
          p.peerMetadata?.url === session.peer.metadata.url &&
          p.topic &&
          p.topic !== pairing.topic,
      );
      if (duplicates.length === 0) return;
      this.client.logger.info(`Cleaning up ${duplicates.length} duplicate pairing(s)`);
      await Promise.all(
        duplicates.map((p) => this.client.core.pairing.disconnect({ topic: p.topic })),
      );
      this.client.logger.info(`Duplicate pairings clean up finished`);
    } catch (error) {
      this.client.logger.error(error);
    }
  };

  private deleteSession: EnginePrivate["deleteSession"] = async (params) => {
    const { topic, expirerHasDeleted = false, emitEvent = true, id = 0 } = params;
    const { self } = this.client.session.get(topic);
    // Await the unsubscribe first to avoid deleting the symKey too early below.
    await this.client.core.relayer.unsubscribe(topic);
    await this.client.session.delete(topic, getSdkError("USER_DISCONNECTED"));
    this.addToRecentlyDeleted(topic, "session");
    if (this.client.core.crypto.keychain.has(self.publicKey)) {
      await this.client.core.crypto.deleteKeyPair(self.publicKey);
    }
    if (this.client.core.crypto.keychain.has(topic)) {
      await this.client.core.crypto.deleteSymKey(topic);
    }
    if (!expirerHasDeleted) this.client.core.expirer.del(topic);
    // remove any deeplinks from storage after the session is deleted
    // to avoid navigating to incorrect deeplink later on
    this.client.core.storage
      .removeItem(WALLETCONNECT_DEEPLINK_CHOICE)
      .catch((e) => this.client.logger.warn(e));
    this.getPendingSessionRequests().forEach((r) => {
      if (r.topic === topic) {
        this.deletePendingSessionRequest(r.id, getSdkError("USER_DISCONNECTED"));
      }
    });
    // reset the queue state back to idle if a request for the deleted session is still in the queue
    if (topic === this.sessionRequestQueue.queue[0]?.topic) {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.idle;
    }
    if (emitEvent) this.client.events.emit("session_delete", { id, topic });
  };

  private deleteProposal: EnginePrivate["deleteProposal"] = async (id, expirerHasDeleted) => {
    await Promise.all([
      this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED")),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(id),
    ]);
    this.addToRecentlyDeleted(id, "proposal");
  };

  private deletePendingSessionRequest: EnginePrivate["deletePendingSessionRequest"] = async (
    id,
    reason,
    expirerHasDeleted = false,
  ) => {
    await Promise.all([
      this.client.pendingRequest.delete(id, reason),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(id),
    ]);
    this.addToRecentlyDeleted(id, "request");
    this.sessionRequestQueue.queue = this.sessionRequestQueue.queue.filter((r) => r.id !== id);
    if (expirerHasDeleted) {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.idle;
      this.client.events.emit("session_request_expire", { id });
    }
  };

  private deletePendingAuthRequest: EnginePrivate["deletePendingAuthRequest"] = async (
    id,
    reason,
    expirerHasDeleted = false,
  ) => {
    await Promise.all([
      this.client.auth.requests.delete(id, reason),
      expirerHasDeleted ? Promise.resolve() : this.client.core.expirer.del(id),
    ]);
  };

  private setExpiry: EnginePrivate["setExpiry"] = async (topic, expiry) => {
    if (!this.client.session.keys.includes(topic)) return;
    this.client.core.expirer.set(topic, expiry);
    await this.client.session.update(topic, { expiry });
  };

  private setProposal: EnginePrivate["setProposal"] = async (id, proposal) => {
    this.client.core.expirer.set(id, calcExpiry(ENGINE_RPC_OPTS.wc_sessionPropose.req.ttl));
    await this.client.proposal.set(id, proposal);
  };

  private setAuthRequest: EnginePrivate["setAuthRequest"] = async (id, params) => {
    const { request, pairingTopic } = params;
    this.client.core.expirer.set(id, request.expiryTimestamp);
    await this.client.auth.requests.set(id, {
      authPayload: request.authPayload,
      requester: request.requester,
      expiryTimestamp: request.expiryTimestamp,
      id,
      pairingTopic,
      verifyContext: request.verifyContext,
    });
  };

  private setPendingSessionRequest: EnginePrivate["setPendingSessionRequest"] = async (
    pendingRequest: PendingRequestTypes.Struct,
  ) => {
    const { id, topic, params, verifyContext } = pendingRequest;
    const expiry =
      params.request.expiryTimestamp || calcExpiry(ENGINE_RPC_OPTS.wc_sessionRequest.req.ttl);
    this.client.core.expirer.set(id, expiry);
    await this.client.pendingRequest.set(id, {
      id,
      topic,
      params,
      verifyContext,
    });
  };

  private sendRequest: EnginePrivate["sendRequest"] = async (args) => {
    const { topic, method, params, expiry, relayRpcId, clientRpcId, throwOnFailedPublish } = args;
    const payload = formatJsonRpcRequest(method, params, clientRpcId);
    if (isBrowser() && METHODS_TO_VERIFY.includes(method)) {
      const hash = hashMessage(JSON.stringify(payload));
      this.client.core.verify.register({ attestationId: hash });
    }
    let message;
    try {
      message = await this.client.core.crypto.encode(topic, payload);
    } catch (error) {
      await this.cleanup();
      this.client.logger.error(`sendRequest() -> core.crypto.encode() for topic ${topic} failed`);
      throw error;
    }
    const opts = ENGINE_RPC_OPTS[method].req;
    if (expiry) opts.ttl = expiry;
    if (relayRpcId) opts.id = relayRpcId;
    this.client.core.history.set(topic, payload);
    if (throwOnFailedPublish) {
      opts.internal = {
        ...opts.internal,
        throwOnFailedPublish: true,
      };
      await this.client.core.relayer.publish(topic, message, opts);
    } else {
      this.client.core.relayer
        .publish(topic, message, opts)
        .catch((error) => this.client.logger.error(error));
    }
    return payload.id;
  };

  private sendResult: EnginePrivate["sendResult"] = async (args) => {
    const { id, topic, result, throwOnFailedPublish, encodeOpts } = args;
    const payload = formatJsonRpcResult(id, result);
    let message;
    try {
      message = await this.client.core.crypto.encode(topic, payload, encodeOpts);
    } catch (error) {
      // if encoding fails e.g. due to missing keychain, we want to cleanup all related data as its unusable
      await this.cleanup();
      this.client.logger.error(`sendResult() -> core.crypto.encode() for topic ${topic} failed`);
      throw error;
    }
    let record;
    try {
      record = await this.client.core.history.get(topic, id);
    } catch (error) {
      this.client.logger.error(`sendResult() -> history.get(${topic}, ${id}) failed`);
      throw error;
    }
    const opts = ENGINE_RPC_OPTS[record.request.method].res;
    if (throwOnFailedPublish) {
      opts.internal = {
        ...opts.internal,
        throwOnFailedPublish: true,
      };
      await this.client.core.relayer.publish(topic, message, opts);
    } else {
      this.client.core.relayer
        .publish(topic, message, opts)
        .catch((error) => this.client.logger.error(error));
    }
    await this.client.core.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (params) => {
    const { id, topic, error, encodeOpts, rpcOpts } = params;
    const payload = formatJsonRpcError(id, error);
    let message;
    try {
      message = await this.client.core.crypto.encode(topic, payload, encodeOpts);
    } catch (error) {
      await this.cleanup();
      this.client.logger.error(`sendError() -> core.crypto.encode() for topic ${topic} failed`);
      throw error;
    }
    let record;
    try {
      record = await this.client.core.history.get(topic, id);
    } catch (error) {
      this.client.logger.error(`sendError() -> history.get(${topic}, ${id}) failed`);
      throw error;
    }
    const opts = rpcOpts || ENGINE_RPC_OPTS[record.request.method].res;
    // await is intentionally omitted to speed up performance
    this.client.core.relayer.publish(topic, message, opts);
    await this.client.core.history.resolve(payload);
  };

  private cleanup: EnginePrivate["cleanup"] = async () => {
    const sessionTopics: string[] = [];
    const proposalIds: number[] = [];
    this.client.session.getAll().forEach((session) => {
      let toCleanup = false;
      if (isExpired(session.expiry)) toCleanup = true;
      if (!this.client.core.crypto.keychain.has(session.topic)) toCleanup = true;
      if (toCleanup) sessionTopics.push(session.topic);
    });
    this.client.proposal.getAll().forEach((proposal) => {
      if (isExpired(proposal.expiryTimestamp)) proposalIds.push(proposal.id);
    });
    await Promise.all([
      ...sessionTopics.map((topic) => this.deleteSession({ topic })),
      ...proposalIds.map((id) => this.deleteProposal(id)),
    ]);
  };

  private async isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
    await this.client.core.relayer.confirmOnlineStateOrThrow();
  }

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.client.core.relayer.on(
      RELAYER_EVENTS.message,
      async (event: RelayerTypes.MessageEvent) => {
        const { topic, message } = event;

        // Retrieve the public key (if defined) to decrypt possible `auth_request` response
        const { publicKey } = this.client.auth.authKeys.keys.includes(AUTH_PUBLIC_KEY_NAME)
          ? this.client.auth.authKeys.get(AUTH_PUBLIC_KEY_NAME)
          : ({ responseTopic: undefined, publicKey: undefined } as any);

        const payload = await this.client.core.crypto.decode(topic, message, {
          receiverPublicKey: publicKey,
        });

        try {
          if (isJsonRpcRequest(payload)) {
            this.client.core.history.set(topic, payload);
            this.onRelayEventRequest({ topic, payload });
          } else if (isJsonRpcResponse(payload)) {
            await this.client.core.history.resolve(payload);
            await this.onRelayEventResponse({ topic, payload });
            this.client.core.history.delete(topic, payload.id);
          } else {
            this.onRelayEventUnknownPayload({ topic, payload });
          }
        } catch (error) {
          this.client.logger.error(error);
        }
      },
    );
  }

  private onRelayEventRequest: EnginePrivate["onRelayEventRequest"] = async (event) => {
    this.requestQueue.queue.push(event);
    await this.processRequestsQueue();
  };

  private processRequestsQueue = async () => {
    if (this.requestQueue.state === ENGINE_QUEUE_STATES.active) {
      this.client.logger.info(`Request queue already active, skipping...`);
      return;
    }

    this.client.logger.info(
      `Request queue starting with ${this.requestQueue.queue.length} requests`,
    );

    while (this.requestQueue.queue.length > 0) {
      this.requestQueue.state = ENGINE_QUEUE_STATES.active;
      const request = this.requestQueue.queue.shift();
      if (!request) continue;

      try {
        this.processRequest(request);
        // small delay to allow for any async tasks to complete
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        this.client.logger.warn(error);
      }
    }
    this.requestQueue.state = ENGINE_QUEUE_STATES.idle;
  };

  private processRequest: EnginePrivate["onRelayEventRequest"] = (event) => {
    const { topic, payload } = event;
    const reqMethod = payload.method as JsonRpcTypes.WcMethod;

    if (this.shouldIgnorePairingRequest({ topic, requestMethod: reqMethod })) {
      return;
    }

    switch (reqMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeRequest(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleRequest(topic, payload);
      case "wc_sessionUpdate":
        return this.onSessionUpdateRequest(topic, payload);
      case "wc_sessionExtend":
        return this.onSessionExtendRequest(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingRequest(topic, payload);
      case "wc_sessionDelete":
        return this.onSessionDeleteRequest(topic, payload);
      case "wc_sessionRequest":
        return this.onSessionRequest(topic, payload);
      case "wc_sessionEvent":
        return this.onSessionEventRequest(topic, payload);
      case "wc_sessionAuthenticate":
        return this.onSessionAuthenticateRequest(topic, payload);
      default:
        return this.client.logger.info(`Unsupported request method ${reqMethod}`);
    }
  };

  private onRelayEventResponse: EnginePrivate["onRelayEventResponse"] = async (event) => {
    const { topic, payload } = event;
    const record = await this.client.core.history.get(topic, payload.id);
    const resMethod = record.request.method as JsonRpcTypes.WcMethod;
    switch (resMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeResponse(topic, payload);
      case "wc_sessionSettle":
        return this.onSessionSettleResponse(topic, payload);
      case "wc_sessionUpdate":
        return this.onSessionUpdateResponse(topic, payload);
      case "wc_sessionExtend":
        return this.onSessionExtendResponse(topic, payload);
      case "wc_sessionPing":
        return this.onSessionPingResponse(topic, payload);
      case "wc_sessionRequest":
        return this.onSessionRequestResponse(topic, payload);
      case "wc_sessionAuthenticate":
        return this.onSessionAuthenticateResponse(topic, payload);
      default:
        return this.client.logger.info(`Unsupported response method ${resMethod}`);
    }
  };

  private onRelayEventUnknownPayload: EnginePrivate["onRelayEventUnknownPayload"] = (event) => {
    const { topic } = event;
    const { message } = getInternalError(
      "MISSING_OR_INVALID",
      `Decoded payload on topic ${topic} is not identifiable as a JSON-RPC request or a response.`,
    );
    throw new Error(message);
  };

  private shouldIgnorePairingRequest: EnginePrivate["shouldIgnorePairingRequest"] = (params) => {
    const { topic, requestMethod } = params;
    const expectedMethods = this.expectedPairingMethodMap.get(topic);
    // check if the request method matches the expected method
    if (!expectedMethods) return false;
    if (expectedMethods.includes(requestMethod)) return false;

    /**
     * we want to make sure fallback session proposal is ignored only if there are subscribers
     * for the `session_authenticate` event, otherwise this would result in no-op for the user
     */
    if (expectedMethods.includes("wc_sessionAuthenticate")) {
      if (this.client.events.listenerCount("session_authenticate") > 0) {
        return true;
      }
    }
    return false;
  };

  // ---------- Relay Events Handlers --------------------------------- //

  private onSessionProposeRequest: EnginePrivate["onSessionProposeRequest"] = async (
    topic,
    payload,
  ) => {
    const { params, id } = payload;
    try {
      this.isValidConnect({ ...payload.params });
      const expiryTimestamp =
        params.expiryTimestamp || calcExpiry(ENGINE_RPC_OPTS.wc_sessionPropose.req.ttl);
      const proposal = { id, pairingTopic: topic, expiryTimestamp, ...params };
      await this.setProposal(id, proposal);
      const hash = hashMessage(JSON.stringify(payload));
      const verifyContext = await this.getVerifyContext(hash, proposal.proposer.metadata);
      this.client.events.emit("session_proposal", { id, params: proposal, verifyContext });
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
        rpcOpts: ENGINE_RPC_OPTS.wc_sessionPropose.autoReject,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionProposeResponse: EnginePrivate["onSessionProposeResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      const { result } = payload;
      this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", result });
      const proposal = this.client.proposal.get(id);
      this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", proposal });
      const selfPublicKey = proposal.proposer.publicKey;
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        selfPublicKey,
      });
      const peerPublicKey = result.responderPublicKey;
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        peerPublicKey,
      });
      const sessionTopic = await this.client.core.crypto.generateSharedKey(
        selfPublicKey,
        peerPublicKey,
      );
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        sessionTopic,
      });
      const subscriptionId = await this.client.core.relayer.subscribe(sessionTopic);
      this.client.logger.trace({
        type: "method",
        method: "onSessionProposeResponse",
        subscriptionId,
      });
      await this.client.core.pairing.activate({ topic });
    } else if (isJsonRpcError(payload)) {
      await this.client.proposal.delete(id, getSdkError("USER_DISCONNECTED"));
      const target = engineEvent("session_connect");
      const listeners = this.events.listenerCount(target);
      if (listeners === 0) {
        throw new Error(`emitting ${target} without any listeners, 954`);
      }
      this.events.emit(engineEvent("session_connect"), { error: payload.error });
    }
  };

  private onSessionSettleRequest: EnginePrivate["onSessionSettleRequest"] = async (
    topic,
    payload,
  ) => {
    const { id, params } = payload;
    try {
      this.isValidSessionSettleRequest(params);
      const {
        relay,
        controller,
        expiry,
        namespaces,
        sessionProperties,
        pairingTopic,
        sessionConfig,
      } = payload.params;
      const session = {
        topic,
        relay,
        expiry,
        namespaces,
        acknowledged: true,
        pairingTopic,
        requiredNamespaces: {},
        optionalNamespaces: {},
        controller: controller.publicKey,
        self: {
          publicKey: "",
          metadata: this.client.metadata,
        },
        peer: {
          publicKey: controller.publicKey,
          metadata: controller.metadata,
        },
        ...(sessionProperties && { sessionProperties }),
        ...(sessionConfig && { sessionConfig }),
      };
      await this.sendResult<"wc_sessionSettle">({
        id: payload.id,
        topic,
        result: true,
        throwOnFailedPublish: true,
      });
      const target = engineEvent("session_connect");
      const listeners = this.events.listenerCount(target);
      if (listeners === 0) {
        throw new Error(`emitting ${target} without any listeners 997`);
      }
      this.events.emit(engineEvent("session_connect"), { session });
      this.cleanupDuplicatePairings(session);
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionSettleResponse: EnginePrivate["onSessionSettleResponse"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      await this.client.session.update(topic, { acknowledged: true });
      this.events.emit(engineEvent("session_approve", id), {});
    } else if (isJsonRpcError(payload)) {
      await this.client.session.delete(topic, getSdkError("USER_DISCONNECTED"));
      this.events.emit(engineEvent("session_approve", id), { error: payload.error });
    }
  };

  private onSessionUpdateRequest: EnginePrivate["onSessionUpdateRequest"] = async (
    topic,
    payload,
  ) => {
    const { params, id } = payload;
    try {
      const memoryKey = `${topic}_session_update`;
      // compare the current request id with the last processed session update
      // we want to update only if the request is newer than the last processed one
      const lastSessionUpdateId = MemoryStore.get<number>(memoryKey);

      if (lastSessionUpdateId && this.isRequestOutOfSync(lastSessionUpdateId, id)) {
        this.client.logger.info(`Discarding out of sync request - ${id}`);
        this.sendError({ id, topic, error: getSdkError("INVALID_UPDATE_REQUEST") });
        return;
      }
      this.isValidUpdate({ topic, ...params });
      try {
        MemoryStore.set(memoryKey, id);
        await this.client.session.update(topic, { namespaces: params.namespaces });
        await this.sendResult<"wc_sessionUpdate">({
          id,
          topic,
          result: true,
          throwOnFailedPublish: true,
        });
      } catch (e) {
        MemoryStore.delete(memoryKey);
        throw e;
      }
      this.client.events.emit("session_update", { id, topic, params });
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  // compares the timestamp of the last processed request with the current request
  // client <-> client rpc ID is timestamp + 3 random digits
  private isRequestOutOfSync = (lastId: number, currentId: number) => {
    return parseInt(currentId.toString().slice(0, -3)) <= parseInt(lastId.toString().slice(0, -3));
  };

  private onSessionUpdateResponse: EnginePrivate["onSessionUpdateResponse"] = (_topic, payload) => {
    const { id } = payload;
    const target = engineEvent("session_update", id);
    const listeners = this.events.listenerCount(target);
    if (listeners === 0) {
      throw new Error(`emitting ${target} without any listeners`);
    }
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_update", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_update", id), { error: payload.error });
    }
  };

  private onSessionExtendRequest: EnginePrivate["onSessionExtendRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidExtend({ topic });
      await this.setExpiry(topic, calcExpiry(SESSION_EXPIRY));
      await this.sendResult<"wc_sessionExtend">({
        id,
        topic,
        result: true,
        throwOnFailedPublish: true,
      });
      this.client.events.emit("session_extend", { id, topic });
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionExtendResponse: EnginePrivate["onSessionExtendResponse"] = (_topic, payload) => {
    const { id } = payload;
    const target = engineEvent("session_extend", id);
    const listeners = this.events.listenerCount(target);
    if (listeners === 0) {
      throw new Error(`emitting ${target} without any listeners`);
    }
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_extend", id), {});
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_extend", id), { error: payload.error });
    }
  };

  private onSessionPingRequest: EnginePrivate["onSessionPingRequest"] = async (topic, payload) => {
    const { id } = payload;
    try {
      this.isValidPing({ topic });
      await this.sendResult<"wc_sessionPing">({
        id,
        topic,
        result: true,
        throwOnFailedPublish: true,
      });
      this.client.events.emit("session_ping", { id, topic });
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionPingResponse: EnginePrivate["onSessionPingResponse"] = (_topic, payload) => {
    const { id } = payload;
    const target = engineEvent("session_ping", id);
    const listeners = this.events.listenerCount(target);
    if (listeners === 0) {
      throw new Error(`emitting ${target} without any listeners`);
    }
    // put at the end of the stack to avoid a race condition
    // where session_ping listener is not yet initialized
    setTimeout(() => {
      if (isJsonRpcResult(payload)) {
        this.events.emit(engineEvent("session_ping", id), {});
      } else if (isJsonRpcError(payload)) {
        this.events.emit(engineEvent("session_ping", id), { error: payload.error });
      }
    }, 500);
  };

  private onSessionDeleteRequest: EnginePrivate["onSessionDeleteRequest"] = async (
    topic,
    payload,
  ) => {
    const { id } = payload;
    try {
      this.isValidDisconnect({ topic, reason: payload.params });
      await Promise.all([
        new Promise((resolve) => {
          // RPC request needs to happen before deletion as it utalises session encryption
          this.client.core.relayer.once(RELAYER_EVENTS.publish, async () => {
            resolve(await this.deleteSession({ topic, id }));
          });
        }),
        this.sendResult<"wc_sessionDelete">({
          id,
          topic,
          result: true,
          throwOnFailedPublish: true,
        }),
        this.cleanupPendingSentRequestsForTopic({ topic, error: getSdkError("USER_DISCONNECTED") }),
      ]);
    } catch (err: any) {
      this.client.logger.error(err);
    }
  };

  private onSessionRequest: EnginePrivate["onSessionRequest"] = async (topic, payload) => {
    const { id, params } = payload;
    try {
      await this.isValidRequest({ topic, ...params });
      const hash = hashMessage(
        JSON.stringify(formatJsonRpcRequest("wc_sessionRequest", params, id)),
      );
      const session = this.client.session.get(topic);
      const verifyContext = await this.getVerifyContext(hash, session.peer.metadata);
      const request = {
        id,
        topic,
        params,
        verifyContext,
      };
      await this.setPendingSessionRequest(request);
      if (this.client.signConfig?.disableRequestQueue) {
        this.emitSessionRequest(request);
      } else {
        this.addSessionRequestToSessionRequestQueue(request);
        this.processSessionRequestQueue();
      }
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionRequestResponse: EnginePrivate["onSessionRequestResponse"] = (
    _topic,
    payload,
  ) => {
    const { id } = payload;
    const target = engineEvent("session_request", id);
    const listeners = this.events.listenerCount(target);
    if (listeners === 0) {
      throw new Error(`emitting ${target} without any listeners`);
    }
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_request", id), { result: payload.result });
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_request", id), { error: payload.error });
    }
  };

  private onSessionEventRequest: EnginePrivate["onSessionEventRequest"] = async (
    topic,
    payload,
  ) => {
    const { id, params } = payload;
    try {
      // similar to session update, we want to discard out of sync requests
      // additionally we have to check the event type as well e.g. chainChanged/accountsChanged
      const memoryKey = `${topic}_session_event_${params.event.name}`;
      // compare the current request id with the last processed session update
      // we want to update only if the request is newer than the last processed one
      const lastSessionUpdateId = MemoryStore.get<number>(memoryKey);
      if (lastSessionUpdateId && this.isRequestOutOfSync(lastSessionUpdateId, id)) {
        this.client.logger.info(`Discarding out of sync request - ${id}`);
        return;
      }

      this.isValidEmit({ topic, ...params });
      this.client.events.emit("session_event", { id, topic, params });
      MemoryStore.set(memoryKey, id);
    } catch (err: any) {
      await this.sendError({
        id,
        topic,
        error: err,
      });
      this.client.logger.error(err);
    }
  };

  private onSessionAuthenticateResponse: EnginePrivate["onSessionAuthenticateResponse"] = (
    topic,
    payload,
  ) => {
    const { id } = payload;
    this.client.logger.trace({
      type: "method",
      method: "onSessionAuthenticateResponse",
      topic,
      payload,
    });
    if (isJsonRpcResult(payload)) {
      this.events.emit(engineEvent("session_request", id), { result: payload.result });
    } else if (isJsonRpcError(payload)) {
      this.events.emit(engineEvent("session_request", id), { error: payload.error });
    }
  };

  private onSessionAuthenticateRequest: EnginePrivate["onSessionAuthenticateRequest"] = async (
    topic,
    payload,
  ) => {
    try {
      const { requester, authPayload, expiryTimestamp } = payload.params;
      const hash = hashMessage(JSON.stringify(payload));
      const verifyContext = await this.getVerifyContext(hash, this.client.metadata);
      const pendingRequest = {
        requester,
        pairingTopic: topic,
        id: payload.id,
        authPayload,
        verifyContext,
        expiryTimestamp,
      };
      await this.setAuthRequest(payload.id, { request: pendingRequest, pairingTopic: topic });
      this.client.events.emit("session_authenticate", {
        topic,
        params: payload.params,
        id: payload.id,
      });
    } catch (err: any) {
      this.client.logger.error(err);

      const receiverPublicKey = payload.params.requester.publicKey;
      const senderPublicKey = await this.client.core.crypto.generateKeyPair();

      const encodeOpts = {
        type: TYPE_1,
        receiverPublicKey,
        senderPublicKey,
      };
      await this.sendError({
        id: payload.id,
        topic,
        error: err,
        encodeOpts,
        rpcOpts: ENGINE_RPC_OPTS.wc_sessionAuthenticate.autoReject,
      });
    }
  };

  private addSessionRequestToSessionRequestQueue = (request: PendingRequestTypes.Struct) => {
    this.sessionRequestQueue.queue.push(request);
  };

  private cleanupAfterResponse = (params: EngineTypes.RespondParams) => {
    this.deletePendingSessionRequest(params.response.id, { message: "fulfilled", code: 0 });
    // intentionally delay the emitting of the next pending request a bit
    setTimeout(() => {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.idle;
      this.processSessionRequestQueue();
    }, toMiliseconds(this.requestQueueDelay));
  };

  // Allows for cleanup on any sent pending requests if the peer disconnects the session before responding
  private cleanupPendingSentRequestsForTopic = ({
    topic,
    error,
  }: {
    topic: string;
    error: ErrorResponse;
  }) => {
    const pendingRequests = this.client.core.history.pending;
    if (pendingRequests.length > 0) {
      const forSession = pendingRequests.filter(
        (r) => r.topic === topic && r.request.method === "wc_sessionRequest",
      );
      forSession.forEach((r) => {
        const id = r.request.id;
        const target = engineEvent("session_request", id);
        const listeners = this.events.listenerCount(target);
        if (listeners === 0) {
          throw new Error(`emitting ${target} without any listeners`);
        }
        // notify .request() handler of the rejection
        this.events.emit(engineEvent("session_request", r.request.id), {
          error,
        });
      });
    }
  };

  private processSessionRequestQueue = () => {
    if (this.sessionRequestQueue.state === ENGINE_QUEUE_STATES.active) {
      this.client.logger.info("session request queue is already active.");
      return;
    }
    // Select the first/oldest request in the array to ensure last-in-first-out (LIFO)
    const request = this.sessionRequestQueue.queue[0];
    if (!request) {
      this.client.logger.info("session request queue is empty.");
      return;
    }

    try {
      this.sessionRequestQueue.state = ENGINE_QUEUE_STATES.active;
      this.emitSessionRequest(request);
    } catch (error) {
      this.client.logger.error(error);
    }
  };

  private emitSessionRequest = (request: PendingRequestTypes.Struct) => {
    this.client.events.emit("session_request", request);
  };

  // ---------- Expirer Events ---------------------------------------- //

  private registerExpirerEvents() {
    this.client.core.expirer.on(EXPIRER_EVENTS.expired, async (event: ExpirerTypes.Expiration) => {
      const { topic, id } = parseExpirerTarget(event.target);
      if (id && this.client.pendingRequest.keys.includes(id)) {
        return await this.deletePendingSessionRequest(id, getInternalError("EXPIRED"), true);
      }
      if (id && this.client.auth.requests.keys.includes(id)) {
        return await this.deletePendingAuthRequest(id, getInternalError("EXPIRED"), true);
      }

      if (topic) {
        if (this.client.session.keys.includes(topic)) {
          await this.deleteSession({ topic, expirerHasDeleted: true });
          this.client.events.emit("session_expire", { topic });
        }
      } else if (id) {
        await this.deleteProposal(id, true);
        this.client.events.emit("proposal_expire", { id });
      }
    });
  }

  // ---------- Pairing Events ---------------------------------------- //
  private registerPairingEvents() {
    this.client.core.pairing.events.on(PAIRING_EVENTS.create, (pairing: PairingTypes.Struct) =>
      this.onPairingCreated(pairing),
    );
    this.client.core.pairing.events.on(PAIRING_EVENTS.delete, (pairing: PairingTypes.Struct) => {
      this.addToRecentlyDeleted(pairing.topic, "pairing");
    });
  }

  /**
   * when a pairing is created, we check if there is a pending proposal for it.
   * if there is, we send it to onSessionProposeRequest to be processed as if it was received from the relay.
   * It allows QR/URI to be scanned multiple times without having to create new pairing.
   */
  private onPairingCreated = (pairing: PairingTypes.Struct) => {
    if (pairing.methods) {
      this.expectedPairingMethodMap.set(pairing.topic, pairing.methods);
    }
    if (pairing.active) return;
    const proposals = this.client.proposal.getAll();
    const proposal = proposals.find((p) => p.pairingTopic === pairing.topic);
    if (!proposal) return;
    this.onSessionProposeRequest(
      pairing.topic,
      formatJsonRpcRequest(
        "wc_sessionPropose",
        {
          requiredNamespaces: proposal.requiredNamespaces,
          optionalNamespaces: proposal.optionalNamespaces,
          relays: proposal.relays,
          proposer: proposal.proposer,
          sessionProperties: proposal.sessionProperties,
        },
        proposal.id,
      ),
    );
  };

  // ---------- Validation Helpers ------------------------------------ //
  private isValidPairingTopic(topic: any) {
    if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `pairing topic should be a string: ${topic}`,
      );
      throw new Error(message);
    }
    if (!this.client.core.pairing.pairings.keys.includes(topic)) {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `pairing topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
    if (isExpired(this.client.core.pairing.pairings.get(topic).expiry)) {
      const { message } = getInternalError("EXPIRED", `pairing topic: ${topic}`);
      throw new Error(message);
    }
  }

  private async isValidSessionTopic(topic: any) {
    if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `session topic should be a string: ${topic}`,
      );
      throw new Error(message);
    }
    // Store will throw custom message if topic was recently deleted
    this.checkRecentlyDeleted(topic);
    if (!this.client.session.keys.includes(topic)) {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `session topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
    if (isExpired(this.client.session.get(topic).expiry)) {
      await this.deleteSession({ topic });
      const { message } = getInternalError("EXPIRED", `session topic: ${topic}`);
      throw new Error(message);
    }

    if (!this.client.core.crypto.keychain.has(topic)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `session topic does not exist in keychain: ${topic}`,
      );
      await this.deleteSession({ topic });
      throw new Error(message);
    }
  }

  private async isValidSessionOrPairingTopic(topic: string) {
    this.checkRecentlyDeleted(topic);
    if (this.client.session.keys.includes(topic)) {
      await this.isValidSessionTopic(topic);
    } else if (this.client.core.pairing.pairings.keys.includes(topic)) {
      this.isValidPairingTopic(topic);
    } else if (!isValidString(topic, false)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `session or pairing topic should be a string: ${topic}`,
      );
      throw new Error(message);
    } else {
      const { message } = getInternalError(
        "NO_MATCHING_KEY",
        `session or pairing topic doesn't exist: ${topic}`,
      );
      throw new Error(message);
    }
  }

  private async isValidProposalId(id: any) {
    if (!isValidId(id)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `proposal id should be a number: ${id}`,
      );
      throw new Error(message);
    }
    if (!this.client.proposal.keys.includes(id)) {
      const { message } = getInternalError("NO_MATCHING_KEY", `proposal id doesn't exist: ${id}`);
      throw new Error(message);
    }
    if (isExpired(this.client.proposal.get(id).expiryTimestamp)) {
      await this.deleteProposal(id);
      const { message } = getInternalError("EXPIRED", `proposal id: ${id}`);
      throw new Error(message);
    }
  }

  // ---------- Validation  ------------------------------------------- //

  private isValidConnect: EnginePrivate["isValidConnect"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `connect() params: ${JSON.stringify(params)}`,
      );
      throw new Error(message);
    }
    const { pairingTopic, requiredNamespaces, optionalNamespaces, sessionProperties, relays } =
      params;
    if (!isUndefined(pairingTopic)) await this.isValidPairingTopic(pairingTopic);

    if (!isValidRelays(relays, true)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `connect() relays: ${relays}`);
      throw new Error(message);
    }

    // validate required namespaces only if they are defined
    if (!isUndefined(requiredNamespaces) && isValidObject(requiredNamespaces) !== 0) {
      this.validateNamespaces(requiredNamespaces, "requiredNamespaces");
    }

    // validate optional namespaces only if they are defined
    if (!isUndefined(optionalNamespaces) && isValidObject(optionalNamespaces) !== 0) {
      this.validateNamespaces(optionalNamespaces, "optionalNamespaces");
    }

    // validate session properties only if they are defined
    if (!isUndefined(sessionProperties)) {
      this.validateSessionProps(sessionProperties, "sessionProperties");
    }
  };

  private validateNamespaces = (
    namespaces: ProposalTypes.RequiredNamespaces | ProposalTypes.OptionalNamespaces,
    type: string,
  ) => {
    const validRequiredNamespacesError = isValidRequiredNamespaces(namespaces, "connect()", type);
    if (validRequiredNamespacesError) throw new Error(validRequiredNamespacesError.message);
  };

  private isValidApprove: EnginePrivate["isValidApprove"] = async (params) => {
    if (!isValidParams(params))
      throw new Error(
        getInternalError("MISSING_OR_INVALID", `approve() params: ${params}`).message,
      );
    const { id, namespaces, relayProtocol, sessionProperties } = params;

    this.checkRecentlyDeleted(id);
    await this.isValidProposalId(id);
    const proposal = this.client.proposal.get(id);
    const validNamespacesError = isValidNamespaces(namespaces, "approve()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    const conformingNamespacesError = isConformingNamespaces(
      proposal.requiredNamespaces,
      namespaces,
      "approve()",
    );
    if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    if (!isValidString(relayProtocol, true)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `approve() relayProtocol: ${relayProtocol}`,
      );
      throw new Error(message);
    }

    if (!isUndefined(sessionProperties)) {
      this.validateSessionProps(sessionProperties, "sessionProperties");
    }
  };

  private isValidReject: EnginePrivate["isValidReject"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `reject() params: ${params}`);
      throw new Error(message);
    }
    const { id, reason } = params;
    this.checkRecentlyDeleted(id);
    await this.isValidProposalId(id);
    if (!isValidErrorReason(reason)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `reject() reason: ${JSON.stringify(reason)}`,
      );
      throw new Error(message);
    }
  };

  private isValidSessionSettleRequest: EnginePrivate["isValidSessionSettleRequest"] = (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `onSessionSettleRequest() params: ${params}`,
      );
      throw new Error(message);
    }
    const { relay, controller, namespaces, expiry } = params;
    if (!isValidRelay(relay)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `onSessionSettleRequest() relay protocol should be a string`,
      );
      throw new Error(message);
    }
    const validControllerError = isValidController(controller, "onSessionSettleRequest()");
    if (validControllerError) throw new Error(validControllerError.message);
    const validNamespacesError = isValidNamespaces(namespaces, "onSessionSettleRequest()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    if (isExpired(expiry)) {
      const { message } = getInternalError("EXPIRED", `onSessionSettleRequest()`);
      throw new Error(message);
    }
  };

  private isValidUpdate: EnginePrivate["isValidUpdate"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `update() params: ${params}`);
      throw new Error(message);
    }
    const { topic, namespaces } = params;

    this.checkRecentlyDeleted(topic);
    await this.isValidSessionTopic(topic);
    const session = this.client.session.get(topic);
    const validNamespacesError = isValidNamespaces(namespaces, "update()");
    if (validNamespacesError) throw new Error(validNamespacesError.message);
    const conformingNamespacesError = isConformingNamespaces(
      session.requiredNamespaces,
      namespaces,
      "update()",
    );
    if (conformingNamespacesError) throw new Error(conformingNamespacesError.message);
    // TODO(ilja) - check if wallet
  };

  private isValidExtend: EnginePrivate["isValidExtend"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `extend() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;

    this.checkRecentlyDeleted(topic);
    await this.isValidSessionTopic(topic);
  };

  private isValidRequest: EnginePrivate["isValidRequest"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `request() params: ${params}`);
      throw new Error(message);
    }
    const { topic, request, chainId, expiry } = params;
    this.checkRecentlyDeleted(topic);
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `request() chainId: ${chainId}`);
      throw new Error(message);
    }
    if (!isValidRequest(request)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() ${JSON.stringify(request)}`,
      );
      throw new Error(message);
    }
    if (!isValidNamespacesRequest(namespaces, chainId, request.method)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() method: ${request.method}`,
      );
      throw new Error(message);
    }
    if (expiry && !isValidRequestExpiry(expiry, SESSION_REQUEST_EXPIRY_BOUNDARIES)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `request() expiry: ${expiry}. Expiry must be a number (in seconds) between ${SESSION_REQUEST_EXPIRY_BOUNDARIES.min} and ${SESSION_REQUEST_EXPIRY_BOUNDARIES.max}`,
      );
      throw new Error(message);
    }
  };

  private isValidRespond: EnginePrivate["isValidRespond"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `respond() params: ${params}`);
      throw new Error(message);
    }
    const { topic, response } = params;
    try {
      // if the session is already disconnected, we can't respond to the request so we need to delete it
      await this.isValidSessionTopic(topic);
    } catch (error) {
      if (params?.response?.id) this.cleanupAfterResponse(params);
      throw error;
    }
    if (!isValidResponse(response)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `respond() response: ${JSON.stringify(response)}`,
      );
      throw new Error(message);
    }
  };

  private isValidPing: EnginePrivate["isValidPing"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `ping() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };

  private isValidEmit: EnginePrivate["isValidEmit"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `emit() params: ${params}`);
      throw new Error(message);
    }
    const { topic, event, chainId } = params;
    await this.isValidSessionTopic(topic);
    const { namespaces } = this.client.session.get(topic);
    if (!isValidNamespacesChainId(namespaces, chainId)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `emit() chainId: ${chainId}`);
      throw new Error(message);
    }
    if (!isValidEvent(event)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `emit() event: ${JSON.stringify(event)}`,
      );
      throw new Error(message);
    }
    if (!isValidNamespacesEvent(namespaces, chainId, event.name)) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `emit() event: ${JSON.stringify(event)}`,
      );
      throw new Error(message);
    }
  };

  private isValidDisconnect: EnginePrivate["isValidDisconnect"] = async (params) => {
    if (!isValidParams(params)) {
      const { message } = getInternalError("MISSING_OR_INVALID", `disconnect() params: ${params}`);
      throw new Error(message);
    }
    const { topic } = params;
    await this.isValidSessionOrPairingTopic(topic);
  };

  private isValidAuthenticate = (params: AuthTypes.SessionAuthenticateParams) => {
    const { chains, uri, domain, nonce } = params;

    // ----- validate params ----- //
    if (!Array.isArray(chains) || chains.length === 0) {
      throw new Error("chains is required and must be a non-empty array");
    }
    if (!isValidString(uri, false)) {
      throw new Error("uri is required parameter");
    }
    if (!isValidString(domain, false)) {
      throw new Error("domain is required parameter");
    }
    if (!isValidString(nonce, false)) {
      throw new Error("nonce is required parameter");
    }

    // ----- reject multi namespaces ----- //
    const uniqueNamespaces = [...new Set(chains.map((chain) => parseChainId(chain).namespace))];
    if (uniqueNamespaces.length > 1) {
      throw new Error(
        "Multi-namespace requests are not supported. Please request single namespace only.",
      );
    }

    const { namespace } = parseChainId(chains[0]);
    if (namespace !== "eip155") {
      throw new Error(
        "Only eip155 namespace is supported for authenticated sessions. Please use .connect() for non-eip155 chains.",
      );
    }
  };

  private getVerifyContext = async (hash: string, metadata: CoreTypes.Metadata) => {
    const context: Verify.Context = {
      verified: {
        verifyUrl: metadata.verifyUrl || VERIFY_SERVER,
        validation: "UNKNOWN",
        origin: metadata.url || "",
      },
    };

    try {
      const result = await this.client.core.verify.resolve({
        attestationId: hash,
        verifyUrl: metadata.verifyUrl,
      });
      if (result) {
        context.verified.origin = result.origin;
        context.verified.isScam = result.isScam;
        context.verified.validation =
          result.origin === new URL(metadata.url).origin ? "VALID" : "INVALID";
      }
    } catch (e) {
      this.client.logger.info(e);
    }

    this.client.logger.info(`Verify context: ${JSON.stringify(context)}`);
    return context;
  };

  private validateSessionProps = (properties: ProposalTypes.SessionProperties, type: string) => {
    Object.values(properties).forEach((property) => {
      if (!isValidString(property, false)) {
        const { message } = getInternalError(
          "MISSING_OR_INVALID",
          `${type} must be in Record<string, string> format. Received: ${JSON.stringify(property)}`,
        );
        throw new Error(message);
      }
    });
  };

  private getPendingAuthRequest = (id: number) => {
    const request = this.client.auth.requests.get(id);
    return typeof request === "object" ? request : undefined;
  };

  private addToRecentlyDeleted = (
    id: string | number,
    type: "pairing" | "session" | "proposal" | "request",
  ) => {
    this.recentlyDeletedMap.set(id, type);
    // remove first half of the map if it exceeds the limit
    if (this.recentlyDeletedMap.size >= this.recentlyDeletedLimit) {
      let i = 0;
      const numItemsToDelete = this.recentlyDeletedLimit / 2;
      for (const k of this.recentlyDeletedMap.keys()) {
        if (i++ >= numItemsToDelete) {
          break;
        }
        this.recentlyDeletedMap.delete(k);
      }
    }
  };

  private checkRecentlyDeleted = (id: string | number) => {
    const deletedRecord = this.recentlyDeletedMap.get(id);
    if (deletedRecord) {
      const { message } = getInternalError(
        "MISSING_OR_INVALID",
        `Record was recently deleted - ${deletedRecord}: ${id}`,
      );
      throw new Error(message);
    }
  };
}
