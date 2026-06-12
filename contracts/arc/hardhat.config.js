import { config as dotenvConfig } from 'dotenv'
import hardhatEthersPlugin from '@nomicfoundation/hardhat-ethers'
import hardhatIgnitionPlugin from '@nomicfoundation/hardhat-ignition'

dotenvConfig({ path: '../../.env' })
dotenvConfig()

const arcRpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'
const arcPrivateKey = process.env.ARC_DEPLOYER_PRIVATE_KEY

export default {
  plugins: [hardhatEthersPlugin, hardhatIgnitionPlugin],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    arcTestnet: {
      type: 'http',
      chainType: 'l1',
      url: arcRpcUrl,
      accounts: arcPrivateKey ? [arcPrivateKey] : [],
    },
  },
}
