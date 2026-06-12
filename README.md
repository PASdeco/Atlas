# Atlas

Atlas is an AI-powered decentralized consumer insurance experience built around two networks:

- Arc Testnet is the money layer. Premiums, fee splitting, pooled reserves, and claim payouts all happen in USDC on Arc.
- GenLayer StudioNet is the intelligence layer. Claim evidence is reviewed by an on-chain AI jury contract that returns a verdict back into the Arc payout flow.

The current codebase is a full-stack prototype designed to prove the end-to-end user journey:

1. A member signs in with Privy using Google or a crypto wallet.
2. Atlas creates or connects an Arc-compatible wallet.
3. A premium is paid in test mode through a sponsored Arc USDC deposit or directly from the wallet.
4. Atlas files the claim on Arc, sends the evidence package to GenLayer StudioNet, and resolves the verdict back into Arc.
5. Approved claims are paid from the pool in USDC, with the Atlas treasury fee collected atomically inside the pool contract.

## Architecture

### Frontend

- `src/` contains the React application and product UI.
- `src/lib/atlasAppContext.jsx` coordinates login state, wallet flows, overview loading, premium actions, and claim submission.
- `src/lib/privyConfig.js` configures Privy for Arc Testnet with embedded wallet creation for non-crypto users.

### Shared config

- `shared/atlasNetworks.js` stores canonical Arc Testnet and GenLayer StudioNet constants.
- `shared/atlasAbis.js` exposes the Arc contract ABIs used by both the frontend and relay.

### Arc money layer

- `contracts/arc/contracts/AtlasPool.sol`
  - Holds the community USDC pool
  - Splits each premium deposit atomically into pool funds and Atlas treasury revenue
  - Uses configurable `feeBps` and treasury wallet settings
- `contracts/arc/contracts/AtlasClaims.sol`
  - Records claims
  - Queues claims for verdict review
  - Accepts a relayed verdict and triggers payout execution through the pool
- `contracts/arc/contracts/MockUSDC.sol`
  - Local test token used by Hardhat tests

### GenLayer StudioNet intelligence layer

- `contracts/genlayer/contracts/atlas_jury.py`
  - Intelligent contract that evaluates uploaded evidence
  - Returns approved or rejected verdicts plus payout guidance

### Relay backend

- `server/src/index.js`
  - Exposes the Atlas API used by the frontend
  - Provides overview data
  - Queues sponsored card deposits in test mode
  - Bridges Arc claim submission to GenLayer StudioNet evaluation and back to Arc payout resolution
- `server/src/store.js`
  - In-memory store for deposits and claim activity during local development

## Networks

### Arc Testnet

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Testnet USDC: `0x3600000000000000000000000000000000000000`

### GenLayer StudioNet

- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com`

## Environment setup

Copy `.env.example` to `.env` and fill in the values you want to use locally.

### Frontend variables

- `VITE_PRIVY_APP_ID`
- `VITE_PRIVY_CLIENT_ID`
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_API_BASE_URL`
  - Leave this empty for same-origin `/api` calls on Vercel.
  - Set it to `http://localhost:8787` only if you are bypassing the Vite proxy during local development.
- `VITE_ARC_RPC_URL`
- `VITE_ARC_USDC_ADDRESS`
- `VITE_ATLAS_POOL_ADDRESS`
- `VITE_ATLAS_CLAIMS_ADDRESS`
- `VITE_TERMS_URL`
- `VITE_PRIVACY_URL`

### Relay variables

- `ATLAS_API_PORT`
- `ATLAS_APP_URL`
- `ATLAS_PROTOCOL_NAME`
- `PRIVY_APP_SECRET`
- `PRIVY_VERIFICATION_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`

### Arc variables

- `ARC_RPC_URL`
- `ARC_EXPLORER_URL`
- `ARC_USDC_ADDRESS`
- `ARC_DEPLOYER_PRIVATE_KEY`
- `ARC_SPONSOR_PRIVATE_KEY`
- `ATLAS_TREASURY_WALLET`
- `ATLAS_PLATFORM_FEE_BPS`
- `ATLAS_POOL_ADDRESS`
- `ATLAS_CLAIMS_ADDRESS`
- `ATLAS_GENLAYER_RELAYER`

### GenLayer variables

- `GENLAYER_RPC_URL`
- `GENLAYER_EXPLORER_URL`
- `GENLAYER_PRIVATE_KEY`
- `GENLAYER_ATLAS_JURY_ADDRESS`

## Install

Install dependencies in the root project and each workspace:

```bash
npm install
npm --prefix server install
npm --prefix contracts/arc install
npm --prefix contracts/genlayer install
```

