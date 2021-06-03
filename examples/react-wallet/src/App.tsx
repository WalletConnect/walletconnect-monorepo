import * as React from "react";
import styled from "styled-components";
import KeyValueStorage from "keyvaluestorage";
import Wallet from "caip-wallet";
import Client, { CLIENT_EVENTS } from "@walletconnect/client";
import { JsonRpcResponse, formatJsonRpcError } from "@json-rpc-tools/utils";
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
  DEFAULT_METHODS,
  DEFAULT_RELAY_PROVIDER,
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
    this.init();
  }

  public init = async (mnemonic?: string) => {
    this.setState({ loading: true });
    try {
      await this.loadChainData();
      await this.loadChainJsonRpc();
      const storage = new KeyValueStorage();
      const wallet = await Wallet.init({ chains: this.state.chains, storage, mnemonic });
      const client = await Client.init({
        controller: true,
        relayProvider: DEFAULT_RELAY_PROVIDER,
        logger: DEFAULT_LOGGER,
        storage,
      });
      const accounts = await wallet.getAccounts();
      this.setState({ loading: false, storage, client, wallet, accounts });
      this.subscribeToEvents();
      await this.checkPersistedState();
    } catch (e) {
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
    this.resetApp();
    this.init(mnemonic);
  };

  public resetApp = async () => {
    this.setState({ ...INITIAL_STATE });
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
      const unsupportedChains = [];
      proposal.permissions.blockchain.chains.forEach(chainId => {
        if (this.state.chains.includes(chainId)) return;
        unsupportedChains.push(chainId);
      });
      if (unsupportedChains.length) {
        return this.state.client.reject({ proposal });
      }
      const unsupportedMethods = [];
      proposal.permissions.jsonrpc.methods.forEach(method => {
        if (DEFAULT_METHODS.includes(method)) return;
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
        console.log("EVENT", CLIENT_EVENTS.session.request, requestEvent.request);
        const chainId = requestEvent.chainId || this.state.chains[0];
        const [namespace] = chainId.split(":");
        try {
          // TODO: needs improvement
          const requiresApproval = this.state.jsonrpc[namespace].methods.sign.includes(
            requestEvent.request.method,
          );
          if (requiresApproval) {
            this.setState({ requests: [...this.state.requests, requestEvent] });
          } else {
            const response = await this.state.wallet.request(requestEvent.request, { chainId });
            await this.respondRequest(requestEvent.topic, response);
          }
        } catch (e) {
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
      const chainId = account.split("@")[1];
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
      const response = await this.state.wallet.request(requestEvent.request as any, { chainId });
      this.state.client.respond({
        topic: requestEvent.topic,
        response,
      });
    } catch (error) {
      console.error(error);
      this.state.client.respond({
        topic: requestEvent.topic,
        response: formatJsonRpcError(requestEvent.request.id, "Failed or Rejected Request"),
      });
    }

    await this.removeFromPending(requestEvent);
    await this.resetCard();
  };

  public rejectRequest = async (requestEvent: SessionTypes.RequestEvent) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("Client is not initialized");
    }
    this.state.client.respond({
      topic: requestEvent.topic,
      response: formatJsonRpcError(requestEvent.request.id, "Failed or Rejected Request"),
    });
    await this.removeFromPending(requestEvent);
    await this.resetCard();
  };

  // ---- Render --------------------------------------------------------------//

  public renderCard = () => {
    const { chainData, accounts, sessions, chains, requests, card } = this.state;
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
      content = <SettingsCard mnemonic={mnemonic} chains={chains} resetCard={this.resetCard} />;
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
        <SVersionNumber>{`v${process.env.REACT_APP_VERSION || "2.0.0-alpha"}`}</SVersionNumber>
      </React.Fragment>
    );
  }
}

export default App;
