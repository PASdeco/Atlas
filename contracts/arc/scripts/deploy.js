import 'dotenv/config'
import { ethers } from 'hardhat'

const defaultUsdc = process.env.ARC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000'

async function main() {
  const treasuryWallet = process.env.ATLAS_TREASURY_WALLET
  const feeBps = Number(process.env.ATLAS_PLATFORM_FEE_BPS || 1000)
  const relayerWallet = process.env.ATLAS_GENLAYER_RELAYER || ethers.ZeroAddress

  if (!treasuryWallet) {
    throw new Error('Set ATLAS_TREASURY_WALLET before deploying Atlas contracts.')
  }

  const [deployer] = await ethers.getSigners()

  console.log('Deploying from', deployer.address)

  const AtlasPool = await ethers.getContractFactory('AtlasPool')
  const pool = await AtlasPool.deploy(defaultUsdc, treasuryWallet, feeBps)
  await pool.waitForDeployment()

  const AtlasClaims = await ethers.getContractFactory('AtlasClaims')
  const claims = await AtlasClaims.deploy(await pool.getAddress(), relayerWallet)
  await claims.waitForDeployment()

  const poolAddress = await pool.getAddress()
  const claimsAddress = await claims.getAddress()

  const linkTx = await pool.setClaimsContract(claimsAddress)
  await linkTx.wait()

  console.log(
    JSON.stringify(
      {
        network: 'arcTestnet',
        poolAddress,
        claimsAddress,
        usdcAddress: defaultUsdc,
        treasuryWallet,
        feeBps,
        relayerWallet,
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
