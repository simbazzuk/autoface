# AutoFace v0.7 — Discovery & Mutual Introductions

v0.7 turns the compatibility foundation into a controlled real-member discovery flow.

## What is new
- Server-side Discovery API; private Atlas relationship answers never become client-readable.
- Discovery eligibility: profile visibility `future_matches`, compatibility consent enabled, authenticity >= 50%.
- Safe profile projections honour age/location/occupation visibility toggles.
- Compatibility is calculated server-side for each eligible candidate.
- `Interested` and `Not for me` decisions are persisted by trusted server routes.
- A match is created only when both users independently express interest.
- Introductions page shows mutual matches; messaging remains intentionally locked for v0.8.
- No email address, mobile number, private Atlas free-text answers, document data or biometric data is exposed to another member.

## Test with two accounts
1. For both users, verify authenticity to >=50%.
2. Complete My Profile and choose `Future matches` visibility.
3. Complete Atlas Profile with compatibility consent enabled.
4. User A opens `/discover` and chooses Interested on User B.
5. User B opens `/discover` and chooses Interested on User A.
6. User B should receive the mutual message; both users should see the introduction at `/introductions`.
7. Confirm Firestore contains `interests` and `matches`, but private `relationshipProfiles` remain owner-only by rules.

## Setup
Carry forward `.env.local` and Firebase Admin variables from v0.6, then:

```powershell
npm install
npm run build
firebase deploy --only firestore:rules
npm run dev
```

## v0.7.1 — Demo/Test Harness

This release adds repeatable development-only accounts for testing real-member Discovery and Mutual Introductions.

```powershell
npm run seed:demo
```

The command creates/refreshed three clearly marked TEST PROFILE accounts (Priya, Maya and Alisha), each with 75% authenticity, a completed public-safe profile, an Atlas relationship profile, compatibility consent and Discovery enabled. Existing interests/matches involving the demo accounts are reset each time.

Default development login password: `AutoFaceDemo!731`. Override it in `.env.local` with `AUTOFACE_DEMO_PASSWORD` if preferred.

Clean the seeded accounts with:

```powershell
npm run seed:demo:clean
```

The seeder refuses production-looking Firebase projects and production runtime environments. See `docs/V0.7.1-DEMO-HARNESS.md`.

## v0.7.2 patch — signed-in user indicator

The header now replaces the generic Sign in / Create account actions when a Firebase user is authenticated. It displays the current profile first name, makes seeded `@autoface.test` users unmistakable with a TEST badge, and provides a dropdown containing email, current authenticity percentage, profile/security shortcuts and Sign out. This patch does not alter Firestore rules or the discovery/matching model.
