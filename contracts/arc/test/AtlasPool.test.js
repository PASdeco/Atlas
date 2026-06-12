import { strict as assert } from 'node:assert'
import { ethers } from 'hardhat'

describe('Atlas Arc contracts', function () {
  async function deployFixture() {
    const [owner, treasury, member, relayer] = await ethers.getSigners()

    const MockUSDC = await ethers.getContractFactory('MockUSDC')
    const usdc = await MockUSDC.deploy()
    await usdc.waitForDeployment()

    const AtlasPool = await ethers.getContractFactory('AtlasPool')
    const pool = await AtlasPool.deploy(await usdc.getAddress(), treasury.address, 1000)
    await pool.waitForDeployment()

    const AtlasClaims = await ethers.getContractFactory('AtlasClaims')
    const claims = await AtlasClaims.deploy(await pool.getAddress(), relayer.address)
    await claims.waitForDeployment()

    await (await pool.setClaimsContract(await claims.getAddress())).wait()

    await (await usdc.mint(member.address, 1_000_000_000)).wait()

    return { owner, treasury, member, relayer, usdc, pool, claims }
  }

  it('splits premium deposits atomically between pool and treasury', async function () {
    const { treasury, member, usdc, pool } = await deployFixture()
    const depositAmount = 10_000_000

    await (await usdc.connect(member).approve(await pool.getAddress(), depositAmount)).wait()
    await (await pool.connect(member).depositPremium(member.address, depositAmount)).wait()

    const poolBalance = await pool.poolBalance()
    const treasuryCollected = await pool.totalTreasuryCollected()
    const treasuryBalance = await usdc.balanceOf(treasury.address)

    assert.equal(poolBalance, 9_000_000n)
    assert.equal(treasuryCollected, 1_000_000n)
    assert.equal(treasuryBalance, 1_000_000n)
  })

  it('records claims and pays approved verdicts through the pool', async function () {
    const { treasury, member, relayer, usdc, pool, claims } = await deployFixture()
    const depositAmount = 10_000_000
    const payoutAmount = 3_500_000

    await (await usdc.connect(member).approve(await pool.getAddress(), depositAmount)).wait()
    await (await pool.connect(member).depositPremium(member.address, depositAmount)).wait()

    await (
      await claims
        .connect(member)
        .submitClaim('Auto', 'ipfs://evidence', 'Rear-side impact at traffic light', 5_000_000, 'demo-claim')
    ).wait()

    await (
      await claims
        .connect(relayer)
        .queueClaimForVerdict(1, 'studionet:claim-1')
    ).wait()

    await (
      await claims
        .connect(relayer)
        .resolveAndPayClaim(1, true, payoutAmount, 'ipfs://verdict', 'studionet:claim-1')
    ).wait()

    const poolBalance = await pool.poolBalance()
    const memberBalance = await usdc.balanceOf(member.address)
    const treasuryBalance = await usdc.balanceOf(treasury.address)
    const claimSummary = await claims.getClaimSummary(1)

    assert.equal(poolBalance, 5_500_000n)
    assert.equal(memberBalance, 993_500_000n)
    assert.equal(treasuryBalance, 1_000_000n)
    assert.equal(claimSummary[1], 4n)
    assert.equal(claimSummary[3], payoutAmount)
  })
})
