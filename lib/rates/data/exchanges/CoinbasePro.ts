import Exchange, { makeRequest } from '../Exchange';

class CoinbasePro implements Exchange {
  private static readonly API = 'https://api.pro.coinbase.com';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    if(baseAsset === 'CELO' && quoteAsset === 'BTC') {
      const response1 = await makeRequest(`${CoinbasePro.API}/products/CGLD-USD/ticker`);
      const response2 = await makeRequest(`${CoinbasePro.API}/products/BTC-USD/ticker`);
      // console.log('coinbase returning ', response1.price/response2.price)
      return Number(parseFloat(response1.price)/parseFloat(response2.price));
    } else {
      const response = await makeRequest(`${CoinbasePro.API}/products/${baseAsset}-${quoteAsset}/ticker`);
      return Number(response.price);
    }

  }
}

export default CoinbasePro;
