import type { UserOperation } from "permissionless";
import { createBundlerClient, ENTRYPOINT_ADDRESS_V06, deepHexlify } from "permissionless";
import { Hex, http, createPublicClient, concat } from "viem";
import { sepolia } from "viem/chains";
import { abi } from "../constants/EntryPointABI";

export class UserOpBuilder {
  // private builderAddress: Hex;
  private smartAccountAddress: Hex;
  private publicClient: any;
  private bundlerClient: any;
  private paymasterMiddleware: any;
  private entryPointAddress: Hex;
  private signer: any;

  public constructor(userOpBuilderOpts: {
    smartAccountAddress: Hex;
    userOperationBuilderAddress: Hex;
    entryPointAddress: Hex;
    dappSmartAccountConfig: { bundlerUrl: string; paymasterMiddleware?: any };
    signer: any;
  }) {
    const {
      smartAccountAddress,
      dappSmartAccountConfig,
      entryPointAddress,
      signer,
      // userOperationBuilderAddress,
    } = userOpBuilderOpts;
    this.smartAccountAddress = smartAccountAddress;
    this.entryPointAddress = entryPointAddress;
    this.paymasterMiddleware = dappSmartAccountConfig.paymasterMiddleware;
    this.signer = signer;
    // this.builderAddress = userOperationBuilderAddress;

    this.publicClient = createPublicClient({
      transport: http(),
      chain: sepolia,
    });

    this.bundlerClient = createBundlerClient({
      transport: http(dappSmartAccountConfig.bundlerUrl),
      entryPoint: entryPointAddress as typeof ENTRYPOINT_ADDRESS_V06,
    });
  }

  public async buildUserOp({
    factoryAddress,
    factoryData,
  }: {
    factoryAddress: Hex;
    factoryData: Hex;
  }) {
    const initCode =
      factoryAddress && factoryData ? deepHexlify(concat([factoryAddress, factoryData])) : "0x";

    const [nonce, dummySig, callData] = await Promise.all([
      this.getNonceWithContext(),
      this.getDummySignatureWithContext(),
      this.getCallDataWithContext(),
    ]);

    let userOperation: Partial<UserOperation<"v0.6">> = {
      sender: this.smartAccountAddress,
      nonce,
      initCode,
      callData,
      paymasterAndData: "0x" as Hex,
      signature: dummySig as Hex,
    };

    const gasPrice = await this.publicClient.estimateFeesPerGas();

    userOperation = {
      ...userOperation,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
    };

    if (this.paymasterMiddleware) {
      userOperation = await this.paymasterMiddleware(this.entryPointAddress as Hex, userOperation);
    }

    if (
      !userOperation.preVerificationGas ||
      !userOperation.verificationGasLimit ||
      !userOperation.callGasLimit
    ) {
      // Estimate userop gas price is failing, we hard code for now
      // const gasLimits = await this.bundlerClient.estimateUserOperationGas({
      //   userOperation: { ...userOperation },
      // });
      const gasLimits = {
        preVerificationGas: BigInt(500_000),
        verificationGasLimit: BigInt(500_000),
        callGasLimit: BigInt(500_000),
      };

      userOperation = { ...userOperation, ...gasLimits } as UserOperation<"v0.6">;
    }

    return userOperation as UserOperation<"v0.6">;
  }

  public async sendUserOperation({
    userOperation,
    caipChainId,
    expiry,
  }: {
    userOperation: UserOperation<"v0.6">;
    caipChainId: string;
    expiry?: number;
  }) {
    console.log("SENDING ETH_SIGNUSEROPERATION", userOperation, caipChainId);
    const signature = await this.signer.request(
      {
        method: "eth_signUserOperation",
        params: [deepHexlify(userOperation), this.entryPointAddress],
      },
      caipChainId,
      expiry,
    );

    userOperation.signature = signature as Hex;

    // const newSignature = getSignatureWithContext();

    // userUpoeration.signature = newSignature;

    console.log("SUBMITTING USER OP");
    const userOpHash = await this.bundlerClient.sendUserOperation({
      userOperation: userOperation as UserOperation<"v0.6">,
    });

    const userOpReceipt = await this.bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    return userOpReceipt.receipt.transactionHash as Hex;
  }

  /**
   *  Following methods are private and hardcoded since we don't have the contract
   *  These methods should be implemented once we have the contract, and use the builderAddress provided
   *  to fetch the nonce, callData and signature using corresponding ABI methods
   */

  /**
   * This method should call the constructor contract and fetch the nonce
   * In BicoV2 we can use the entrypoint nonce but that is not guaranteed to work in the future
   */
  private async getNonceWithContext() {
    return await this.publicClient.readContract({
      abi,
      functionName: "getNonce",
      address: ENTRYPOINT_ADDRESS_V06,
      args: [this.smartAccountAddress, BigInt(0)],
    });
  }

  // Hardcoded since we don't have the contract
  private async getCallDataWithContext() {
    return await Promise.resolve(
      "0x0000189a000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000021230000000000000000000000000000000000000000000000000000000000000" as Hex,
    );
  }

  // Hardcoded since we don't have the contract, extremely dumb signature to allow tx to go through
  private async getDummySignatureWithContext() {
    return await Promise.resolve(
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000001c5b32f37f5bea87bdd5374eb2ac54ea8e00000000000000000000000000000000000000000000000000000000000000410946be644bd92962420dbcd291c36b93ed9e36747bbb1a06970197fb305333133e54ad1a5e79c835c3cf9a4bbd8abd2754c912fca79d111d36bc1c65002ab4391c00000000000000000000000000000000000000000000000000000000000000" as Hex,
    );
  }
}
