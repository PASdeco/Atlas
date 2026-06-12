import { config as dotenvConfig } from 'dotenv'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createAccount, createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

dotenvConfig({ path: '../../.env' })
dotenvConfig()

async function main() {
  const privateKey = process.env.GENLAYER_PRIVATE_KEY
  const rpcUrl = process.env.GENLAYER_RPC_URL || 'https://studio.genlayer.com/api'

  if (!privateKey) {
    throw new Error('Set GENLAYER_PRIVATE_KEY before deploying AtlasJury to StudioNet.')
  }

  const client = createClient({
    chain: studionet,
    endpoint: rpcUrl,
    account: createAccount(privateKey),
  })

  await client.initializeConsensusSmartContract()

  const contractPath = path.resolve(process.cwd(), 'contracts/atlas_jury.py')
  const code = new Uint8Array(readFileSync(contractPath))

  const hash = await client.deployContract({
    code,
    args: [process.env.ATLAS_PROTOCOL_NAME || 'Atlas'],
  })

  const receipt = await client.waitForTransactionReceipt({
    hash,
    retries: 200,
  })

  const contractAddress = receipt?.data?.contract_address || receipt?.txDataDecoded?.contractAddress

  console.log(
    JSON.stringify(
      {
        network: 'studionet',
        rpcUrl,
        deployHash: hash,
        contractAddress,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
