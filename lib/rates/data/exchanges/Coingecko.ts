import Exchange, { makeRequest } from '../Exchange';

class Coingecko implements Exchange {
  // curl -X GET "https://api.coingecko.com/api/v3/simple/price?ids=sovryn&vs_currencies=btc" -H "accept: application/json"
  private static readonly API = 'https://api.coingecko.com/api/v3';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    // BTC SOV
    // console.log("Coingecko getPrice baseAsset quoteAsset: ", baseAsset, quoteAsset);
    // let longerquoteasset = this.longerName(quoteAsset);
    let lowerbaseasset = baseAsset.toLowerCase();
    const pair = `${this.longerName(baseAsset)}&vs_currencies=${quoteAsset}`;
    // console.log("querying pair: ", pair);
    const response = await makeRequest(`${Coingecko.API}/simple/price?ids=${pair}`);
    // console.log("response: ", response, response[lowerbaseasset]);
    const lastprice = response[lowerbaseasset][quoteAsset.toLowerCase()];
    // console.log("coingecko lastprice: ", lastprice);
    return Number(lastprice);

    // const lastTrade = (Object.values(response['result'])[0] as Record<string, string[]>)['c'];

    // return Number(lastTrade[0]);
  }

  private longerName = (asset: string) => {
    switch (asset) {
      case 'SOV': return 'sovryn';
      case 'ETH': return 'ethereum';
      case 'BTC': return 'bitcoin';
      case 'RBTC': return 'rootstock';
      case 'STX': return 'blockstack';
      case 'CELO': return 'celo';

      default: return asset;
    }    
  }

  // private parseAsset = (asset: string) => {
  //   const assetUpperCase = asset.toUpperCase();

  //   switch (assetUpperCase) {
  //     case 'BTC': return 'XBT';
  //     default: return assetUpperCase;
  //   }
  // }
}

export default Coingecko;
