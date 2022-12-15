import { AuthClient, IAuthClient } from "@walletconnect/auth-client";
import { SignClient } from "../../../sign-client";
import { ISignClient, SessionTypes } from "@walletconnect/types";
import { IWeb3WalletEngine } from "../types";

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
    return await this.signClient.respond(params);
  };

  public disconnectSession: IWeb3WalletEngine["disconnectSession"] = async (params) => {
    return await this.signClient.disconnect(params);
  };

  public emitSessionEvent: IWeb3WalletEngine["emitSessionEvent"] = async (params) => {
    return await new Promise<void>((resolve) => () => resolve);
  };

  public getActiveSessions: IWeb3WalletEngine["getActiveSessions"] = async () => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  public getPendingSessionProposals: IWeb3WalletEngine["getPendingSessionProposals"] = async () => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  public getPendingSessionRequests: IWeb3WalletEngine["getPendingSessionRequests"] = async () => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  // Auth //
  public respondAuthRequest: IWeb3WalletEngine["respondAuthRequest"] = async (params) => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  public getPendingAuthRequests: IWeb3WalletEngine["getPendingAuthRequests"] = async () => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  public formatMessage: IWeb3WalletEngine["formatMessage"] = async (params) => {
    return await new Promise<any>((resolve) => () => resolve);
  };

  private initializeEventListeners = () => {
    this.signClient.events.on("session_proposal", (params) => {
      this.client.events.emit("session_proposal", params);
    });

    this.signClient.events.on("session_request", (params) => {
      console.log("@engine session_request", params);
      this.client.events.emit("session_request", params);
    });
  };
}
