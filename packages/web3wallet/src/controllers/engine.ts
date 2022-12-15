import { AuthClient, IAuthClient } from "@walletconnect/auth-client";
import { SignClient } from "@walletconnect/sign-client";
import { ISignClient } from "@walletconnect/types";
import { IWeb3WalletEngine, Web3WalletTypes } from "../types";

export class Engine extends IWeb3WalletEngine {
  public signClient: ISignClient;
  public authClient: IAuthClient;

  constructor(client: IWeb3WalletEngine["client"]) {
    super(client);
    // initilized in init()
    this.signClient = {} as any;
    this.authClient = {} as any;
  }

  public init = async () => {
    // await this.client.core.start();
    this.signClient = await SignClient.init({
      core: this.client.core,
      projectId: "",
      metadata: {} as any,
    });
    this.authClient = await AuthClient.init({
      core: this.client.core,
      projectId: "",
      metadata: {} as any,
    });

    this.initializeEventListeners();
    // eslint-disable-next-line no-console
    console.log("Engine.start");
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
    this.client.pendingRequest.delete(params.response.id, { message: "fulfilled", code: 0 });
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
    return this.client.pendingRequest.getAll();
  };

  // Auth //
  public respondAuthRequest: IWeb3WalletEngine["respondAuthRequest"] = async (params, iss) => {
    return await this.authClient.respond(params, iss);
  };

  public getPendingAuthRequests: IWeb3WalletEngine["getPendingAuthRequests"] = async () => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  public formatMessage: IWeb3WalletEngine["formatMessage"] = (params, iss) => {
    return this.authClient.formatMessage(params, iss);
  };

  private onSessionRequest = (event: Web3WalletTypes.SessionRequest) => {
    this.client.pendingRequest.set(event.id, event);
    this.client.events.emit("session_request", event);
  };

  private onSessionProposal = (event: Web3WalletTypes.SessionProposal) => {
    this.client.events.emit("session_proposal", event);
  };

  private onAuthRequest = (event: Web3WalletTypes.AuthRequest) => {
    this.client.events.emit("auth_request", event);
  };

  private initializeEventListeners = () => {
    this.signClient.events.on("session_proposal", this.onSessionProposal);
    this.signClient.events.on("session_request", this.onSessionRequest);
    this.authClient.on("auth_request", this.onAuthRequest);
  };
}
