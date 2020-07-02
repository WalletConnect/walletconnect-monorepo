import { isNode } from "@walletconnect/utils";
import QRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnect from "@walletconnect/client";
import Web3Provider from "@walletconnect/web3-provider";
import ChannelProvider from "@walletconnect/channel-provider";
import StarkwareProvider from "@walletconnect/starkware-provider";
import ThreeIdProvider from "@walletconnect/3id-provider";

import WalletConnectSDK from "../src";

jest.mock("@walletconnect/web3-provider");
jest.mock("@walletconnect/channel-provider");
jest.mock("@walletconnect/starkware-provider");
jest.mock("@walletconnect/3id-provider");
jest.mock("@walletconnect/client");
jest.mock("@walletconnect/utils");

const defaultOptions = {
  clientMeta: {
    name: "WalletConnect SDK",
    description: "WalletConnect SDK in NodeJS",
    url: "#",
    icons: ["https://walletconnect.org/walletconnect-logo.png"],
  },
  options: {
    bridge: "https://bridge.walletconnect.org",
    qrcodeModal: QRCodeModal,
  },
};

const customOptions = {
  options: { ...defaultOptions.options, bridge: "https://bridge.example.org" },
  clientMeta: {
    name: "Test Client",
    description: "Test Data in NodeJS",
    url: "#",
    icons: ["https://img.com/test-logo.png"],
  },
};

describe("WalletConnect", () => {
  describe("When instantiated", () => {
    const walletConnect = new WalletConnectSDK();

    it("should be an instance of WalletConnectSDK", () => {
      expect(walletConnect).toBeInstanceOf(WalletConnectSDK);
    });
  });

  describe("When instantiated with options and connect called", () => {
    it("should call WalletConnect with provided options", () => {
      const walletConnect = new WalletConnectSDK(defaultOptions.options);

      walletConnect.connect();
      expect(WalletConnect).lastCalledWith(defaultOptions.options);
    });

    it("should call WalletConnect with provided clientMeta in node env", () => {
      const walletConnect = new WalletConnectSDK({
        ...customOptions.options,
        clientMeta: customOptions.clientMeta,
      });

      //@ts-ignore
      isNode.mockReturnValue(true);

      walletConnect.connect();
      expect(WalletConnect).lastCalledWith({
        ...customOptions.options,
        clientMeta: customOptions.clientMeta,
      });
    });
  });

  describe("When connect has not been called", () => {
    const walletConnect = new WalletConnectSDK();

    it("should throw when we call getWeb3Provider", () => {
      expect(walletConnect.connector).toBe(undefined);
    });
    it("should throw when we call getWeb3Provider", () => {
      expect(() => walletConnect.getWeb3Provider()).toThrow();
    });
    it("should throw when we call getChannelProvider", () => {
      expect(() => walletConnect.getChannelProvider()).toThrow();
    });
    it("should throw when we call getStarkwareProvider", () => {
      expect(() => walletConnect.getStarkwareProvider({ contractAddress: "" })).toThrow();
    });
    it("should throw when we call getThreeIdProvider", () => {
      expect(() => walletConnect.getThreeIdProvider()).toThrow();
    });
  });

  describe("When connect has been called", () => {
    const walletConnect = new WalletConnectSDK();

    beforeEach(() => {
      walletConnect.connector = new WalletConnect(defaultOptions.options);
    });

    it("should have a defined connector", () => {
      expect(walletConnect.connector).toBeTruthy();
    });

    it("should call Web3Provider when we call getWeb3Provider", () => {
      expect(walletConnect.getWeb3Provider()).toBeInstanceOf(Web3Provider);
    });

    it("should call ChannelProvider when we call getChannelProvider", () => {
      expect(walletConnect.getChannelProvider()).toBeInstanceOf(ChannelProvider);
    });

    it("should call StarkwareProvider when we call getStarkwareProvider", () => {
      expect(walletConnect.getStarkwareProvider({ contractAddress: "" })).toBeInstanceOf(
        StarkwareProvider,
      );
    });

    it("should call ThreeIdProvider when we call getThreeIdProvider", () => {
      expect(walletConnect.getThreeIdProvider()).toBeInstanceOf(ThreeIdProvider);
    });
  });

  describe("When connect has been called in node env", () => {
    const walletConnect = new WalletConnectSDK();

    it("should call WalletConnect with default node options", () => {
      //@ts-ignore
      isNode.mockReturnValue(true);

      walletConnect.connect();
      expect(WalletConnect).lastCalledWith({
        ...defaultOptions.options,
        clientMeta: defaultOptions.clientMeta,
      });
    });
  });
});
