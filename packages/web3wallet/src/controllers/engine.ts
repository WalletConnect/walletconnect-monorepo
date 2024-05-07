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
      signConfig: this.client.signConfig,
    });
    this.authClient = await AuthClient.init({
      core: this.client.core,
      projectId: "",
      metadata: this.client.metadata,
    });
  };

  public pair: IWeb3WalletEngine["pair"] = async (params) => {
    await this.client.core.pairing.pair(params);
  };

  // Sign //
  public approveSession: IWeb3WalletEngine["approveSession"] = async (sessionProposal) => {
    const { topic, acknowledged } = await this.signClient.approve({
      ...sessionProposal,
      id: sessionProposal.id,
      namespaces: sessionProposal.namespaces,
      sessionProperties: sessionProposal.sessionProperties,
      sessionConfig: sessionProposal.sessionConfig,
    });
    await acknowledged();
    return this.signClient.session.get(topic);
  };

  public rejectSession: IWeb3WalletEngine["rejectSession"] = async (params) => {
    return await this.signClient.reject(params);
  };

  public updateSession: IWeb3WalletEngine["updateSession"] = async (params) => {
    return await this.signClient.update(params);
  };

  public extendSession: IWeb3WalletEngine["extendSession"] = async (params) => {
    return await this.signClient.extend(params);
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

  // Multi chain Auth //
  public approveSessionAuthenticate: IWeb3WalletEngine["approveSessionAuthenticate"] = async (
    params,
  ) => {
    return await this.signClient.approveSessionAuthenticate(params);
  };

  public rejectSessionAuthenticate: IWeb3WalletEngine["rejectSessionAuthenticate"] = async (
    params,
  ) => {
    return await this.signClient.rejectSessionAuthenticate(params);
  };

  public formatAuthMessage: IWeb3WalletEngine["formatAuthMessage"] = (params) => {
    return this.signClient.formatAuthMessage(params);
  };

  // Push //
  public registerDeviceToken: IWeb3WalletEngine["registerDeviceToken"] = (params) => {
    return this.client.core.echoClient.registerDeviceToken(params);
  };

  // ---------- public events ----------------------------------------------- //
  public on: IWeb3WalletEngine["on"] = (name, listener) => {
    this.setEvent(name, "on");
    return this.client.events.on(name, listener);
  };

  public once: IWeb3WalletEngine["once"] = (name, listener) => {
    this.setEvent(name, "once");
    return this.client.events.once(name, listener);
  };

  public off: IWeb3WalletEngine["off"] = (name, listener) => {
    this.setEvent(name, "off");
    return this.client.events.off(name, listener);
  };

  public removeListener: IWeb3WalletEngine["removeListener"] = (name, listener) => {
    this.setEvent(name, "removeListener");
    return this.client.events.removeListener(name, listener);
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

  private onProposalExpire = (event: Web3WalletTypes.ProposalExpire) => {
    this.client.events.emit("proposal_expire", event);
  };

  private onSessionRequestExpire = (event: Web3WalletTypes.SessionRequestExpire) => {
    this.client.events.emit("session_request_expire", event);
  };

  private onSessionRequestAuthenticate = (event: Web3WalletTypes.SessionAuthenticate) => {
    this.client.events.emit("session_authenticate", event);
  };

  private setEvent = (
    event: Web3WalletTypes.Event,
    action: "on" | "off" | "once" | "removeListener",
  ) => {
    switch (event) {
      case "session_request":
        this.signClient.events[action]("session_request", this.onSessionRequest);
        break;
      case "session_proposal":
        this.signClient.events[action]("session_proposal", this.onSessionProposal);
        break;
      case "session_delete":
        this.signClient.events[action]("session_delete", this.onSessionDelete);
        break;
      case "auth_request":
        this.authClient[action]("auth_request", this.onAuthRequest);
        break;
      case "proposal_expire":
        this.signClient.events[action]("proposal_expire", this.onProposalExpire);
        break;
      case "session_request_expire":
        this.signClient.events[action]("session_request_expire", this.onSessionRequestExpire);
        break;
      case "session_authenticate":
        this.signClient.events[action]("session_authenticate", this.onSessionRequestAuthenticate);
        break;
    }
  };
}
