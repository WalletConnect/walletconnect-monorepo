import * as React from "react";
import styled from "styled-components";

import Client, { CLIENT_EVENTS } from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { PairingTypes, SessionTypes } from "@walletconnect/types";
import { ERROR, getAppMetadata } from "@walletconnect/utils";
import * as encoding from "@walletconnect/encoding";
import { apiGetChainNamespace, ChainsMap } from "caip-api";
import { formatDirectSignDoc, stringifySignDocValues } from "cosmos-wallet";
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
  DEFAULT_EIP155_METHODS,
  DEFAULT_COSMOS_METHODS,
  DEFAULT_RELAY_PROVIDER,
  DEFAULT_TEST_CHAINS,
  DEFAULT_CHAINS,
} from "./constants";
import {
  apiGetAccountAssets,
  AccountAction,
  eip712,
  hashPersonalMessage,
  verifySignature,
  AccountBalances,
  formatTestTransaction,
  ChainNamespaces,
  setInitialStateTestnet,
  getInitialStateTestnet,
} from "./helpers";
import { fonts } from "./styles";
import Toggle from "./components/Toggle";
import RequestModal from "./modals/RequestModal";
import PairingModal from "./modals/PairingModal";
import PingModal from "./modals/PingModal";

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
  testnet: boolean;
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
  chainData: ChainNamespaces;
}

const INITIAL_STATE: AppState = {
  client: undefined,
  session: undefined,
  testnet: true,
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
  chainData: {},
};

class App extends React.Component<any, any> {
  public state: AppState = {
    ...INITIAL_STATE,
    testnet: getInitialStateTestnet(),
  };
  public componentDidMount() {
    this.init();
  }

