# AutoFace v0.8 — Safe Messaging

AutoFace v0.8 adds server-enforced messaging for mutual introductions only.

## New in v0.8
- Messaging unlocks only for a `matches/{matchId}` record with `status: mutual`.
- Messages are read/written through authenticated Next.js API routes, never direct browser Firestore access.
- Block and unmatch immediately close the match and conversation.
- Report creates a server-owned moderation record without exposing it to the reported member.
- Email, mobile number, private Atlas answers and identity-provider references are never returned in chat payloads.
- 1,000-character message limit and last-100 message window for the MVP.
- Demo/test profiles continue to be clearly marked.

## Setup
Carry forward your `.env.local`, then run:

```powershell
npm install
npm run build
firebase deploy --only firestore:rules
npm run dev
```

Use `npm run seed:demo` if you need fresh Priya/Maya/Alisha test accounts. Create a mutual introduction first, then open **Introductions → Open safe conversation**.

## Safety model
Identity verification raises identity assurance; it does not guarantee a member's intentions or behaviour. Keep early conversations on-platform, and use block/report/unmatch whenever needed.


## v0.8.1
Messaging UX patch: sender labels, left/right alignment, initials, timestamps, date dividers, and automatic scroll-to-latest behavior.


## v0.9 — Photo Verification Foundation

Adds a provider-neutral profile-photo verification boundary and development simulator.

- Requires identity + liveness before photo verification.
- Successful photo verification adds the existing +15 `photoVerified` authenticity signal.
- AutoFace stores only status, provider reference, assurance metadata and timestamp.
- No raw selfie, biometric template, similarity vector, liveness video or identity-document image is requested by the demo flow.
- `photoVerificationSessions` and trusted `identity.photoVerified` writes are server-owned.
- Production use requires a specialist provider, privacy/biometric review and DPIA before enabling real facial comparison.


## v0.9.1 — Navigation & App Shell Polish
Simplifies desktop navigation into Discover, Introductions, My AutoFace and Trust; adds grouped dropdowns and a responsive mobile navigation drawer while retaining the signed-in user indicator.


## v0.9.2 — Atlas AI Insights

Adds an optional Gemini explanation layer without changing AutoFace's deterministic scoring model.

- Core Atlas profile and compatibility scores still work with AI disabled.
- Gemini runs server-side only; the API key is never exposed to the browser.
- Users must explicitly opt in before Atlas relationship answers are sent for an AI explanation.
- The server loads the user's saved relationship profile itself rather than accepting arbitrary profile data from the browser.
- Gemini cannot change authenticity or compatibility scores.
- AI reflections are not persisted in Firestore in v0.9.2.
- Set `ATLAS_AI_ENABLED=true`, `GEMINI_API_KEY`, and `GEMINI_MODEL` to enable the feature.


## v0.9.2.1 — Atlas AI UI Patch
Polishes the optional AI consent layout, checkbox alignment, spacing, button sizing, and shortens consent copy for narrow side panels.


## v0.10 — Connection Journey & Safety
Adds a private connection overview for every mutual introduction: explainable Atlas alignment, neutral conversation points, deterministic conversation starters, user-controlled relationship stages, and direct access to existing server-enforced block/report/unmatch controls. Connection stages are stored server-side per participant and are not compatibility or authenticity scoring inputs.


## v0.10.1 — Visual Refresh
Adds a warmer relationship-focused palette while retaining AutoFace's dark premium base. Introduces coral relationship actions, emerald trust states, warmer introduction avatars, a stronger Connection hero, clearer authenticity/compatibility colour separation, and refined message bubble treatments. No backend or data-model changes.
