import { BigNumber, BigNumberish, providers, utils } from 'ethers';
// import { CeloProvider } from '@celo-tools/celo-ethers-wrapper'
// import { CeloWallet } from '@celo-tools/celo-ethers-wrapper'
import { BlockWithTransactions } from '@ethersproject/abstract-provider';
import Errors from './Errors';
import Logger from '../../Logger';
import { formatError, stringify } from '../../Utils';
import { EthereumConfig, EthProviderServiceConfig } from '../../Config';
import PendingEthereumTransactionRepository from '../../db/PendingEthereumTransactionRepository';

enum EthProviderService {
  Infura = 'Infura',
  Alchemy = 'Alchemy',
  Websocket = 'WebSocket'
}

type KeepAliveParams = {
  provider: providers.WebSocketProvider;
  onDisconnect: (err: any) => void;
  expectedPongBack?: number;
  checkInterval?: number;
};

// to reconnect to forno - disconnects every 20 minutes
// const Web3WsProvider = require('web3-providers-ws');
// import Web3 from 'web3';

/**
 * This provider is a wrapper for the WebSocketProvider of ethers but it writes sent transactions to the database
 * and, depending on the configuration, falls back to Alchemy and Infura as Web3 provider
 */
class InjectedProvider implements providers.Provider {
// class InjectedProvider implements CeloProvider {
  public _isProvider = true;

  private providers = new Map<string, providers.WebSocketProvider>();
  private pendingEthereumTransactionRepository = new PendingEthereumTransactionRepository();

  private network!: providers.Network;

  private static readonly requestTimeout = 5000;

  private config: EthereumConfig;

  constructor(private logger: Logger, config: EthereumConfig) {
    this.config = config;
    if (config.providerEndpoint) {

      // web3 websocketprovider
      // let provider = new Web3.providers.WebsocketProvider(config.providerEndpoint)

      // Keeps track of the number of times we've retried to set up a new provider
      // // and subs without a successful header
      // let sequentialRetryCount = 0
      
      // const setupNewProviderAndSubs = async () => {
      //     // To prevent us from retrying too aggressively, wait a little if
      //     // we try setting up multiple times in a row
      //     const sleepTimeMs = sequentialRetryCount * 100
      //     console.log('sleeping', sleepTimeMs)
      //     await sleep(sleepTimeMs)
      //     sequentialRetryCount++
      //     // To avoid a situation where multiple error events are triggered
      //     if (!setupNewProvider) {
      //         setupNewProvider = true
      //         setupProviderAndSubscriptions()
      //     }
      // }
      
      // // new method to enable reconnection - doesnt work with forno
      // const wsprovider = new Web3WsProvider(config.providerEndpoint, {
      //   timeout: 4000, // ms
      //   clientConfig: {
      //       keepalive: true,
      //       keepaliveInterval: 60000, // ms
      //     },
      //     // Enable auto reconnection
      //     reconnect: {
      //       auto: true,
      //       delay: 1000, // ms
      //       maxAttempts: 999,
      //       onTimeout: false,
      //     }
      // });

      // wsprovider.on('error', async () => {
      //     console.log('WebsocketProvider encountered an error');
      //     // await setupNewProviderAndSubs()
      // })
      
      // wsprovider.on('end', async () => {
      //     console.log('WebsocketProvider has ended, will restart')
      //     // await setupNewProviderAndSubs()
      // })

      // const wrappedProvider = new providers.WebSocketProvider(wsprovider);
      
      const ethersProvider = new providers.WebSocketProvider(
        config.providerEndpoint,
      );

      this.providers.set(EthProviderService.Websocket, 
        ethersProvider
      );
      // this.keepAlive({
      //   ethersProvider,
      //   onDisconnect: (err) => {
      //     startBot();
      //     console.error('The ws connection was closed', JSON.stringify(err, null, 2));
      //   },
      // });
      this.logAddedProvider(EthProviderService.Websocket, { endpoint: config.providerEndpoint });
    } else {
      this.logDisabledProvider(EthProviderService.Websocket, 'no endpoint was specified');
    }

    const addEthProvider = (name: EthProviderService, providerConfig: EthProviderServiceConfig) => {
      if (!providerConfig.apiKey) {
        this.logDisabledProvider(name, 'no api key was set');
        return;
      }

      if (!providerConfig.network) {
        this.logDisabledProvider(name, 'no network was specified');
        return;
      }

      switch (name) {
        case EthProviderService.Infura:
          this.providers.set(name, new providers.InfuraWebSocketProvider(
            providerConfig.network,
            providerConfig.apiKey,
          ));
          break;

        case EthProviderService.Alchemy:
          this.providers.set(name, new providers.AlchemyWebSocketProvider(
            providerConfig.network,
            providerConfig.apiKey,
          ));
          break;

        default:
          this.logDisabledProvider(name, 'provider not supported');
          return;
      }

      this.logAddedProvider(name, providerConfig);
    };

    addEthProvider(EthProviderService.Infura, config.infura);
    addEthProvider(EthProviderService.Alchemy, config.alchemy);

    if (this.providers.size === 0) {
      throw Errors.NO_PROVIDER_SPECIFIED();
    }
  }

