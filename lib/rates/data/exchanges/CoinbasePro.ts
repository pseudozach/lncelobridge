import Exchange, { makeRequest } from '../Exchange';

class CoinbasePro implements Exchange {
  private static readonly API = 'https://api.pro.coinbase.com';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    console.log('1CoinbasePro getPrice ', baseAsset, quoteAsset);
    baseAsset = baseAsset === 'CELO' ? 'CGLD' : baseAsset
    console.log('2CoinbasePro getPrice ', baseAsset, quoteAsset);
    if(baseAsset === 'CELO' && quoteAsset === 'BTC') {
      const response1 = await makeRequest(`${CoinbasePro.API}/products/CGLD-USD/ticker`);
      const response2 = await makeRequest(`${CoinbasePro.API}/products/BTC-USD/ticker`);
      return Number(response1.price/response2.price);
    } else {
      const response = await makeRequest(`${CoinbasePro.API}/products/${baseAsset}-${quoteAsset}/ticker`);
      return Number(response.price);
    }

  }
}

export default CoinbasePro;
