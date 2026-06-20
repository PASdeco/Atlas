# Atlas

Atlas is a dual-chain consumer protection protocol that keeps money movement on Arc Testnet and claim adjudication inside a GenLayer intelligent contract.

Members activate coverage with USDC, file a claim through a familiar web interface, and receive a verdict that is produced inside GenLayer StudioNet consensus from a submitted claim packet before payout is resolved on Arc.

> Status: testnet prototype  
> Money layer: Arc Testnet  
> Intelligence layer: GenLayer StudioNet  
> Data policy: Atlas renders live data or honest empty states, never fabricated balances

## Why Atlas

Traditional claims systems are slow, opaque, and operationally expensive. Atlas explores a different model:

- stablecoin-native coverage using USDC
- transparent pooled reserves and protocol fee accounting on-chain
- deterministic payout execution through smart contracts
- AI-assisted claim review performed inside a GenLayer intelligent contract instead of a hidden backend workflow
- consumer-friendly onboarding with Google sign-in or wallet connection

## What Atlas Does Today

- Onboards members with Privy using Google or wallet login
- Creates or connects an Arc-compatible wallet
- Accepts premium payments through direct wallet deposit, or card-triggered sponsored deposits when configured
- Splits each premium between the community pool and Atlas treasury inside `AtlasPool.sol`
- Registers claims on Arc through `AtlasClaims.sol`
- Sends a submitted claim packet and evidence metadata to a GenLayer intelligent contract for verdict generation
- Resolves approved or rejected claims back on Arc and executes payout from the pool
- Surfaces live overview, coverage, pool, and claim activity data in the frontend

## System Architecture

```mermaid
flowchart LR
  U[Member]
  F[React frontend]
  R[Atlas relay API]

  subgraph ARC[Arc Testnet - money layer]
    P[AtlasPool.sol]
    C[AtlasClaims.sol]
  end

  subgraph GEN[GenLayer StudioNet - intelligence layer]
    J[atlas_jury.py]
  end

  U --> F
  F -->|relative /api requests| R
  F -->|wallet premium deposit| P
  R -->|sponsored premium deposit| P
  R -->|submit and queue claim| C
  R -->|evaluate_claim(...)| J
  J -->|finalized verdict| R
  C -->|resolveAndPayClaim(...)| P
```

## Dual-Chain Model

### Arc Testnet: money layer

Arc is responsible for settlement and fund custody:

- premium deposits
- community reserve accounting
- treasury fee collection
- claim registration
- payout execution in USDC

### GenLayer StudioNet: intelligence layer

GenLayer is responsible for verdict generation:

- receiving a submitted claim packet and evidence metadata
- producing a verdict inside the intelligent contract
- finalizing the result through StudioNet consensus
- returning structured claim output for Arc resolution

This split keeps financial state on Arc while moving claim reasoning into a consensus-backed intelligent contract environment.

## Verdict Engine and Consensus

Atlas's claim verdict does not originate in the browser and it is not invented by the relay.

The verdict flow is implemented in [`contracts/genlayer/contracts/atlas_jury.py`](./contracts/genlayer/contracts/atlas_jury.py):

- `evaluate_claim(...)` receives the claim payload
- the contract uses `gl.nondet.exec_prompt(...)` to generate structured AI output
- validators independently re-run the reasoning flow and only accept matching decision classes
- the result is finalized through GenLayer StudioNet consensus
- the relay waits for finalization, reads the stored verdict back from the contract, and only then resolves the Arc claim

Important implementation note:

- the current contract version uses GenLayer AI prompt execution and consensus validation
- it treats the input as a claimant-submitted claim packet, not independently verified evidence artifacts
- it does **not** currently fetch external web sources or retrieve file contents during adjudication
- verdict quality therefore depends on the submitted claim packet supplied to the contract call

## Product Flow

### 1. Member onboarding

Atlas uses Privy to support:

- Google sign-in
- wallet sign-in
- embedded wallet creation for members who do not already have a wallet

### 2. Coverage activation

Members can activate coverage in two ways:

- direct wallet deposit on Arc
- card-triggered sponsored deposit when Stripe is configured

Premiums are routed into `AtlasPool.sol`, where the contract atomically splits each payment between:

- the community pool
- the Atlas treasury wallet

The split is controlled by `feeBps`, so the treasury percentage is configurable rather than hardcoded.

### 3. Claim filing

When a member files a claim:

