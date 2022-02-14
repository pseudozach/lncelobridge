# LN-CELO Bridge

* LN-CELO Bridge aims to enable instant trustless swaps between CELO and Lightning Network.
* It uses submarine-swaps to enable trustless swaps between Celo and Bitcoin on Lightning Network. Swaps are non-custodial and the exchange is KYC-free.

Testnet (alfajores) contracts are deployed at:
Main swap contract: [0xef9dfABCAB725Ca489E969Ff606247207f90f865](https://alfajores-blockscout.celo-testnet.org/address/0xef9dfABCAB725Ca489E969Ff606247207f90f865/transactions)
ERC20 swap contract: [0x58afA0afF6F4451f113c9D90CF14393205f2c8C0](https://alfajores-blockscout.celo-testnet.org/address/0x58afA0afF6F4451f113c9D90CF14393205f2c8C0/transactions)

## install
* Clone the repo, install requirements and compile  
`git clone https://github.com/pseudozach/lncelobridge.git`  
`cd lncelobridge && npm i && npm run compile`  
* Start btc & lnd  
`npm run docker:regtest`
* No need to start local celo node - regtest does not exist - connect to public node
<!-- `npm run celo:geth:alfajores` -->
* Fund signer account from testnet faucet 
* Copy boltz.conf to ~/.boltz/boltz.conf and modify as needed  
* Start the app  
`npm run start`

## use
* Visit `http://localhost:9001/getpairs` to see the API.
* Deploy [frontend](https://github.com/pseudozach/boltz-frontend) and visit `http:localhost:3000` to see the GUI.

## documentation
* API documentation: [Read the Docs](https://docs.boltz.exchange/en/latest/)
