import * as React from "react";
import styled from "styled-components";

import Client, { CLIENT_EVENTS } from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { PairingTypes, SessionTypes } from "@walletconnect/types";
import { ERROR, getAppMetadata } from "@walletconnect/utils";
import * as encUtils from "enc-utils";
import { BigNumber } from "ethers";

import Banner from "./components/Banner";
import Blockchain from "./components/Blockchain";
import Button from "./components/Button";
import Column from "./components/Column";
import Header from "./components/Header";
import Modal from "./components/Modal";
import Wrapper from "./components/Wrapper";
import {
  DEFAULT_APP_METADATA,
  DEFAULT_MAIN_CHAINS,
  DEFAULT_LOGGER,
  DEFAULT_METHODS,
  DEFAULT_RELAY_PROVIDER,
  DEFAULT_TEST_CHAINS,
} from "./constants";
import {
  apiGetAccountAssets,
  AccountAction,
  eip712,
  hashPersonalMessage,
  verifySignature,
  AccountBalances,
  formatTestTransaction,
} from "./helpers";
import { fonts } from "./styles";
import Toggle from "./components/Toggle";
import RequestModal from "./modals/RequestModal";
import PairingModal from "./modals/PairingModal";

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper as any)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SLanding = styled(Column as any)`
  /* height: 600px; */
`;

const SButtonContainer = styled(Column as any)`
  width: 250px;
  margin: 50px 0;
`;

const SConnectButton = styled(Button as any)`
  border-radius: 8px;
  font-size: ${fonts.size.medium};
  height: 44px;
  width: 100%;
  margin: 12px 0;
`;

const SAccountsContainer = styled(SLanding as any)`
  height: 100%;
  padding-bottom: 30px;
  & h3 {
    padding-top: 30px;
  }
`;

const SToggleContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px auto;
  & > p {
    margin-right: 10px;
  }
`;

const SFullWidthContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
`;

const SAccounts = styled(SFullWidthContainer)`
  justify-content: space-between;
  & > div {
    margin: 12px 0;
    flex: 1 0 100%;
    @media (min-width: 648px) {
      flex: 0 1 48%;
    }
  }
`;

interface AppState {
  client: Client | undefined;
  session: SessionTypes.Created | undefined;
  testNet: boolean;
  loading: boolean;
  fetching: boolean;
  chains: string[];
  pairings: string[];
  modal: string;
  pending: boolean;
  uri: string;
  accounts: string[];
  result: any | undefined;
  balances: AccountBalances;
}

const INITIAL_STATE: AppState = {
  client: undefined,
  session: undefined,
  testNet: true,
  loading: false,
  fetching: false,
  chains: [],
  pairings: [],
  modal: "",
  pending: false,
  uri: "",
  accounts: [],
  result: undefined,
  balances: {},
};

class App extends React.Component<any, any> {
  public state: AppState = {
    ...INITIAL_STATE,
  };
  public componentDidMount() {
    this.init();
  }

  public init = async () => {
    this.setState({ loading: true });

    try {
      const client = await Client.init({
        logger: DEFAULT_LOGGER,
        relayProvider: DEFAULT_RELAY_PROVIDER,
      });

      this.setState({ loading: false, client });
      this.subscribeToEvents();
      await this.checkPersistedState();
    } catch (e) {
      this.setState({ loading: false });
      throw e;
    }
  };

  public subscribeToEvents = () => {
    if (typeof this.state.client === "undefined") {
      return;
    }

    this.state.client.on(
      CLIENT_EVENTS.pairing.proposal,
      async (proposal: PairingTypes.Proposal) => {
        const { uri } = proposal.signal.params;
        this.setState({ uri });
        QRCodeModal.open(uri, () => {
          console.log("Modal callback");
        });
      },
    );

    this.state.client.on(CLIENT_EVENTS.pairing.created, async (proposal: PairingTypes.Settled) => {
      if (typeof this.state.client === "undefined") return;
      this.setState({ pairings: this.state.client.pairing.topics });
    });

    this.state.client.on(CLIENT_EVENTS.session.deleted, (session: SessionTypes.Settled) => {
      if (session.topic !== this.state.session?.topic) return;
      console.log("EVENT", "session_deleted");
      this.resetApp();
    });
  };

