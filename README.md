# LN-CELO Bridge

* LN-CELO Bridge aims to enable instant trustless swaps between CELO and Lightning Network.
* It uses submarine-swaps to enable trustless swaps between Celo and Bitcoin on Lightning Network. Swaps are non-custodial and the exchange is KYC-free.

Contracts are deployed at:  
Main swap contract: [mainnet](https://explorer.celo.org/address/0xef9dfABCAB725Ca489E969Ff606247207f90f865/transactions) / [testnet](https://alfajores-blockscout.celo-testnet.org/address/0xef9dfABCAB725Ca489E969Ff606247207f90f865/transactions)  
ERC20 swap contract: [mainnet](https://explorer.celo.org/address/0x58afA0afF6F4451f113c9D90CF14393205f2c8C0/transactions) / [testnet](https://alfajores-blockscout.celo-testnet.org/address/0x58afA0afF6F4451f113c9D90CF14393205f2c8C0/transactions)

## install
* Clone the repo, install requirements and compile  
`git clone https://github.com/pseudozach/lncelobridge.git`  
`cd lncelobridge && npm i && npm run compile`  
* Start btc & lnd  
`npm run docker:regtest`
* Run a local celo node by following instructions at [docs.celo.org](https://docs.celo.org/getting-started/mainnet/running-a-full-node-in-mainnet)
* Fund signer account from [testnet faucet](https://celo.org/developers/faucet)
* Copy boltz.gitpod.conf to ~/.boltz/boltz.conf and modify as needed  
* Start the app  
`npm run start`

## use
* Visit `http://localhost:9001/getpairs` to see the API.
* Deploy [frontend](https://github.com/pseudozach/lncelobridge-frontend) and visit `http:localhost:3000` to see the GUI.

## documentation
* API documentation: [Read the Docs](https://docs.boltz.exchange/en/latest/)
