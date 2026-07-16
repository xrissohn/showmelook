# Security Policy

## Supported versions

Security fixes target the latest commit on `main`. Tagged releases may receive a patch when practical.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability, exposed credential, authentication bypass, storage policy problem, or privacy leak.

Use GitHub's **Report a vulnerability** flow under the repository Security tab. If private vulnerability reporting is unavailable, contact the maintainer through the non-public contact method listed on the GitHub profile and include only enough information to establish a secure channel.

Include:

- affected path, function, or deployment surface;
- impact and required preconditions;
- minimal reproduction steps;
- whether personal data or credentials may be exposed;
- a suggested mitigation, if available.

You can expect acknowledgment within 7 days and a status update within 14 days. Timelines may vary with severity and reproducibility.

## Scope notes

ShowMeLook handles authentication, photos, profile attributes, affiliate redirects, and third-party integrations. Test only systems and data you own or are explicitly authorized to assess. Do not access, retain, or publish another person's data.

## Credential handling

- Browser-exposed values must be publishable or anonymous keys only.
- Service-role keys, AI gateway keys, email keys, and affiliate secrets are server-only.
- Rotate a secret immediately if it appears in a commit, log, issue, screenshot, or generated artifact.
