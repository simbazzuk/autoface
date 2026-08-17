# AutoFace v0.27 — MVP Production Hardening Checklist

## Automated in this release
- Gemini 429/5xx and timeout failures are treated as temporary Atlas outages.
- Atlas retries one temporary provider failure after a short bounded delay.
- Raw Gemini/provider error messages are not returned to the browser.
- Atlas failures do not change deterministic compatibility or Discovery results.
- Client surfaces display a friendly temporary-unavailable message when provided.
- `/api/health` provides a non-secret deployment/configuration sanity check.
- Baseline browser security headers are applied globally.
- `X-Powered-By` is disabled.

## Manual checks before controlled beta
1. Run `npm run build` and resolve every type/build error.
2. Deploy Firestore rules and required indexes from the checked-in project.
3. Verify Firebase Authentication authorised domains and password-reset flow.
4. Verify a normal user cannot call admin/moderation APIs successfully.
5. Verify member-facing recommendation APIs never expose email, mobile, private Atlas answers or verification documents.
6. Complete a two-browser journey: register → profile → relationship profile → discovery → mutual interest → introduction → messaging → block/report.
7. Confirm blocking removes future discovery and prevents messaging.
8. Test account export, pause Discovery and permanent account deletion.
9. Test mobile widths for registration, Discovery, recommendation details, introduction and messaging.
10. Search production UI/code for demo-only paths and test accounts before opening beta.
11. Confirm privacy policy, beta terms and AI disclosures match actual processing.
12. Confirm monitoring/logging does not record relationship-profile answers or Gemini prompts/responses.

## Gemini failure test
Temporarily use an invalid/unavailable model in a non-production environment and confirm the UI shows a safe Atlas unavailable message while deterministic compatibility remains usable.
