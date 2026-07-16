# 2026 Open Source Developer Contest Compliance Notes

This checklist records the intended submission boundary and known risks. It is not legal advice or an organizer pre-approval.

## Proposed entry

- Project name: **ShowMeLook MCP — an open fashion-commerce connector for AI agents**
- Repository: https://github.com/xrissohn/showmelook
- Core source: `src/lib/mcp`
- Generated Supabase function bundle: `supabase/functions/mcp`
- Source license: MIT
- AI model: none embedded; model-agnostic connector

## Rule alignment

- [x] Public GitHub repository.
- [x] OSI-approved license for directly authored source.
- [x] Dependency and license disclosure in `docs/SBOM.md`.
- [x] AI/model and AI-assistance disclosure in `docs/AI_MODEL_DISCLOSURE.md`.
- [x] Complete auditable MCP source and reproducible frontend build.
- [x] Read-only tool annotations and no model API call in the contest core.
- [ ] Enter the final application number, participant division, team size, and demo video URL.
- [ ] Confirm and disclose all prior government-funded awards or support for the same or substantially similar project.
- [ ] Confirm the submitted tag/commit and keep the public repository available for five years if selected or awarded.

## Important boundary

Commercial API-only recommendation and image-generation functions in the broader hosted application are optional demo components and are not the evaluated MCP core. The result report and demo video must consistently describe this boundary. If the organizer determines that the entire hosted service, rather than the MCP connector, is the entry, obtain a written eligibility interpretation or replace those routes with independently runnable open-weight models before submission.

## Submission package

1. Result report in DOCX/HWP and converted PDF.
2. Three-minute-or-shorter YouTube demo URL.
3. Public repository URL and immutable tag/commit SHA.
4. SBOM attachment and AI model/assistance disclosure.