1. the relay verifies coverage status
2. the claim is submitted to `AtlasClaims.sol`
3. the claim is queued for GenLayer review
4. the evidence payload is sent to `AtlasJury.evaluate_claim(...)`
5. the finalized verdict is read back from GenLayer
6. the relay resolves the Arc claim and triggers payout when approved

### 4. Live frontend state

The frontend reads:

- live pool balances
- live coverage status
- real claim history where available
- honest empty or read-only states when live data is unavailable

Atlas intentionally avoids demo balances and fabricated member activity in live behavior.

## Tech Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React 19, Vite, React Router, Framer Motion, Recharts | consumer UI, wallet UX, dashboards, claim flow |
| Authentication | Privy | Google sign-in, wallet login, embedded wallets |
| API / relay | Node.js, Express, Zod | overview API, deposit orchestration, Arc/GenLayer bridging |
| Arc integration | viem | contract reads, transaction submission, deposit verification |
| Payments | Stripe | optional card checkout flow |
| Arc contracts | Solidity, Hardhat | pooled reserves, fee splitting, claim registry, payout execution |
| GenLayer contract | Python intelligent contract, `genlayer-js` | consensus-backed AI verdict generation |
| Deployment | Vercel | static frontend + serverless API functions |

## Repository Layout

```text
.
|-- api/                        # Vercel serverless entrypoints
|-- contracts/
|   |-- arc/                    # Arc smart contracts, tests, deploy scripts
|   `-- genlayer/               # GenLayer intelligent contract and deploy script
|-- public/                     # static assets
|-- server/
|   `-- src/                    # Express relay and chain integrations
|-- shared/                     # shared ABIs and network constants
|-- src/
|   |-- boot/                   # app bootstrap and fallback boot logic
|   `-- lib/                    # app state, wallet, API, and network helpers
|-- vercel.json                 # Vercel build and routing config
`-- README.md
```

## Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- Arc Testnet and GenLayer StudioNet credentials if you want full live interaction

### Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix contracts/arc install
npm --prefix contracts/genlayer install
```

### Create your environment file

Copy `.env.example` to `.env` and fill in the values you need locally.

```bash
cp .env.example .env
```

Important:

- `.env` is intentionally ignored by Git
- never commit private keys, Privy secrets, or Stripe secrets

## Environment Variables

### Frontend and auth

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | for sign-in | Privy application ID |
| `VITE_PRIVY_CLIENT_ID` | recommended | Privy client ID |
| `VITE_WALLETCONNECT_PROJECT_ID` | for external wallets | WalletConnect project ID |
| `VITE_ARC_RPC_URL` | optional | Arc RPC override for the frontend |
| `VITE_ARC_USDC_ADDRESS` | yes | Arc Testnet USDC address |
| `VITE_ATLAS_POOL_ADDRESS` | yes | deployed `AtlasPool` contract |
| `VITE_ATLAS_CLAIMS_ADDRESS` | yes | deployed `AtlasClaims` contract |
| `VITE_TERMS_URL` | optional | terms URL shown in Privy |
| `VITE_PRIVACY_URL` | optional | privacy URL shown in Privy |

### Relay and app

| Variable | Required | Purpose |
| --- | --- | --- |
| `ATLAS_API_PORT` | local only | relay port, defaults to `8787` |
| `ATLAS_APP_URL` | yes | frontend origin used for redirects |
| `ATLAS_PROTOCOL_NAME` | optional | protocol name passed into the GenLayer contract |
| `PRIVY_APP_SECRET` | for authenticated Privy features | Privy backend secret |
| `PRIVY_VERIFICATION_KEY` | optional | JWT verification key |

### Arc settlement

| Variable | Required | Purpose |
| --- | --- | --- |
| `ARC_RPC_URL` | yes | Arc RPC used by the relay |
| `ARC_EXPLORER_URL` | optional | Arc explorer base URL |
| `ARC_USDC_ADDRESS` | yes | USDC token address on Arc Testnet |
| `ARC_DEPLOYER_PRIVATE_KEY` | deploys / fallback sponsor | Arc deployer key |
| `ARC_SPONSOR_PRIVATE_KEY` | for sponsored deposits | sponsor wallet key |
| `ATLAS_TREASURY_WALLET` | yes for deploy | treasury destination for protocol fees |
| `ATLAS_PLATFORM_FEE_BPS` | optional | basis-point fee split for treasury |
| `ATLAS_POOL_ADDRESS` | yes | deployed Arc pool contract |
| `ATLAS_CLAIMS_ADDRESS` | yes | deployed Arc claims contract |
| `ATLAS_GENLAYER_RELAYER` | optional | relayer address tracked in deployment flow |

### GenLayer

| Variable | Required | Purpose |
| --- | --- | --- |
| `GENLAYER_RPC_URL` | yes | StudioNet endpoint |
| `GENLAYER_EXPLORER_URL` | optional | StudioNet explorer base URL |
| `GENLAYER_PRIVATE_KEY` | for deploy / writes | account used to deploy or call the jury contract |
| `GENLAYER_ATLAS_JURY_ADDRESS` | recommended | deployed `AtlasJury` contract address |

### Stripe

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | optional | Stripe API secret |
| `STRIPE_WEBHOOK_SECRET` | optional | webhook signing secret |
| `STRIPE_PREMIUM_PRICE_ID` | optional | Stripe recurring price ID |

## Running Atlas Locally

### Full stack

```bash
npm run dev:full
```

This starts:

- the Vite frontend at `http://localhost:5173`
- the Atlas relay at `http://localhost:8787`