  public checkPersistedState = async () => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    // populates existing pairings to state
    this.setState({ pairings: this.state.client.pairing.topics });
    if (typeof this.state.session !== "undefined") return;
    // populates existing session to state (assume only the top one)
    if (this.state.client.session.topics.length) {
      const session = await this.state.client.session.get(this.state.client.session.topics[0]);
      const chains = session.state.accounts.map(account => account.split("@")[1]);
      this.setState({ accounts: session.state.accounts, chains });
      this.onSessionConnected(session);
    }
  };

  public connect = async (pairing?: { topic: string }) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    console.log("connect", pairing);
    if (this.state.modal === "pairing") {
      this.closeModal();
    }
    try {
      const session = await this.state.client.connect({
        metadata: getAppMetadata() || DEFAULT_APP_METADATA,
        pairing,
        permissions: {
          blockchain: {
            chains: this.state.chains,
          },
          jsonrpc: {
            methods: DEFAULT_METHODS,
          },
        },
      });

      this.onSessionConnected(session);
    } catch (e) {
      // ignore rejection
    }

    // close modal in case it was open
    QRCodeModal.close();
  };

  public disconnect = async () => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }
    await this.state.client.disconnect({
      topic: this.state.session.topic,
      reason: ERROR.USER_DISCONNECTED.format(),
    });
  };

  public resetApp = async () => {
    const { client } = this.state;
    this.setState({ ...INITIAL_STATE, client });
  };

  public toggleTestNets = () => this.setState({ testNet: !this.state.testNet });

  public onSessionConnected = async (session: SessionTypes.Settled) => {
    this.setState({ session });
    this.onSessionUpdate(session.state.accounts, session.permissions.blockchain.chains);
  };

  public onSessionUpdate = async (accounts: string[], chains: string[]) => {
    this.setState({ chains, accounts });
    await this.getAccountBalances();
  };

  public getAccountBalances = async () => {
    this.setState({ fetching: true });
    try {
      const arr = await Promise.all(
        this.state.accounts.map(async account => {
          const [address, chainId] = account.split("@");
          const assets = await apiGetAccountAssets(address, chainId);
          return { account, assets };
        }),
      );

      const balances: AccountBalances = {};
      arr.forEach(({ account, assets }) => {
        balances[account] = assets;
      });
      this.setState({ fetching: false, balances });
    } catch (error) {
      console.error(error);
      this.setState({ fetching: false });
    }
  };

  public openPairingModal = () => this.setState({ modal: "pairing" });

  public openRequestModal = () => this.setState({ pending: true, modal: "request" });

  public openModal = (modal: string) => this.setState({ modal });

  public closeModal = () => this.setState({ modal: "" });

  public onConnect = () => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (this.state.client.pairing.topics.length) {
      return this.openPairingModal();
    }
    this.connect();
  };

  public testSendTransaction = async (chainId: string) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      const address =
        this.state.accounts.find(account => account.split("@")[1] === chainId)?.split("@")[0] || "";
      const account = `${address}@${chainId}`;

      // open modal
      this.openRequestModal();

      const tx = await formatTestTransaction(account);

      const balance = BigNumber.from(this.state.balances[account][0].balance || "0");
      if (balance.lt(BigNumber.from(tx.gasPrice).mul(tx.gasLimit))) {
        const formattedResult = {
          method: "eth_sendTransaction",
          address,
          valid: false,
          result: "Insufficient funds for intrinsic transaction cost",
        };
        this.setState({ pending: false, result: formattedResult || null });
        return;
      }

      const result = await this.state.client.request({
        topic: this.state.session.topic,
        chainId,
        request: {
          method: "eth_sendTransaction",
          params: [tx],
        },
      });

      // format displayed result
      const formattedResult = {
        method: "eth_sendTransaction",
        address,
        valid: true,
        result,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (error) {
      console.error(error);
      this.setState({ pending: false, result: null });
    }
  };

  public testSignPersonalMessage = async (chainId: string) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      // test message
      const message = `My email is john@doe.com - ${Date.now()}`;

      // encode message (hex)
      const hexMsg = encUtils.utf8ToHex(message, true);

      // get ethereum address
      const address = this.state.accounts.find(account => account.endsWith(chainId))?.split("@")[0];
      if (address === undefined) throw new Error("Address is not valid");

      // personal_sign params
      const params = [hexMsg, address];

      // open modal
      this.openRequestModal();

      // send message
      const result = await this.state.client.request({
        topic: this.state.session.topic,
        chainId,
        request: {
          method: "personal_sign",
          params,
        },
      });

      //  get chainId
      const chainRef = Number(chainId.split(":")[1]);

      // verify signature
      const hash = hashPersonalMessage(message);
      const valid = await verifySignature(address, result, hash, chainRef);

      // format displayed result
      const formattedResult = {
        method: "personal_sign",
        address,
        valid,
        result,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (error) {
      console.error(error);
      this.setState({ pending: false, result: null });
    }
  };

  public testSignTypedData = async (chainId: string) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }
    try {
      // test message
      const message = JSON.stringify(eip712.example);

      // get ethereum address
      const address = this.state.accounts.find(account => account.endsWith(chainId))?.split("@")[0];
      if (address === undefined) throw new Error("Address is not valid");

      // eth_signTypedData params
      const params = [address, message];

      // open modal
      this.openRequestModal();

      // send message
      const result = await this.state.client.request({
        topic: this.state.session.topic,
        chainId,
        request: {
          method: "eth_signTypedData",
          params,
        },
      });

      //  get chainId
      const chainRef = Number(chainId.split(":")[1]);

      // verify signature
      const hash = hashPersonalMessage(message);
      const valid = await verifySignature(address, result, hash, chainRef);

      // format displayed result
      const formattedResult = {
        method: "eth_signTypedData",
        address,
        valid,
        result,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (error) {
      console.error(error);
      this.setState({ pending: false, result: null });
    }
  };

  public handleChainSelectionClick = (chainId: string) => {
    const { chains } = this.state;
    if (chains.includes(chainId)) {
      this.setState({ chains: chains.filter(x => x !== chainId) });
    } else {
      this.setState({ chains: [...chains, chainId] });
    }
  };

  public getEthereumActions = (): AccountAction[] => {
    return [
      { method: "eth_sendTransaction", callback: this.testSendTransaction },
      { method: "personal_sign", callback: this.testSignPersonalMessage },
      { method: "eth_signTypedData", callback: this.testSignTypedData },
    ];
  };

  public renderModal = () => {
    switch (this.state.modal) {
      case "pairing":
        if (typeof this.state.client === "undefined") {
          throw new Error("WalletConnect is not initialized");
        }
        return <PairingModal pairings={this.state.client.pairing.values} connect={this.connect} />;
      case "request":
        return <RequestModal pending={this.state.pending} result={this.state.result} />;
      default:
        return null;
    }
  };

  public renderContent = () => {
    const { balances, accounts, chains, testNet, fetching } = this.state;
    const chainOptions = testNet ? DEFAULT_TEST_CHAINS : DEFAULT_MAIN_CHAINS;
    return !accounts.length && !Object.keys(balances).length ? (
      <SLanding center>
        <Banner />
        <h6>
          <span>{`Using v${process.env.REACT_APP_VERSION || "2.0.0-alpha"}`}</span>
        </h6>
        <SButtonContainer>
          <h6>Select chains:</h6>
          <SToggleContainer>
            <p>Testnets Only?</p>
            <Toggle active={testNet} onClick={this.toggleTestNets} />
          </SToggleContainer>
          {chainOptions.map(chainId => (
            <Blockchain
              key={chainId}
              chainId={chainId}
              onClick={this.handleChainSelectionClick}
              active={chains.includes(chainId)}
            />
          ))}
          <SConnectButton
            left
            onClick={this.onConnect}
            fetching={fetching}
            disabled={!chains.length}
          >
            {"Connect"}
          </SConnectButton>
        </SButtonContainer>
      </SLanding>
    ) : (
      <SAccountsContainer>
        <h3>Accounts</h3>
        <SAccounts>
          {this.state.accounts.map(account => {
            const [address, chainId] = account.split("@");
            return (
              <Blockchain
                key={account}
                active={true}
                fetching={fetching}
                address={address}
                chainId={chainId}
                balances={balances}
                actions={this.getEthereumActions()}
              />
            );
          })}
        </SAccounts>
      </SAccountsContainer>
    );
  };

  public render = () => {
    const { loading, session, modal } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header disconnect={this.disconnect} session={session} />
          <SContent>{loading ? "Loading..." : this.renderContent()}</SContent>
        </Column>
        <Modal show={!!modal} closeModal={this.closeModal}>
          {this.renderModal()}
        </Modal>
      </SLayout>
    );
  };
}

export default App;
