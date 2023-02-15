/* eslint-disable */
import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import {
  FeeData,
  Provider,
  TransactionRequest,
  TransactionResponse,
} from "@ethersproject/abstract-provider";
import { Bytes } from "@ethersproject/bytes";
import { Eip1193Bridge } from "@ethersproject/experimental";
import { Deferrable } from "@ethersproject/properties";
import { serialize } from "@ethersproject/transactions";
import type { Actions } from "@web3-react/types";
import { Connector } from "@web3-react/types";
import { ethers, Signer, UnsignedTransaction } from "ethers";
import { canisterId, createActor } from "../declarations/signer";

const INFURA_API_KEY = "Enter your API key here";
const ETH_NETWORK = "goerli";
const CHAIN_ID = 0x5;

export class NoSafeContext extends Error {
  public constructor() {
    super("The app is loaded outside safe context");
    this.name = NoSafeContext.name;
    Object.setPrototypeOf(this, NoSafeContext.prototype);
  }
}

class InternetComputerSigner extends Signer {
  public canisterSigner: any;
  public authClient: any;
  readonly provider: Provider;

  constructor() {
    super();
    this.provider = new ethers.providers.InfuraProvider(
      ETH_NETWORK,
      INFURA_API_KEY
    );
    this.authClient = {};
  }

  connect(provider: Provider): InternetComputerSigner {
    return new InternetComputerSigner();
  }

  async getAddress(): Promise<string> {
    console.log("Fetching public key from canister");
    return this.canisterSigner
      .public_key_query()
      .then((res: any) => {
        if (res.Ok && res.Ok.public_key) {
          return ethers.utils.computeAddress(res.Ok.public_key);
        } else {
          return this.canisterSigner.public_key().then((res: any) => {
            if (res.Ok && res.Ok.public_key) {
              return ethers.utils.computeAddress(res.Ok.public_key);
            } else {
              throw new Error("Could not get public key from canister");
            }
          });
        }
      })
      .catch((err: any) => {
        this.canisterSigner.public_key().then((res: any) => {
          if (res.Ok && res.Ok.public_key) {
            return ethers.utils.computeAddress(res.Ok.public_key);
          } else {
            throw new Error("Could not get public key from canister");
          }
        });
      });
  }

  async getFeeData(): Promise<FeeData> {
    return this.provider.getFeeData();
  }

  async signMessage(message: Bytes | string): Promise<string> {
    console.log("==== SIGN MESSAGE =====");
    console.log(message);
    message = message.toString();
    return Promise.resolve(message);
  }

  async signTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<string> {
    console.log("==== SIGN TRANSACTION =====");
    const unsignedTx = await ethers.utils.resolveProperties(transaction);
    const serializedTx = ethers.utils.serializeTransaction(
      <UnsignedTransaction>unsignedTx
    );
    const digest = ethers.utils.keccak256(serializedTx);
    return this.canisterSigner
      .sign(ethers.utils.arrayify(digest))
      .then((res: any) => {
        console.log(res);
        let sig = res.Ok.signature;
        console.log(ethers.utils.hexlify(sig));
        return serialize(
          <UnsignedTransaction>unsignedTx,
          ethers.utils.hexlify(sig)
        );
      });
  }

  async sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse> {
    console.log("==== SEND TRANSACTION =====");
    console.log(transaction);
    delete transaction.from;
    return new Promise(async (resolve, reject) => {
      try {
        const tx = await super.populateTransaction(transaction);
        console.log(tx);
        const signed_tx = await this.signTransaction(tx);
        if (this.provider) {
          resolve(await this.provider.sendTransaction(signed_tx));
        }
      } catch (e) {
        console.log(e);
        reject("Canister signing failed");
      }
    });
  }
}

class InternetComputerProvider extends Eip1193Bridge {
  constructor() {
    // @ts-ignore
    super(
      new InternetComputerSigner(),
      new ethers.providers.InfuraProvider(ETH_NETWORK, INFURA_API_KEY)
    );
  }