## Run locally

### Frontend + relay

```bash
npm run dev:full
```

This starts:

- Vite on `http://localhost:5173`
- The Atlas relay on `http://localhost:8787`

The Vite dev server proxies `/api/*` requests to the local relay automatically, so the frontend can use the same relative API paths locally and on Vercel.

## Deploy to Vercel

Atlas is configured to deploy as:

- a static Vite frontend from `dist/`
- Vercel Functions for the Express relay under `/api/*`

The checked-in `vercel.json` sets:

- `buildCommand` to `npm run build`
- `installCommand` to install both root and relay dependencies
- SPA rewrites for non-API routes
- a `300` second max duration for API functions

Before deploying, add the production environment variables in Vercel for any live integrations you want enabled:

- `VITE_PRIVY_APP_ID`
- `VITE_PRIVY_CLIENT_ID`
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_ARC_RPC_URL`
- `VITE_ARC_USDC_ADDRESS`
- `VITE_ATLAS_POOL_ADDRESS`
- `VITE_ATLAS_CLAIMS_ADDRESS`
- `ATLAS_APP_URL`
- `ATLAS_TREASURY_WALLET`
- `ATLAS_PLATFORM_FEE_BPS`
- `ATLAS_POOL_ADDRESS`
- `ATLAS_CLAIMS_ADDRESS`
- `ARC_RPC_URL`
- `ARC_EXPLORER_URL`
- `ARC_USDC_ADDRESS`
- `ARC_DEPLOYER_PRIVATE_KEY`
- `ARC_SPONSOR_PRIVATE_KEY`
- `GENLAYER_RPC_URL`
- `GENLAYER_EXPLORER_URL`
- `GENLAYER_ATLAS_JURY_ADDRESS`
- `GENLAYER_PRIVATE_KEY`
- `PRIVY_APP_SECRET`
- `PRIVY_VERIFICATION_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`

### Relay only

```bash
npm run server:start
```

### Frontend only

```bash
npm run dev
```

## Arc contract workflow

### Compile

```bash
npm run contracts:arc:compile
```

### Test

```bash
npm run contracts:arc:test
```

### Deploy to Arc Testnet

Make sure `ATLAS_TREASURY_WALLET`, `ARC_DEPLOYER_PRIVATE_KEY`, and the USDC settings are present in `.env`, then run:

```bash
npm --prefix contracts/arc run deploy:testnet
```

The deploy script prints the deployed `AtlasPool` and `AtlasClaims` addresses so they can be copied back into `.env`.

## GenLayer StudioNet workflow

The relay can deploy `atlas_jury.py` automatically when `GENLAYER_PRIVATE_KEY` is configured but `GENLAYER_ATLAS_JURY_ADDRESS` is empty.

You can also use the GenLayer workspace directly:

```bash
npm --prefix contracts/genlayer run deploy:studionet
```

If you predeploy the StudioNet jury contract, put the returned address into `GENLAYER_ATLAS_JURY_ADDRESS`.

## Deposit and claim flows

### Sponsored card deposit

- The relay treats card checkout as a Stripe test-mode flow.
- On success, it attempts a sponsored USDC deposit into `AtlasPool` on Arc Testnet.
- The smart contract performs the 90/10 split atomically:
  - 90% stays in the community pool
  - 10% moves to the Atlas treasury wallet

### Direct wallet deposit

- The frontend can approve testnet USDC and call `depositPremium` directly from the member wallet.

### Claim evaluation

1. The relay submits the claim to `AtlasClaims` on Arc.
2. The claim is queued for StudioNet review.
3. The relay calls the GenLayer jury contract with the evidence payload.
4. The jury returns an approved or rejected verdict and payout suggestion.
5. The relay resolves the claim on Arc and triggers payout from `AtlasPool` when approved.

## Verification status

The current scaffold has already been verified with:

- `npm run lint`
- `npm run build`
- `npm run contracts:arc:compile`
- `npm run contracts:arc:test`

## Current prototype limits

- The relay store is in-memory, so deposits and claims reset when the relay restarts.
- Stripe is still represented as a test-mode placeholder flow rather than a production webhook pipeline.
- The Privy, Arc, and GenLayer flows are ready for testnet credentials, but they need real project keys and deployed addresses in `.env`.
- The GenLayer-to-Arc bridge is currently implemented through the relay rather than a fully trust-minimized cross-chain mechanism.

## North star

Atlas should feel like a normal consumer insurance product while invisibly using two chains under the hood:

- Arc is the bank
- GenLayer StudioNet is the courtroom

The product experience stays simple for the member, while the protocol logic stays fully aligned with the decentralized insurance model.