  public init = async () => {
    this.setState({ loading: true });

    try {
      await this.loadChainData();
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

  public subscribeToEvents = () => {
    if (typeof this.state.client === "undefined") {
      return;
    }

    this.state.client.on(
      CLIENT_EVENTS.pairing.proposal,
      async (proposal: PairingTypes.Proposal) => {
        const { uri } = proposal.signal.params;
        this.setState({ uri });
        console.log("EVENT", "QR Code Modal open");
        QRCodeModal.open(uri, () => {
          console.log("EVENT", "QR Code Modal closed");
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
      const chains = session.state.accounts.map(account =>
        account
          .split(":")
          .slice(0, -1)
          .join(":"),
      );
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
      const chains = this.state.chains;
      const supportedNamespaces: string[] = [];
      chains.forEach(chainId => {
        const [namespace] = chainId.split(":");
        if (!supportedNamespaces.includes(namespace)) {
          supportedNamespaces.push(namespace);
        }
      });
      const methods: string[] = supportedNamespaces
        .map(namespace => {
          switch (namespace) {
            case "eip155":
              return DEFAULT_EIP155_METHODS;
            case "cosmos":
              return DEFAULT_COSMOS_METHODS;
            default:
              throw new Error(`No default methods for namespace: ${namespace}`);
          }
        })
        .flat();
      const session = await this.state.client.connect({
        metadata: getAppMetadata() || DEFAULT_APP_METADATA,
        pairing,
        permissions: {
          blockchain: {
            chains,
          },
          jsonrpc: {
            methods,
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
    const { client, chainData } = this.state;
    this.setState({ ...INITIAL_STATE, client, chainData });
  };

  public toggleTestnets = () => {
    const testnet = !this.state.testnet;
    this.setState({ testnet });
    setInitialStateTestnet(testnet);
  };

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
          const [namespace, reference, address] = account.split(":");
          const chainId = `${namespace}:${reference}`;
          const assets = await apiGetAccountAssets(address, chainId);
          return { account, assets };
        }),
      );

      const balances: AccountBalances = {};
      arr.forEach(({ account, assets }) => {
        balances[account] = assets;
      });
      this.setState({ fetching: false, balances });
    } catch (e) {
      console.error(e);
      this.setState({ fetching: false });
    }
  };

  public openPairingModal = () => this.setState({ modal: "pairing" });

  public openRequestModal = () => this.setState({ pending: true, modal: "request" });

  public openPingModal = () => this.setState({ pending: true, modal: "ping" });

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
      // get ethereum address
      const account = this.state.accounts.find(account => account.startsWith(chainId));
      if (account === undefined) throw new Error("Account is not found");
      const address = account.split(":").pop();
      if (address === undefined) throw new Error("Address is invalid");

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
    } catch (e) {
      console.error(e);
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
      const hexMsg = encoding.utf8ToHex(message, true);

      // get ethereum address
      const account = this.state.accounts.find(account => account.startsWith(chainId));
      if (account === undefined) throw new Error("Account is not found");
      const address = account.split(":").pop();
      if (address === undefined) throw new Error("Address is invalid");

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

      //  split chainId
      const [namespace, reference] = chainId.split(":");

      const chainData = this.state.chainData[namespace][reference];

      if (typeof chainData === "undefined") {
        throw new Error(`Missing chain data for chainId: ${chainId}`);
      }

      const rpcUrl = chainData.rpc[0];

      // verify signature
      const hash = hashPersonalMessage(message);
      const valid = await verifySignature(address, result, hash, rpcUrl);

      // format displayed result
      const formattedResult = {
        method: "personal_sign",
        address,
        valid,
        result,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (e) {
      console.error(e);
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
      const account = this.state.accounts.find(account => account.startsWith(chainId));
      if (account === undefined) throw new Error("Account is not found");
      const address = account.split(":").pop();
      if (address === undefined) throw new Error("Address is invalid");

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

      //  split chainId
      const [namespace, reference] = chainId.split(":");

      const chainData = this.state.chainData[namespace][reference];

      if (typeof chainData === "undefined") {
        throw new Error(`Missing chain data for chainId: ${chainId}`);
      }

      const rpcUrl = chainData.rpc[0];

      // verify signature
      const hash = hashPersonalMessage(message);
      const valid = await verifySignature(address, result, hash, rpcUrl);

      // format displayed result
      const formattedResult = {
        method: "eth_signTypedData",
        address,
        valid,
        result,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (e) {
      console.error(e);
      this.setState({ pending: false, result: null });
    }
  };

  public testSignDirect = async (chainId: string) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      // test direct sign doc inputs
      const inputs = {
        fee: [{ amount: "2000", denom: "ucosm" }],
        pubkey: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
        gasLimit: 200000,
        accountNumber: 1,
        sequence: 1,
        bodyBytes:
          "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637",
        authInfoBytes:
          "0a500a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801180112130a0d0a0575636f736d12043230303010c09a0c",
      };

      // split chainId
      const [namespace, reference] = chainId.split(":");

      // format sign doc
      const signDoc = formatDirectSignDoc(
        inputs.fee,
        inputs.pubkey,
        inputs.gasLimit,
        inputs.accountNumber,
        inputs.sequence,
        inputs.bodyBytes,
        reference,
      );

      // get cosmos address
      const account = this.state.accounts.find(account => account.startsWith(chainId));
      if (account === undefined) throw new Error("Account is not found");
      const address = account.split(":").pop();
      if (address === undefined) throw new Error("Address is invalid");

      // cosmos_signDirect params
      const params = {
        signerAddress: address,
        signDoc: stringifySignDocValues(signDoc),
      };

      // open modal
      this.openRequestModal();

      // send message
      const result = await this.state.client.request({
        topic: this.state.session.topic,
        chainId,
        request: {
          method: "cosmos_signDirect",
          params,
        },
      });

      const chainData = this.state.chainData[namespace][reference];

      if (typeof chainData === "undefined") {
        throw new Error(`Missing chain data for chainId: ${chainId}`);
      }

      // TODO: check if valid
      const valid = true;

      // format displayed result
      const formattedResult = {
        method: "cosmos_signDirect",
        address,
        valid,
        result: result.signature.signature,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (e) {
      console.error(e);
      this.setState({ pending: false, result: null });
    }
  };

  public testSignAmino = async (chainId: string) => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      // split chainId
      const [namespace, reference] = chainId.split(":");

      // test amino sign doc
      const signDoc = {
        msgs: [],
        fee: { amount: [], gas: "23" },
        chain_id: "foochain",
        memo: "hello, world",
        account_number: "7",
        sequence: "54",
      };

      // get cosmos address
      const account = this.state.accounts.find(account => account.startsWith(chainId));
      if (account === undefined) throw new Error("Account is not found");
      const address = account.split(":").pop();
      if (address === undefined) throw new Error("Address is invalid");

      // cosmos_signAmino params
      const params = { signerAddress: address, signDoc };

      // open modal
      this.openRequestModal();

      // send message
      const result = await this.state.client.request({
        topic: this.state.session.topic,
        chainId,
        request: {
          method: "cosmos_signAmino",
          params,
        },
      });

      const chainData = this.state.chainData[namespace][reference];

      if (typeof chainData === "undefined") {
        throw new Error(`Missing chain data for chainId: ${chainId}`);
      }

      // TODO: check if valid
      const valid = true;

      // format displayed result
      const formattedResult = {
        method: "cosmos_signAmino",
        address,
        valid,
        result: result.signature.signature,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (e) {
      console.error(e);
      this.setState({ pending: false, result: null });
    }
  };

  public ping = async () => {
    if (typeof this.state.client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof this.state.session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      // open modal
      this.openPingModal();

      let valid = false;

      try {
        await this.state.client.session.ping(this.state.session.topic);
        valid = true;
      } catch (e) {
        valid = false;
      }

      // format displayed result
      const formattedResult = {
        method: "ping",
        valid,
      };

      // display result
      this.setState({ pending: false, result: formattedResult || null });
    } catch (e) {
      console.error(e);
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

  public getBlockchainActions = (chainId: string) => {
    const [namespace] = chainId.split(":");
    switch (namespace) {
      case "eip155":
        return this.getEthereumActions();
      case "cosmos":
        return this.getCosmosActions();
      default:
        break;
    }
  };

  public getEthereumActions = (): AccountAction[] => {
    return [
      { method: "eth_sendTransaction", callback: this.testSendTransaction },
      { method: "personal_sign", callback: this.testSignPersonalMessage },
      { method: "eth_signTypedData", callback: this.testSignTypedData },
    ];
  };

  public getCosmosActions = (): AccountAction[] => {
    return [
      { method: "cosmos_signDirect", callback: this.testSignDirect },
      { method: "cosmos_signAmino", callback: this.testSignAmino },
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
      case "ping":
        return <PingModal pending={this.state.pending} result={this.state.result} />;
      default:
        return null;
    }
  };

  public renderContent = () => {
    const { balances, accounts, chains, chainData, testnet, fetching } = this.state;
    const chainOptions = testnet ? DEFAULT_TEST_CHAINS : DEFAULT_MAIN_CHAINS;
    return !accounts.length && !Object.keys(balances).length ? (
      <SLanding center>
        <Banner />
        <h6>
          <span>{`Using v${process.env.REACT_APP_VERSION || "2.0.0-beta"}`}</span>
        </h6>
        <SButtonContainer>
          <h6>Select chains:</h6>
          <SToggleContainer>
            <p>Testnets Only?</p>
            <Toggle active={testnet} onClick={this.toggleTestnets} />
          </SToggleContainer>
          {chainOptions.map(chainId => (
            <Blockchain
              key={chainId}
              chainId={chainId}
              chainData={chainData}
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
            const [namespace, reference, address] = account.split(":");
            const chainId = `${namespace}:${reference}`;
            return (
              <Blockchain
                key={account}
                active={true}
                chainData={chainData}
                fetching={fetching}
                address={address}
                chainId={chainId}
                balances={balances}
                actions={this.getBlockchainActions(chainId)}
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
          <Header ping={this.ping} disconnect={this.disconnect} session={session} />
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
