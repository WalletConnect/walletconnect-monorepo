import * as React from "react";
import styled from "styled-components";
import KeyValueStorage from "keyvaluestorage";
import Wallet from "caip-wallet";
import Client, { CLIENT_EVENTS } from "@walletconnect/client";
import { JsonRpcResponse, formatJsonRpcError, formatJsonRpcResult } from "@json-rpc-tools/utils";
import { ERROR, getAppMetadata } from "@walletconnect/utils";
import { SessionTypes } from "@walletconnect/types";
import { apiGetChainNamespace, apiGetChainJsonRpc, ChainsMap, ChainJsonRpc } from "caip-api";

import Card from "./components/Card";
import Scanner, { ScannerValidation } from "./components/Scanner";

import DefaultCard from "./cards/DefaultCard";
import RequestCard from "./cards/RequestCard";
import ProposalCard from "./cards/ProposalCard";
import SessionCard from "./cards/SessionCard";
import SettingsCard from "./cards/SettingsCard";

import {
  DEFAULT_APP_METADATA,
  DEFAULT_TEST_CHAINS,
  DEFAULT_CHAINS,
  DEFAULT_LOGGER,
  DEFAULT_EIP155_METHODS,
  DEFAULT_COSMOS_METHODS,
  DEFAULT_RELAY_PROVIDER,
  DEFAULT_MAIN_CHAINS,
} from "./constants";
import {
  Cards,
  ChainNamespaces,
  isProposalCard,
  isRequestCard,
  isSessionCard,
  isSettingsCard,
} from "./helpers";

const SContainer = styled.div`
  display: flex;
  flex-direction: column;

  width: 100%;
  min-height: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
`;

const SVersionNumber = styled.div`
  position: absolute;
  font-size: 12px;
  bottom: 6%;
  right: 0;
  opacity: 0.3;
  transform: rotate(-90deg);
`;

