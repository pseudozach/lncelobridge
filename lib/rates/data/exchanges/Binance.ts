import Exchange, { makeRequest } from '../Exchange';

class Binance implements Exchange {
  private static readonly API = 'https://api.binance.com/api/v3';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    console.log('binance getPrice ', baseAsset, quoteAsset);
    // quoteAsset = quoteAsset ? 'USD' : 'USDT'
    if (baseAsset === 'CELO' && quoteAsset === 'BTC') {
      // get btcusdt and celousdt and divide
      const response1 = await makeRequest(`${Binance.API}/ticker/price?symbol=CELOUSDT`);
      const response2 = await makeRequest(`${Binance.API}/ticker/price?symbol=BTCUSDT`);
      console.log('binance returning ', response1.price/response2.price)
      return Number(parseFloat(response1.price)/parseFloat(response2.price));
    } else {
      const response = await makeRequest(`${Binance.API}/ticker/price?symbol=${baseAsset.toUpperCase()}${quoteAsset.toUpperCase()}`);
      return Number(response.price);
    }

  }
}

export default Binance;
