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


## v0.11 — Notifications & Activity Centre
Adds server-owned in-app notifications for mutual introductions, new messages, connection-stage activity and photo verification. Includes unread counts in the header, an Activity Centre, mark-read/mark-all-read actions, and direct action links. Message bodies are deliberately not copied into notification records.


## v0.11.1 — Notification Query Patch
Removes Firestore composite-index requirements from notification listing and mark-all-read. Queries now filter only by recipientUid, then sort/filter server-side for the small in-app notification set.


## v0.12 — Smarter Discovery & Recommendation Engine
Adds server-owned discovery preferences, preference-first eligibility filtering, deterministic Atlas ranking, structured recommendation reason codes and a recommendation-details page. Preferences currently support age range, broad same-area/UK location choice, relationship intentions and relocation openness. Precise location is not collected and Gemini does not determine eligibility or ranking. Also carries forward the v0.11.1 NotificationBell TypeScript null-narrowing fix.


## v0.12.1 — Build Patch
Fixes the missing closing brace in `lib/server/discovery.ts` at the end of `recommendationFor()`. No recommendation logic, data model, or Firestore rule changes.


## v0.12.2 — TypeScript Recommendation Patch
Replaces the untyped recommendation candidate with a typed `RelationshipIntent` so `relationshipIntentLabels[c.relationshipIntent]` passes strict TypeScript checks. No recommendation or Firestore logic changes.


## v0.12.3 — Recommendation UI Polish
Improves the recommendation-details hierarchy with friendlier Atlas copy, a clearer compatibility label, user-facing compatibility breakdown language, dimension alignment badges, larger explanatory text, and a clearer discovery-preference eligibility audit. No recommendation algorithm or Firestore changes.


## v0.13 — Account, Privacy & Data Controls

Adds an authenticated Account & Privacy area.

- Pause/resume Discovery without deleting the account.
- Privacy and verification status snapshot.
- Download a JSON export of AutoFace-held account data, including profiles, preferences, verification outcome metadata, notifications, interests, matches, conversations and security events.
- Provider-held identity documents or biometric payloads remain outside AutoFace and are therefore not included in the export.
- Permanent account deletion requires typing `DELETE MY AUTOFACE ACCOUNT`.
- Deletion is performed server-side and removes known AutoFace account, profile, Atlas, recommendation, conversation, notification and verification-session data before removing the Firebase Authentication user.


## v0.14 — Admin, Moderation & Safety Operations

Adds a restricted operator safety console at `/admin`.

- Server-side access is controlled by the comma-separated `AUTOFACE_ADMIN_EMAILS` environment variable.
- Review user-submitted reports and supplied report details.
- See report, block and safety-event summary counts.
- Resolve reports with a mandatory human resolution note.
- Suspend reported Firebase Authentication accounts; suspension also sets the profile to private.
- Reinstate accounts through the operator console.
- Every resolve/suspend/reinstate action creates a server-owned `adminAuditEvents` record.
- Account moderation state is written to the server-owned `accountModeration` collection.
- Routine admin APIs deliberately do **not** return private conversation message bodies.
- No Gemini/LLM automated moderation decisions are introduced in v0.14.


## v0.14.1 — Member Reporting & Blocking

Completes the member-to-operator safety workflow.

- Clear `Report member`, `Block member`, and `End introduction` controls in conversations.
- Reporting captures a structured reason plus optional member-supplied details.
- Users can choose `Submit report & block` in one action.
- Report-and-block immediately closes the conversation and writes the block server-side.
- Standalone blocking now also records a server-owned security event.
- Reports flow into the v0.14 Safety Operations queue.
- Report submission does not automatically include private message history.
- Human moderation remains responsible for report resolution and account suspension decisions.
