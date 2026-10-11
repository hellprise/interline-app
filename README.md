# interline-app

TypeScript monorepo for the Interline flight aggregator (web client and core services).

## Prerequisites
- **Node.js**: `v26.x` (pinned via `.nvmrc` and `engines.node`)
- **pnpm**: `v12.x` (pinned via `packageManager` and `devEngines`)

## Setup
### 1. **Install Node 26**:
Using `nvm`:
```bash
nvm install 26
nvm use
```

### 2. Install pnpm 12:
Node 25+ does not include Corepack, so pnpm is installed via standalone script:
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 3. Install dependencies:
```bash
pnpm install
```

## Development
Run type checking across all workscpace packages:
```bash
pnpm typecheck
```

## Packages
- `@interline/contracts`: Shared domain types and flight key formatting.
- `@interline/schedule-import`: Flight schedule parser and validation helpers.
