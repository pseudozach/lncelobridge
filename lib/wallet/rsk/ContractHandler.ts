import { BigNumber, ContractTransaction } from 'ethers';
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Logger from '../../Logger';
import { getHexString } from '../../Utils';
import { getGasPrice } from './EthereumUtils';
import ERC20WalletProvider from '../providers/ERC20WalletProvider';
import { ethereumPrepayMinerFeeGasLimit } from '../../consts/Consts';

class ContractHandler {
  private etherSwap!: EtherSwap;
  private erc20Swap!: ERC20Swap;

  constructor(
    private logger: Logger,
  ) {}

  public init = (etherSwap: EtherSwap, erc20Swap: ERC20Swap): void => {
    this.etherSwap = etherSwap;
    this.erc20Swap = erc20Swap;
  }

  public lockupEther = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Locking ${amount} Rbtc with preimagehash, amount, claimaddress, timelock: ${getHexString(preimageHash)}, ${amount}, ${claimAddress.toLowerCase()}, ${timeLock}`);
    return this.etherSwap.lock(preimageHash, claimAddress.toLowerCase(), timeLock, {
      value: amount,
      gasPrice: await getGasPrice(this.etherSwap.provider),
    });
  }

  public lockupEtherPrepayMinerfee = async (
    preimageHash: Buffer,
    amount: BigNumber,
    amountPrepay: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    const transactionValue = amount.add(amountPrepay);

    const gasLimitEstimationWithoutPrepay = await this.etherSwap.estimateGas.lock(
      preimageHash,
      claimAddress,
      timeLock,
      {
        value: transactionValue,
      },
    );

    this.logger.debug(`Locking ${amount} and sending prepay ${amountPrepay} Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.etherSwap.lockPrepayMinerfee(
      preimageHash,
      claimAddress,
      timeLock,
      amountPrepay,
      {
        value: transactionValue,
        gasPrice: await getGasPrice(this.etherSwap.provider),
        // TODO: integration test that tries to exploit the attack vector of using an insane amount of gas in the fallback function of the contract at the claim address
        gasLimit: gasLimitEstimationWithoutPrepay.add(ethereumPrepayMinerFeeGasLimit),
      },
    );
  }

  public claimEther = async (
    preimage: Buffer,
    amount: BigNumber,
    refundAddress: string,
    timelock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Claiming Rbtc with preimage: ${getHexString(preimage)}, ${amount}, ${refundAddress}, ${timelock}`);
    // const gasprice = await getGasPrice(this.etherSwap.provider);
    let gasprice = await getGasPrice(this.etherSwap.provider);
    if(gasprice === BigNumber.from(0)) {
      gasprice = await getGasPrice(this.etherSwap.provider, 21);
    }
    this.logger.debug(`rbtcswap.claim gasprice: ${gasprice}`);
    // on regtest we used 123 which leads to Gas Price 0.000000123 RBTC
    // gasPrice: await getGasPrice(this.etherSwap.provider, 123), -> this is removed on testnet as it leads to high fees
    return this.etherSwap.claim(
      preimage,
      amount,
      refundAddress,
      timelock,
      {
        gasPrice: gasprice,
        gasLimit: 100000
      }
    );
  }

  public refundEther = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timelock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Refunding Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.etherSwap.refund(
      preimageHash,
      amount,
      claimAddress,
      timelock,
      {
        gasPrice: await getGasPrice(this.etherSwap.provider),
      }
    );
  }

  public lockupToken = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Locking ${amount} ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.lock(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }

  public lockupTokenPrepayMinerfee = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    amountPrepay: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    const gasLimitEstimationWithoutPrepay = await this.erc20Swap.estimateGas.lock(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
    );

    this.logger.debug(`Locking ${amount} ${token.symbol} and sending prepay ${amountPrepay} Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.lockPrepayMinerfee(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        value: amountPrepay,
        gasPrice: await getGasPrice(this.etherSwap.provider),
        gasLimit: gasLimitEstimationWithoutPrepay.add(ethereumPrepayMinerFeeGasLimit),
      },
    );
  }

  public claimToken = async (
    token: ERC20WalletProvider,
    preimage: Buffer,
    amount: BigNumber,
    refundAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Claiming ${token.symbol} with preimage: ${getHexString(preimage)}`);
    return this.erc20Swap.claim(
      preimage,
      amount,
      token.getTokenAddress(),
      refundAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }

  public refundToken = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Refunding ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.refund(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }
}

export default ContractHandler;