  public init = async (): Promise<void> => {
    this.logger.verbose(`Trying to connect to ${this.providers.size} Web3 providers:\n - ${Array.from(this.providers.keys()).join('\n - ')}`);

    const networks: providers.Network[] = [];

    for (const [providerName, provider] of this.providers) {
      try {
        const network = await provider.getNetwork();
        this.logConnectedProvider(providerName, network);
        networks.push(network);
      } catch (error) {
        this.logDisabledProvider(providerName, `could not connect: ${formatError(error)}`);
        this.providers.delete(providerName);
      }
    }

    const networksAreSame = networks.every((network) => network.chainId === networks[0].chainId);

    if (!networksAreSame) {
      throw Errors.UNEQUAL_PROVIDER_NETWORKS(networks);
    }

    this.network = networks[0];
    this.logger.info(`Connected to ${this.providers.size} Eth Web3 providers:\n - ${Array.from(this.providers.keys()).join('\n - ')}`);
  }

  public destroy = async (): Promise<void> => {
    for (const provider of this.providers.values()) {
      await provider.destroy();
    }
  }

  /*
   * Method calls
   */

  public call = (
    transaction: utils.Deferrable<providers.TransactionRequest>,
    blockTag?: providers.BlockTag,
  ): Promise<string> => {
    this.logger.verbose("celo call tx: " + JSON.stringify(transaction));
    return this.forwardMethod('call', transaction, blockTag);
  }

  public estimateGas = (transaction: providers.TransactionRequest): Promise<BigNumber> => {
    this.logger.debug("celo estimategas tx: " + JSON.stringify(transaction));
    return this.forwardMethod('estimateGas', transaction);
  }

  public getBalance = (addressOrName: string, blockTag?: providers.BlockTag): Promise<BigNumber> => {
    return this.forwardMethod('getBalance', addressOrName, blockTag);
  }

  public getBlock = (blockHashOrBlockTag: providers.BlockTag): Promise<providers.Block> => {
    return this.forwardMethod('getBlock', blockHashOrBlockTag);
  }

  public getBlockNumber = (): Promise<number> => {
    return this.forwardMethod('getBlockNumber');
  }

  public getBlockWithTransactions = (blockHashOrBlockTag: providers.BlockTag): Promise<BlockWithTransactions> => {
    return this.forwardMethod('getBlockWithTransactions', blockHashOrBlockTag);
  }

  public getCode = (addressOrName: string, blockTag?: providers.BlockTag): Promise<string> => {
    return this.forwardMethod('getCode', addressOrName, blockTag);
  }

  public getGasPrice = (): Promise<BigNumber> => {
    // this.logger.error("eth getGasPrice tx: ");
    return this.forwardMethod('getGasPrice');
  }

  public getLogs = (filter: providers.Filter): Promise<Array<providers.Log>> => {
    this.logger.verbose("celo getLogs " + JSON.stringify(filter));
    return this.forwardMethod('getLogs', filter);
  }

  public getNetwork = async (): Promise<providers.Network> => {
    return this.network;
  }

  public getStorageAt = (
    addressOrName: string,
    position: BigNumberish,
    blockTag?: providers.BlockTag,
  ): Promise<string> => {
    return this.forwardMethod('getStorageAt', addressOrName, position, blockTag);
  }

