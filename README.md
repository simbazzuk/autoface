# AutoFace v0.6 — Explainable Compatibility Engine

v0.6 builds on the security-first AutoFace foundation and adds the first deterministic compatibility comparison experience.

## What is new
- Compatibility Lab at `/compatibility`
- Weighted, explainable comparison across 9 structured relationship dimensions
- Strongest-alignment and conversation-point explanations
- Synthetic demonstration profiles only — no real member discovery
- Compatibility consent is required before the lab will run
- Results are calculated in memory and are not persisted

## Existing foundations retained
- Firebase email and phone authentication
- Authenticity Centre and server-controlled identity/liveness verification evidence
- Zero-ID Storage principle
- Private base profile
- Private Atlas Relationship Profile

## Setup
Copy the working `.env.local` from your previous AutoFace version, then:

```powershell
npm install
npm run build
firebase deploy --only firestore:rules
npm run dev
```

The Firestore rules are unchanged functionally from v0.5 because v0.6 does not expose any other user's profile data and does not add a compatibility-results collection.

## Test
1. Sign in with an existing account.
2. Confirm your Atlas Relationship Profile is saved with compatibility consent enabled.
3. Open `/compatibility`.
4. Switch between the three clearly labelled synthetic profiles.
5. Confirm the overall score, dimension scores, strongest alignments and conversation points change deterministically.
6. Refresh and confirm your underlying relationship profile is unchanged.
7. Confirm no compatibility result document is created in Firestore.
