import { readFileSync } from 'node:fs'
import path from 'node:path'
import { genlayerClient, serverConfig } from './config.js'

export async function deployAtlasJuryIfNeeded() {
  if (serverConfig.genlayer.contractAddress) {
    return serverConfig.genlayer.contractAddress
  }

  if (!serverConfig.genlayer.privateKey) {
    throw new Error('Set GENLAYER_PRIVATE_KEY to deploy or use the AtlasJury StudioNet contract.')
  }

  const contractPath = path.resolve(process.cwd(), '../contracts/genlayer/contracts/atlas_jury.py')
  const code = new Uint8Array(readFileSync(contractPath))

  const hash = await genlayerClient.deployContract({
    code,
    args: [serverConfig.atlasProtocolName],
  })
  const receipt = await genlayerClient.waitForTransactionReceipt({ hash, retries: 200 })
  const address = receipt?.data?.contract_address || receipt?.txDataDecoded?.contractAddress

  serverConfig.genlayer.contractAddress = address
  return address
}

export async function evaluateClaimOnGenlayer({
  claimKey,
  category,
  description,
  evidenceUri,
  evidenceManifest,
  requestedAmountMicroUsdc,
}) {
  const contractAddress = await deployAtlasJuryIfNeeded()

  const hash = await genlayerClient.writeContract({
    address: contractAddress,
    functionName: 'evaluate_claim',
    args: [
      claimKey,
      category,
      description,
      evidenceUri,
      evidenceManifest,
      Number(requestedAmountMicroUsdc),
    ],
    value: 0n,
  })

  await genlayerClient.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
    retries: 200,
  })

  const verdict = await genlayerClient.readContract({
    address: contractAddress,
    functionName: 'get_claim',
    args: [claimKey],
  })

  return {
    hash,
    contractAddress,
    verdict,
  }
}