  public getTransaction = (transactionHash: string): Promise<providers.TransactionResponse> => {
    return this.forwardMethod('getTransaction', transactionHash);
  }

  public getTransactionCount = (
    addressOrName: string,
    blockTag?: providers.BlockTag,
  ): Promise<number> => {
    this.logger.debug("eth getTransactionCount tx: " + JSON.stringify(addressOrName));
    return this.forwardMethod('getTransactionCount', addressOrName, blockTag);
  }

  public getTransactionReceipt = (transactionHash: string): Promise<providers.TransactionReceipt> => {
    return this.forwardMethod('getTransactionReceipt', transactionHash);
  }

  public lookupAddress = (address: string): Promise<string> => {
    return this.forwardMethod('lookupAddress', address);
  }

  public resolveName = (name: string): Promise<string> => {
    this.logger.debug("celo resolveName tx: " + name);
    return this.forwardMethod('resolveName', name);
  }

  public sendTransaction = async (signedTransaction: string): Promise<providers.TransactionResponse> => {
    const transaction = utils.parseTransaction(signedTransaction);

    this.logger.silly(`Sending Celo transaction: ${transaction.hash}`);
    await this.pendingEthereumTransactionRepository.addTransaction(
      transaction.hash!,
      transaction.nonce,
    );

    const promises: Promise<providers.TransactionResponse>[] = [];

    // When sending a transaction, you want it to propagate on the network as quickly as possible
    // Therefore, we send the it to all available providers
    for (const provider of this.providers.values()) {
      // TODO: handle rejections
      promises.push(provider.sendTransaction(signedTransaction));
    }

    // Return the result from whichever provider resolved the Promise first
    // The other "sendTransaction" calls will still be executed but the result won't be returned
    return Promise.race(promises);
  }

  public waitForTransaction = (transactionHash: string, confirmations?: number, timeout?: number): Promise<providers.TransactionReceipt> => {
    return this.forwardMethod('waitForTransaction', {
      transactionHash,
      confirmations,
      timeout,
    });
  }

  /*
   * Listeners
   */

  public emit = (eventName: providers.EventType, ...args: Array<any>): boolean => {
    for (const [, provider] of this.providers) {
      provider.emit(eventName, args);
    }

    return true;
  }

  public addListener = (eventName: providers.EventType, listener: providers.Listener): providers.Provider => {
    return this.on(eventName, listener);
  }

  public listenerCount(eventName?: providers.EventType): number {
    return Array.from(this.providers.values())[0].listenerCount(eventName);
  }

  public listeners(eventName?: providers.EventType): Array<providers.Listener> {
    return Array.from(this.providers.values())[0].listeners(eventName);
  }

  public off = (eventName: providers.EventType, listener?: providers.Listener): providers.Provider => {
    for (const [, provider] of this.providers) {
      provider.off(eventName, listener);
    }

    return this;
  }

  public on = (eventName: providers.EventType, listener: providers.Listener): providers.Provider => {
    const providerDeltas = new Map<number, number>();

    const injectedListener = (...args: any[]) => {
      if (this.providers.size === 1) {
        listener(...args);
        return;
      }

      const hashCode = this.hashCode(args.map((entry) => JSON.stringify(entry)).join());
      const currentDelta = providerDeltas.get(hashCode) || 0;

      if (currentDelta === this.providers.size - 1) {
        providerDeltas.delete(hashCode);
      } else {
        providerDeltas.set(hashCode, currentDelta + 1);
      }

      if (currentDelta === 0) {
        listener(...args);
      }
    };

    for (const provider of this.providers.values()) {
      provider.on(eventName, injectedListener);
    }

    return this;
  }

  public once = (eventName: providers.EventType, listener: providers.Listener): providers.Provider => {
    let emittedEvent = false;

    const injectedListener = (...args: any[]) => {
      if (!emittedEvent) {
        emittedEvent = true;
        listener(...args);
      }
    };

    for (const provider of this.providers.values()) {
      provider.once(eventName, injectedListener);
    }

    return this;
  }

  public removeAllListeners(eventName?: providers.EventType): providers.Provider {
    for (const [, provider] of this.providers) {
      provider.removeAllListeners(eventName);
    }

    return this;
  }

