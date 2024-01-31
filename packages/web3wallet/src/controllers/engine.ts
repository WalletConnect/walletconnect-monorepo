import { AuthClient, AuthEngineTypes, IAuthClient } from "@walletconnect/auth-client";
import { SignClient } from "@walletconnect/sign-client";
import { ISignClient } from "@walletconnect/types";
import { IWeb3WalletEngine, Web3WalletTypes } from "../types";

export class Engine extends IWeb3WalletEngine {
  public signClient: ISignClient;
  public authClient: IAuthClient;

  constructor(client: IWeb3WalletEngine["client"]) {
    super(client);
    // initialized in init()
    this.signClient = {} as any;
    this.authClient = {} as any;
  }

  public init = async () => {
    this.signClient = await SignClient.init({
      core: this.client.core,
      metadata: this.client.metadata,
    });
    this.authClient = await AuthClient.init({
      core: this.client.core,
      projectId: "",
      metadata: this.client.metadata,
    });

    this.initializeEventListeners();
  };

  public pair: IWeb3WalletEngine["pair"] = async (params) => {
    await this.client.core.pairing.pair(params);
  };

  // Sign //
  public approveSession: IWeb3WalletEngine["approveSession"] = async (sessionProposal) => {
    const { topic, acknowledged } = await this.signClient.approve({
      id: sessionProposal.id,
      namespaces: sessionProposal.namespaces,
    });
    await acknowledged();
    return this.signClient.session.get(topic);
  };

  public rejectSession: IWeb3WalletEngine["rejectSession"] = async (params) => {
    return await this.signClient.reject(params);
  };

  public updateSession: IWeb3WalletEngine["updateSession"] = async (params) => {
    return await (await this.signClient.update(params)).acknowledged();
  };

  public extendSession: IWeb3WalletEngine["extendSession"] = async (params) => {
    return await (await this.signClient.extend(params)).acknowledged();
  };

  public respondSessionRequest: IWeb3WalletEngine["respondSessionRequest"] = async (params) => {
    const result = await this.signClient.respond(params);
    return result;
  };

  public disconnectSession: IWeb3WalletEngine["disconnectSession"] = async (params) => {
    return await this.signClient.disconnect(params);
  };

  public emitSessionEvent: IWeb3WalletEngine["emitSessionEvent"] = async (params) => {
    return await this.signClient.emit(params);
  };

  public getActiveSessions: IWeb3WalletEngine["getActiveSessions"] = () => {
    const sessions = this.signClient.session.getAll();
    return sessions.reduce((sessions, session) => {
      sessions[session.topic] = session;
      return sessions;
    }, {});
  };

  public getPendingSessionProposals: IWeb3WalletEngine["getPendingSessionProposals"] = () => {
    return this.signClient.proposal.getAll();
  };

  public getPendingSessionRequests: IWeb3WalletEngine["getPendingSessionRequests"] = () => {
    return this.signClient.getPendingSessionRequests();
  };

  // Auth //
  public respondAuthRequest: IWeb3WalletEngine["respondAuthRequest"] = async (params, iss) => {
    return await this.authClient.respond(params, iss);
  };

  public getPendingAuthRequests: IWeb3WalletEngine["getPendingAuthRequests"] = () => {
    return this.authClient.requests
      .getAll()
      .filter((request) => "requester" in request) as AuthEngineTypes.PendingRequest[];
  };

  public formatMessage: IWeb3WalletEngine["formatMessage"] = (params, iss) => {
    return this.authClient.formatMessage(params, iss);
  };

  // Push //
  public registerDeviceToken: IWeb3WalletEngine["registerDeviceToken"] = (params) => {
    return this.client.core.echoClient.registerDeviceToken(params);
  };

  // ---------- Private ----------------------------------------------- //

  private onSessionRequest = (event: Web3WalletTypes.SessionRequest) => {
    this.client.events.emit("session_request", event);
  };

  private onSessionProposal = (event: Web3WalletTypes.SessionProposal) => {
    this.client.events.emit("session_proposal", event);
  };

  private onSessionDelete = (event: Web3WalletTypes.SessionDelete) => {
    this.client.events.emit("session_delete", event);
  };

  private onAuthRequest = (event: Web3WalletTypes.AuthRequest) => {
    this.client.events.emit("auth_request", event);
  };

  private initializeEventListeners = () => {
    this.signClient.events.on("session_proposal", this.onSessionProposal);
    this.signClient.events.on("session_request", this.onSessionRequest);
    this.signClient.events.on("session_delete", this.onSessionDelete);
    this.authClient.on("auth_request", this.onAuthRequest);
  };
}