const SContent = styled.div`
  width: 100%;
  flex: 1;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export interface AppState {
  client: Client | undefined;
  storage: KeyValueStorage | undefined;
  wallet: Wallet | undefined;
  loading: boolean;
  scanner: boolean;
  testnet: boolean;
  chains: string[];
  chainData: ChainNamespaces;
  jsonrpc: Record<string, ChainJsonRpc>;
  accounts: string[];
  sessions: SessionTypes.Created[];
  requests: SessionTypes.RequestEvent[];
  results: any[];
  card: Cards.All;
}

export const INITIAL_STATE: AppState = {
  client: undefined,
  storage: undefined,
  wallet: undefined,
  loading: false,
  scanner: false,
  testnet: true,
  chains: DEFAULT_TEST_CHAINS,
  chainData: {},
  jsonrpc: {},
  accounts: [],
  sessions: [],
  requests: [],
  results: [],
  card: { type: "default", data: {} },
};

class App extends React.Component<{}> {
  public state: AppState;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE,
    };
  }
  public componentDidMount() {
    this.init(this.state.chains);
  }

  public init = async (chains: string[], mnemonic?: string) => {
    console.log("loading true");
    this.setState({ chains, loading: true });
    try {
      await this.loadChainData();
      await this.loadChainJsonRpc();
      const storage = new KeyValueStorage();
      const wallet = await Wallet.init({ chains, storage, mnemonic });
      const client = await Client.init({
        controller: true,
        relayProvider: DEFAULT_RELAY_PROVIDER,
        logger: DEFAULT_LOGGER,
        storage,
      });
      const accounts = await wallet.getAccounts();
      console.log("loading false");
      this.setState({ loading: false, storage, client, wallet, accounts });
      this.subscribeToEvents();
      await this.checkPersistedState();
    } catch (e) {
      console.error(e);
      console.log("loading false");
      this.setState({ loading: false });
      throw e;
    }
  };

  public getAllNamespaces() {
    const namespaces: string[] = [];
    DEFAULT_CHAINS.forEach(chainId => {
      const [namespace] = chainId.split(":");
      if (!namespaces.includes(namespace)) {
        namespaces.push(namespace);
      }
    });
    return namespaces;
  }

  public async loadChainData(): Promise<void> {
    const namespaces = this.getAllNamespaces();
    const chainData: ChainNamespaces = {};
    await Promise.all(
      namespaces.map(async namespace => {
        let chains: ChainsMap | undefined;
        try {
          chains = await apiGetChainNamespace(namespace);
        } catch (e) {
          console.error(e);
          // ignore error
        }
        if (typeof chains !== "undefined") {
          chainData[namespace] = chains;
        }
      }),
    );
    this.setState({ chainData });
  }

  public async loadChainJsonRpc(): Promise<void> {
    const namespaces = this.getAllNamespaces();
    const jsonrpc: Record<string, ChainJsonRpc> = {};
    await Promise.all(
      namespaces.map(async namespace => {
        let rpc: ChainJsonRpc | undefined;
        try {
          rpc = await apiGetChainJsonRpc(namespace);
        } catch (e) {
          console.error(e);
          // ignore error
        }
        if (typeof rpc !== "undefined") {
          jsonrpc[namespace] = rpc;
        }
      }),
    );

    this.setState({ jsonrpc });
  }

  public importMnemonic = async (mnemonic: string) => {
    await this.resetApp();
    await this.init(this.state.chains, mnemonic);
  };

  public toggleTestnets = async () => {
    await this.resetApp();
    const testnet = !this.state.testnet;
    this.setState({ testnet });
    const chains = testnet ? DEFAULT_TEST_CHAINS : DEFAULT_MAIN_CHAINS;
    await this.init(chains);
  };

  public resetApp = async () => {
    console.log("loading true");
    this.setState({ loading: true });
    try {
      const { chainData, jsonrpc } = this.state;
      await Promise.all(
        this.state.sessions.map(session =>
          this.state.client?.disconnect({
            topic: session.topic,
            reason: ERROR.USER_DISCONNECTED.format(),
          }),
        ),
      );
      console.log("loading false");
      this.setState({ ...INITIAL_STATE, loading: false, chainData, jsonrpc });
    } catch (e) {
      console.log("loading false");
      this.setState({ loading: false });
    }
  };

  public subscribeToEvents = () => {
    console.log("ACTION", "subscribeToEvents");

    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }

    this.state.client.on(CLIENT_EVENTS.session.proposal, (proposal: SessionTypes.Proposal) => {
      if (typeof this.state.client === "undefined") {
        throw new Error("Client is not initialized");
      }
      console.log("EVENT", "session_proposal");
      const supportedNamespaces: string[] = [];
      this.state.chains.forEach(chainId => {
        const [namespace] = chainId.split(":");
        if (!supportedNamespaces.includes(namespace)) {
          supportedNamespaces.push(namespace);
        }
      });
      const unsupportedChains = [];
      proposal.permissions.blockchain.chains.forEach(chainId => {
        if (this.state.chains.includes(chainId)) return;
        unsupportedChains.push(chainId);
      });
      if (unsupportedChains.length) {
        return this.state.client.reject({ proposal });
      }
      const unsupportedMethods: string[] = [];
      proposal.permissions.jsonrpc.methods.forEach(method => {
        if (
          (supportedNamespaces.includes("eip155") && DEFAULT_EIP155_METHODS.includes(method)) ||
          (supportedNamespaces.includes("cosmos") && DEFAULT_COSMOS_METHODS.includes(method))
        )
          return;
        unsupportedMethods.push(method);
      });
      if (unsupportedMethods.length) {
        return this.state.client.reject({ proposal });
      }
      this.openProposal(proposal);
    });

    this.state.client.on(
      CLIENT_EVENTS.session.request,
      async (requestEvent: SessionTypes.RequestEvent) => {
        if (typeof this.state.wallet === "undefined") {
          throw new Error("Wallet is not initialized");
        }
        // tslint:disable-next-line
        console.log("EVENT", "session_request", requestEvent.request);
        const chainId = requestEvent.chainId || this.state.chains[0];
        const [namespace] = chainId.split(":");
        try {
          console.log(
            "this.state.jsonrpc[namespace].methods.sign",
            this.state.jsonrpc[namespace].methods.sign,
          );
          // TODO: needs improvement
          const requiresApproval = this.state.jsonrpc[namespace].methods.sign.includes(
            requestEvent.request.method,
          );
          console.log("requestEvent.request.method", requestEvent.request.method);
          console.log("requiresApproval", requiresApproval);
          if (requiresApproval) {
            this.setState({ requests: [...this.state.requests, requestEvent] });
          } else {
            const result = await this.state.wallet.request(requestEvent.request, { chainId });
            const response = formatJsonRpcResult(requestEvent.request.id, result);
            await this.respondRequest(requestEvent.topic, response);
          }
        } catch (e) {
          console.error(e);
          const response = formatJsonRpcError(requestEvent.request.id, e.message);
          await this.respondRequest(requestEvent.topic, response);
        }
      },
    );

    this.state.client.on(CLIENT_EVENTS.session.created, () => {
      if (typeof this.state.client === "undefined") {
        throw new Error("Client is not initialized");
      }
      console.log("EVENT", "session_created");
      this.setState({ sessions: this.state.client.session.values });
    });

    this.state.client.on(CLIENT_EVENTS.session.deleted, () => {
      if (typeof this.state.client === "undefined") {
        throw new Error("Client is not initialized");
      }
      console.log("EVENT", "session_deleted");
      this.setState({ sessions: this.state.client.session.values });
    });
  };

  public checkPersistedState = async () => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    const requests = this.state.client.session.history.pending;
    const sessions = this.state.client.session.values;
    this.setState({ sessions, requests });
  };

  // ---- Scanner --------------------------------------------------------------//

  public openScanner = () => {
    console.log("ACTION", "openScanner");
    this.setState({ scanner: true });
  };

  public closeScanner = () => {
    console.log("ACTION", "closeScanner");
    this.setState({ scanner: false });
  };

  public onScannerValidate = (data: string) => {
    const res: ScannerValidation = { error: null, result: null };
    try {
      res.result = data;
    } catch (error) {
      res.error = error;
    }

    return res;
  };

  public onScannerScan = async (data: any) => {
    this.onURI(data);
    this.closeScanner();
  };

  public onScannerError = (error: Error) => {
    throw error;
  };

  public onScannerClose = () => this.closeScanner();

  public onURI = async (data: any) => {
    const uri = typeof data === "string" ? data : "";
    if (!uri) return;
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    await this.state.client.pair({ uri });
  };

  // ---- Cards --------------------------------------------------------------//

  public openCard = (card: Cards.All) => this.setState({ card });

  public resetCard = () => this.setState({ card: INITIAL_STATE.card });

  public openProposal = (proposal: SessionTypes.Proposal) =>
    this.openCard({ type: "proposal", data: { proposal } });

  public openSession = (session: SessionTypes.Created) =>
    this.openCard({ type: "session", data: { session } });

  public openRequest = async (requestEvent: SessionTypes.RequestEvent) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    const { peer } = await this.state.client.session.get(requestEvent.topic);
    this.openCard({ type: "request", data: { requestEvent, peer } });
  };

  public openSettings = () => {
    if (typeof this.state.wallet === "undefined") {
      throw new Error("Wallet is not initialized");
    }
    const { chains } = this.state;
    const { mnemonic } = this.state.wallet;
    this.openCard({ type: "settings", data: { mnemonic, chains } });
  };

  // ---- Session --------------------------------------------------------------//

  public approveSession = async (proposal: SessionTypes.Proposal) => {
    console.log("ACTION", "approveSession");
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    if (typeof this.state.accounts === "undefined") {
      throw new Error("Accounts is undefined");
    }
    const accounts = this.state.accounts.filter(account => {
      const [namespace, reference] = account.split(":");
      const chainId = `${namespace}:${reference}`;
      return proposal.permissions.blockchain.chains.includes(chainId);
    });
    const response = {
      state: { accounts },
      metadata: getAppMetadata() || DEFAULT_APP_METADATA,
    };
    const session = await this.state.client.approve({ proposal, response });
    this.resetCard();
    this.setState({ session });
  };

  public rejectSession = async (proposal: SessionTypes.Proposal) => {
    console.log("ACTION", "rejectSession");
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    await this.state.client.reject({ proposal });
    this.resetCard();
  };

  public disconnect = async (topic: string) => {
    console.log("ACTION", "disconnect");
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    await this.state.client.disconnect({
      topic,
      reason: ERROR.USER_DISCONNECTED.format(),
    });
    await this.resetCard();
  };

  // ---- Requests --------------------------------------------------------------//

  public removeFromPending = async (requestEvent: SessionTypes.RequestEvent) => {
    this.setState({
      requests: this.state.requests.filter(x => x.request.id !== requestEvent.request.id),
    });
  };

  public respondRequest = async (topic: string, response: JsonRpcResponse) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    await this.state.client.respond({ topic, response });
  };

  public approveRequest = async (requestEvent: SessionTypes.RequestEvent) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    try {
      if (typeof this.state.wallet === "undefined") {
        throw new Error("Wallet is not initialized");
      }
      const chainId = requestEvent.chainId || this.state.chains[0];

      const result = await this.state.wallet.request(requestEvent.request as any, { chainId });
      const response = formatJsonRpcResult(requestEvent.request.id, result);
      this.state.client.respond({
        topic: requestEvent.topic,
        response,
      });
    } catch (e) {
      console.error(e);
      const response = formatJsonRpcError(requestEvent.request.id, e.message);
      this.state.client.respond({ topic: requestEvent.topic, response });
    }

    await this.removeFromPending(requestEvent);
    await this.resetCard();
  };

  public rejectRequest = async (requestEvent: SessionTypes.RequestEvent) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    const error = ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format();
    const response = {
      id: requestEvent.request.id,
      jsonrpc: requestEvent.request.jsonrpc,
      error,
    };
    this.state.client.respond({ topic: requestEvent.topic, response });
    await this.removeFromPending(requestEvent);
    await this.resetCard();
  };

  // ---- Render --------------------------------------------------------------//

  public renderCard = () => {
    const { testnet, chainData, accounts, sessions, chains, requests, card } = this.state;
    let content: JSX.Element | undefined;
    if (isProposalCard(card)) {
      const { proposal } = card.data;
      content = (
        <ProposalCard
          chainData={chainData}
          proposal={proposal}
          approveSession={this.approveSession}
          rejectSession={this.rejectSession}
        />
      );
    } else if (isRequestCard(card)) {
      const { requestEvent, peer } = card.data;
      content = (
        <RequestCard
          chainData={chainData}
          chainId={requestEvent.chainId || chains[0]}
          requestEvent={requestEvent}
          metadata={peer.metadata}
          approveRequest={this.approveRequest}
          rejectRequest={this.rejectRequest}
        />
      );
    } else if (isSessionCard(card)) {
      const { session } = card.data;
      content = (
        <SessionCard
          chainData={chainData}
          session={session}
          resetCard={this.resetCard}
          disconnect={this.disconnect}
        />
      );
    } else if (isSettingsCard(card)) {
      const { mnemonic, chains } = card.data;
      content = (
        <SettingsCard
          mnemonic={mnemonic}
          testnet={testnet}
          chains={chains}
          toggleTestnets={this.toggleTestnets}
          resetCard={this.resetCard}
        />
      );
    } else {
      content = (
        <DefaultCard
          chainData={chainData}
          accounts={accounts}
          sessions={sessions}
          requests={requests}
          openSession={this.openSession}
          openRequest={this.openRequest}
          openScanner={this.openScanner}
          openSettings={this.openSettings}
          onURI={this.onURI}
        />
      );
    }
    return <Card>{content}</Card>;
  };

  public render() {
    const { loading, scanner } = this.state;
    return (
      <React.Fragment>
        <SContainer>
          <SContent>{loading ? "Loading..." : this.renderCard()}</SContent>
          {scanner && (
            <Scanner
              onValidate={this.onScannerValidate}
              onScan={this.onScannerScan}
              onError={this.onScannerError}
              onClose={this.onScannerClose}
            />
          )}
        </SContainer>
        <SVersionNumber>{`v${process.env.REACT_APP_VERSION || "2.0.0-beta"}`}</SVersionNumber>
      </React.Fragment>
    );
  }
}

export default App;
