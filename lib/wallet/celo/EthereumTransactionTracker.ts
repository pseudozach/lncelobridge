// import { providers, Signer } from 'ethers';
import { CeloProvider } from '@celo-tools/celo-ethers-wrapper'
import { CeloWallet } from '@celo-tools/celo-ethers-wrapper'
import Logger from '../../Logger';
import PendingEthereumTransactionRepository from '../../db/PendingEthereumTransactionRepository';

class EthereumTransactionTracker {
  private pendingEthereumTransactionRepository = new PendingEthereumTransactionRepository();

  private walletAddress!: string;

  private localProvider!: CeloProvider;

  constructor(
    private logger: Logger,
    // private provider: providers.Provider,
    // private provider: CeloProvider,
    // private wallet: Signer,
    private wallet: CeloWallet,
  ) {}

  public init = async (): Promise<void> => {
    this.walletAddress = await this.wallet.getAddress();
    this.logger.info(`Starting Celo transaction tracker for address: ${this.walletAddress}`);

    // const celoBlockNumber = await this.provider.getBlockNumber();
    // this.logger.verbose('Celo blocknumber: '+ celoBlockNumber);

    // Connecting to Alfajores testnet
    this.localProvider = new CeloProvider('https://alfajores-forno.celo-testnet.org')
    const originalBlockFormatter = this.localProvider.formatter._block;
    this.localProvider.formatter._block = (value, format) => {
      return originalBlockFormatter(
        {
          gasLimit: 0,
          ...value,
        },
        format,
      );
    };
    await this.localProvider.ready

    // await this.scanBlock(await this.provider.getBlockNumber());
    await this.scanBlock(await this.localProvider.getBlockNumber());
  }

  /**
   * Scans a block and removes pending transactions from the database in case they were confirmed
   * This method is public and gets called from "EthereumManager" because there is a block subscription
   * in that class already
   */
  public scanBlock = async (blockNumber: number): Promise<void> => {
    try {
      // console.log('celo tx tracker provider', this.provider, blockNumber);
      // const block = await this.provider.getBlockWithTransactions(blockNumber);
      const block = await this.localProvider.getBlockWithTransactions(blockNumber);

      for (const transaction of block.transactions) {
        if (transaction.from === this.walletAddress) {
          const confirmedTransactions = await this.pendingEthereumTransactionRepository.findByNonce(transaction.nonce);
  
          if (confirmedTransactions.length > 0) {
            this.logger.debug(`Removing ${confirmedTransactions.length} confirmed Celo transactions`);
  
            for (const confirmedTransaction of confirmedTransactions) {
              this.logger.silly(`Removing confirmed Celo transaction: ${confirmedTransaction.hash}`);
              await confirmedTransaction.destroy();
            }
          }
        }
      }      
    } catch(error) {
      this.logger.error('celo scanBlock error ' + error.message);
    }

  }
}

export default EthereumTransactionTracker;