  async send(method: string, params: Array<any>): Promise<any> {
    let coerce = (value: any) => value;

    switch (method) {
      case "eth_gasPrice": {
        const result = await this.provider.getGasPrice();
        return result.toHexString();
      }
      case "eth_accounts": {
        return [await this.signer.getAddress()];
      }
      case "eth_blockNumber": {
        return await this.provider.getBlockNumber();
      }
      case "eth_chainId": {
        const result = await this.provider.getNetwork();
        return ethers.utils.hexValue(result.chainId);
      }
      case "eth_getBalance": {
        const result = await this.provider.getBalance(params[0], params[1]);
        return result.toHexString();
      }
      case "eth_getStorageAt": {
        return this.provider.getStorageAt(params[0], params[1], params[2]);
      }
      case "eth_getTransactionCount": {
        const result = await this.provider.getTransactionCount(
          params[0],
          params[1]
        );
        return ethers.utils.hexValue(result);
      }
      case "eth_getBlockTransactionCountByHash":
      case "eth_getBlockTransactionCountByNumber": {
        const result = await this.provider.getBlock(params[0]);
        return ethers.utils.hexValue(result.transactions.length);
      }
      case "eth_getCode": {
        const result = await this.provider.getCode(params[0], params[1]);
        return result;
      }
      case "eth_sendRawTransaction": {
        return await this.provider.sendTransaction(params[0]);
      }
      case "eth_call": {
        const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(
          params[0]
        );
        return await this.provider.call(req, params[1]);
      }
      case "estimateGas": {
        const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(
          params[0]
        );
        const result = await this.provider.estimateGas(req);
        return result.toHexString();
      }

      case "eth_getBlockByHash":
      case "eth_getBlockByNumber": {
        if (params[1]) {
          return await this.provider.getBlockWithTransactions(params[0]);
        } else {
          return await this.provider.getBlock(params[0]);
        }
      }
      case "eth_getTransactionByHash": {
        return await this.provider.getTransaction(params[0]);
      }
      case "eth_getTransactionReceipt": {
        return await this.provider.getTransactionReceipt(params[0]);
      }

      case "eth_sign": {
        return this.signer.signMessage(ethers.utils.arrayify(params[1]));
      }

      case "eth_sendTransaction": {
        const req = ethers.providers.JsonRpcProvider.hexlifyTransaction(
          params[0],
          { from: true, gas: true }
        );
        const tx = await this.signer.sendTransaction(req);
        return tx.hash;
      }

      case "eth_getUncleCountByBlockHash":
      case "eth_getUncleCountByBlockNumber": {
        coerce = ethers.utils.hexValue;
        break;
      }

      case "getFeeData":
      case "eth_getTransactionByBlockHashAndIndex":
      case "eth_getTransactionByBlockNumberAndIndex":
      case "eth_getUncleByBlockHashAndIndex":
      case "eth_getUncleByBlockNumberAndIndex":
      case "eth_newFilter":
      case "eth_newBlockFilter":
      case "eth_newPendingTransactionFilter":
      case "eth_uninstallFilter":
      case "eth_getFilterChanges":
      case "eth_getFilterLogs":
      case "eth_getLogs":
        break;
    }

    if ((<any>this.provider).send) {
      const result = await (<any>this.provider).send(method, params);
      return coerce(result);
    }
  }
}

/**
 * @param options
 */
export interface InternetComputerConstructorArgs {
  actions: Actions;
  options?: any;
}

export class InternetComputer extends Connector {
  /** {@inheritdoc Connector.provider} */
  public provider?: InternetComputerProvider;

  private readonly options?: any;

  constructor({ actions, options }: InternetComputerConstructorArgs) {
    super(actions);
    this.provider = new InternetComputerProvider();
    this.options = options;
  }

  public async deactivate(): Promise<void> {
    // @ts-ignore
    return this.provider.signer.authClient.logout();
  }

  public async activate(): Promise<void> {
    const authClient = await AuthClient.create();
    // @ts-ignore
    this.provider.signer.authClient = authClient;

    const handleAuth = async (authClient: AuthClient) => {
      // At this point we're authenticated, and we can get the identity from the auth client:
      const identity = authClient.getIdentity();
      // Using the identity obtained from the auth client, we can create an agent to interact with the IC.
      const agent = new HttpAgent({ identity });

      const signer = createActor(canisterId, {
        agent,
      });

      if (this.provider) {
        // @ts-ignore
        this.provider.signer.canisterSigner = signer;
      }

      // Invalidate identity then render login when user goes idle
      authClient.idleManager?.registerCallback(() => {
        console.log("Triggered idle");
      });

      try {
        if (!this.provider) throw new NoSafeContext();

        this.actions.update({
          chainId: CHAIN_ID,
          accounts: [await this.provider.signer.getAddress()],
        });
      } catch (error) {
        throw error;
      }
    };

    if (!(await authClient.isAuthenticated())) {
      await new Promise((resolve, reject) => {
        authClient.login({
          identityProvider: process.env.II_URL,
          onSuccess: async () => {
            handleAuth(authClient);
          },
          onError: reject,
        });
      });
    } else {
      handleAuth(authClient);
    }
  }
}
