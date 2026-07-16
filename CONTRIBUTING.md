# Contributing to ShowMeLook

ShowMeLook welcomes bug reports, documentation improvements, tests, and focused code changes. Contributions are accepted under the MIT License.

## Before you start

- Search existing issues and pull requests.
- Use an issue for behavior changes or architecture proposals.
- Never include API keys, tokens, personal photos, customer data, or production database exports.
- Keep the contest-ready MCP connector model-agnostic and read-only unless a security review supports a broader scope.

## Local setup

```bash
git clone https://github.com/xrissohn/showmelook.git
cd showmelook
cp .env.example .env.local
npm ci
npm run dev
```

Use a separate Supabase project for development. Server-only secrets belong in the Supabase secret store, never in `VITE_*` variables.

## Development workflow

1. Create a short branch such as `fix/product-filter` or `docs/mcp-setup`.
2. Make one coherent change.
3. Add or update tests when behavior changes.
4. Run `npm run check`.
5. Open a pull request using the repository template.

The legacy application currently emits lint warnings that are tracked as technical debt. New or changed code should not add warnings.

## Commit and PR guidance

- Prefer imperative commit subjects: `Add MCP product filter validation`.
- Explain the user-visible outcome and verification performed.
- Call out database migrations, environment variables, privacy implications, and license changes.
- Include screenshots only when they contain no personal or production data.

## Dependency and model policy

- Prefer OSI-approved software licenses.
- Record new direct dependencies in `docs/SBOM.md`.
- Record any AI model, weight source, license, and execution path in `docs/AI_MODEL_DISCLOSURE.md`.
- Do not describe a closed API-only model as open source or open weight.

## Code of conduct and security

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