  public removeListener = (eventName: providers.EventType, listener: providers.Listener): providers.Provider => {
    return this.off(eventName, listener);
  }

  /*
   * Helper utils
   */

  private forwardMethod = async (method: string, ...args: any[]): Promise<any> => {
    const errors: string[] = [];

    let resultIsNull = false;

    for (const [providerName, provider] of this.providers) {
      try {
        const result = await this.promiseWithTimeout(
          provider[method](...args),
          'timeout',
        );

        if (result !== null) {
          // this.logger.error("eth forwardmethod result is not null " +method+ ", " + JSON.stringify(result));
          return result;
        } else {
          // this.logger.error("eth forwardmethod result is NULL " +method)
          resultIsNull = true;
        }
      } catch (error) {
        this.logger.error("eth injectedprovider caught: " + JSON.stringify(error));
        // let dummyresult = {"jsonrpc":"2.0","id":1,"result":"0xb5aa"};
        // // dummyresult = "0x0";
        // // return dummyresult;

        // let errorstr = JSON.stringify(error);
        // // let errorjson = JSON.parse(error);
        // // this.logger.error("eth injectedprovider caught: " + JSON.stringify(error) + "\nerror.response: " + errorjson.response);
        // if(errorstr.includes("cannot estimate gas")){
        //   this.logger.error("eth returning dummy response: " + dummyresult);
        //   return dummyresult;
        // } else {
        //   this.logger.error("eth some other error fail");
        // }
        // // return dummyresult;

        const formattedError = formatError(error);

        this.logger.warn(`Request to ${providerName} Web3 provider failed: ${method}: ${formattedError}`);
        errors.push(formattedError);

        // reconnect websocket manually?
        this.logger.verbose('injectedprovider.443 resetting ethersProvider');
        const ethersProvider = new providers.WebSocketProvider(
          this.config.providerEndpoint,
        );
  
        this.providers.set(EthProviderService.Websocket, 
          ethersProvider
        );
      }
    }

    if (resultIsNull) {
      return null;
    }

    throw Errors.REQUESTS_TO_PROVIDERS_FAILED(errors);
  }

  private promiseWithTimeout = (promise: Promise<any>, errorMessage: string): Promise<any> => {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(errorMessage), InjectedProvider.requestTimeout);
    });

    return Promise.race([
      promise,
      timeoutPromise,
    ]).then((result) => {
      clearTimeout(timeoutHandle);
      return result;
    });
  }

  private hashCode = (value: string): number => {
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }

    return hash;
  }

  private logAddedProvider = (name: string, config: Record<string, any>) => {
    this.logger.debug(`Adding Web3 provider ${name}: ${stringify(config)}`);
  }

  private logConnectedProvider = (name: string, network: providers.Network) => {
    this.logger.verbose(`Connected to Web3 provider ${name} on network: ${network.chainId}`);
  }

  private logDisabledProvider = (name: string, reason: string) => {
    this.logger.warn(`Disabled ${name} Web3 provider: ${reason}`);
  }
  
  private keepAlive = ({
    provider,
    onDisconnect,
    expectedPongBack = 15000,
    checkInterval = 7500,
  }: KeepAliveParams) => {
    let pingTimeout: NodeJS.Timeout | null = null;
    let keepAliveInterval: NodeJS.Timeout | null = null;
  
    provider._websocket.on('open', () => {
      keepAliveInterval = setInterval(() => {
        provider._websocket.ping();
  
        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, expectedPongBack);
      }, checkInterval);
    });
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider._websocket.on('close', (err: any) => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (pingTimeout) clearTimeout(pingTimeout);
      onDisconnect(err);
    });
  
    provider._websocket.on('pong', () => {
      if (pingTimeout) clearInterval(pingTimeout);
    });
  };

  private startBot = (wsUrl: string) => {
    const provider = new providers.WebSocketProvider(wsUrl);
    this.keepAlive({
        provider,
        onDisconnect: (err) => {
          this.startBot(wsUrl);
          console.error('The ws connection was closed', JSON.stringify(err, null, 2));
        },
      });
  };

}

export default InjectedProvider;
