# Releasing ShowMeLook

Releases are performed manually by a maintainer after checks pass.

1. Update `CHANGELOG.md` and confirm version metadata in `package.json` and `src/lib/mcp/index.ts`.
2. Run `npm ci` and `npm run check` on Node.js 22.
3. Confirm new dependencies and AI models are documented in `docs/SBOM.md` and `docs/AI_MODEL_DISCLOSURE.md`.
4. Review migrations, secrets, personal data, generated files, and license compatibility.
5. Merge the release pull request.
6. Create an annotated tag such as `v0.1.0` and publish GitHub release notes from the changelog.
7. For a contest snapshot, record the exact tag and commit SHA in the submitted result report.

Do not publish a release from an unreviewed automation token. Never attach production credentials, database exports, or user photos.