The Vite dev server proxies `/api/*` to the local relay, so Atlas uses the same relative API paths locally and on Vercel.

### Frontend only

```bash
npm run dev
```

### Relay only

```bash
npm run server:start
```

### Read-only fallback behavior

If `VITE_PRIVY_APP_ID` is missing, or Privy fails during boot, Atlas automatically falls back to a read-only mode. This allows the app to render safely without fake balances while still showing available live backend data.

## Smart Contract Workflows

### Arc contracts

Compile:

```bash
npm run contracts:arc:compile
```

Test:

```bash
npm run contracts:arc:test
```

Deploy to Arc Testnet:

```bash
npm --prefix contracts/arc run deploy:testnet
```

After deployment, copy the resulting `AtlasPool` and `AtlasClaims` addresses back into `.env`.

### GenLayer contract

Manual deploy to StudioNet:

```bash
npm --prefix contracts/genlayer run deploy:studionet
```

Current relay behavior:

- if `GENLAYER_ATLAS_JURY_ADDRESS` is set, the relay uses that existing contract
- if the address is empty but `GENLAYER_PRIVATE_KEY` is present, the relay can deploy `atlas_jury.py` automatically on first use

## Core API Surface

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | `GET` | health and RPC visibility check |
| `/api/config` | `GET` | frontend configuration for Arc and GenLayer |
| `/api/overview` | `GET` | live pool, coverage, and member overview |
| `/api/deposits/wallet` | `POST` | verify and register a wallet premium deposit |
| `/api/deposits/card` | `POST` | create a card deposit session |
| `/api/deposits/card/:depositId/confirm` | `POST` | confirm Stripe payment and sponsor Arc deposit |
| `/api/claims` | `POST` | file a claim and start verdict flow |
| `/api/claims/:claimId` | `GET` | fetch stored claim status |

## Deployment

Atlas is configured for Vercel as:

- a static Vite frontend built into `dist/`
- serverless API functions under `/api/*`

Relevant deployment behavior:

- `vercel.json` sets `buildCommand` to `npm run build`
- `installCommand` installs root and relay dependencies
- non-API routes are rewritten to `index.html`
- API functions are allowed up to `300` seconds

### Production checklist

1. Add the required frontend, Arc, GenLayer, Privy, and optional Stripe variables in Vercel.
2. Confirm `VITE_ATLAS_POOL_ADDRESS`, `VITE_ATLAS_CLAIMS_ADDRESS`, and `GENLAYER_ATLAS_JURY_ADDRESS` point to the intended deployed contracts.
3. Redeploy after any frontend, relay, or environment change.

Because Atlas uses relative `/api` requests, the same frontend build works locally and in production without hardcoding `localhost`.

## Verification

The current project has been verified with:

```bash
npm run lint
npm run build
npm run contracts:arc:compile
npm run contracts:arc:test
```

## Current Prototype Boundaries

Atlas is intentionally honest about what is live today and what is still prototype-grade:

- Arc integration is testnet-only
- GenLayer verdicts are finalized inside the intelligent contract, but the current contract does not perform external web retrieval
- card checkout depends on Stripe configuration and is otherwise treated as a test-mode flow
- local relay persistence uses a JSON store for development and is not durable serverless storage
- cross-chain coordination is relay-orchestrated, not yet a fully trust-minimized bridge
- when live data is missing, Atlas shows empty or read-only states instead of demo balances

## Project Thesis

Atlas is built around a simple split:

- Arc is the bank
- GenLayer is the courtroom

The user experience stays familiar, while the protocol logic becomes transparent, programmable, and auditable across both settlement and adjudication.
