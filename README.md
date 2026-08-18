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


## v0.15 — Beta Readiness & Onboarding Polish

Introduces a guided controlled-beta setup experience at `/get-started`.

- Dynamic readiness checklist based on the authenticated member's real profile, Atlas, authenticity, preferences and Discovery state.
- Clear next-step CTA and overall setup progress.
- Trust snapshot and active introduction count.
- In-product beta feedback capture to the server-owned `betaFeedback` collection.
- Updated homepage copy so it no longer describes matching and messaging as future capabilities.
- Adds `Getting Started` to desktop, account and mobile navigation.
- No recommendation, compatibility, safety or verification scoring logic is changed.


## v0.16 — Atlas Support Assistant

Adds an authenticated floating product-support assistant throughout AutoFace.

- Floating `Need help? / Ask Atlas Support` launcher on signed-in pages.
- Curated support knowledge for Getting Started, authenticity, Atlas compatibility, Discovery, introductions, messaging, privacy, reporting, blocking, export and deletion.
- Direct action links route users to the relevant AutoFace feature.
- Quick-start support questions make common help topics one tap away.
- Discovery/setup questions can inspect the authenticated member's setup metadata and identify which readiness checks remain.
- The support session is stateless: v0.16 does not create or persist a support-chat history collection.
- The assistant does not inspect private messages, calculate compatibility, recommend partners, or make moderation decisions.
- Gemini is not required for v0.16 support answers; approved AutoFace guidance is the source of truth.


## v0.17 — Beta Operations Dashboard

Adds an admin-only operational dashboard at `/admin/operations`.

- Registration and readiness summary.
- Onboarding funnel: registration → profile → Atlas → authenticity → Discovery readiness.
- Engagement counts for interested actions, mutual introductions, conversations and messages.
- Safety summary with direct link to the existing Safety Operations console.
- Recent-member readiness view without exposing private Atlas answers.
- Beta feedback summary and in-product triage states: new, reviewed, planned and closed.
- Feedback status changes create admin audit events.
- When real beta users exist, member-readiness metrics exclude `@autoface.test` demo profiles; otherwise demo data is clearly labelled.
- No private message content or private Atlas free-text responses are exposed in Beta Operations.


## v0.18 — Beta Launch Readiness

Focuses on controlled-beta launch rather than adding matching features.

- Optional invitation-only registration controlled by `AUTOFACE_BETA_INVITE_REQUIRED=true`.
- Admin-created, limited-use beta invitation codes in Beta Operations.
- Server-owned `betaInvites` and `betaAccess` records.
- Registration validates and claims invitation codes while preserving Firebase email verification.
- Explicit Beta Terms / Privacy Notice acknowledgement during registration.
- Plain-language `/terms` and `/privacy` pages for the beta baseline.
- Removes internal version-number artefacts from user-facing UI copy.
- Refreshes old prototype/early-access wording.
- Carries forward the tested SupportAssistant TypeScript null-narrowing fix from v0.17.
- No change to compatibility scoring, authenticity scoring, recommendations, messaging or safety decisions.


## v0.19 — Production & Beta Polish
- Password reset using Firebase Authentication.
- Dedicated email-verification status/resend journey.
- Sign-in routes unverified accounts to verification before setup.
- Friendlier authentication errors without exposing Firebase internals.
- Branded 404 and recoverable application error states.
- Persistent BETA product indicator.
- Privacy Notice and Beta Terms surfaced in Trust navigation/footer.
- Registration continues directly into email verification.
- Responsive polish for authentication and error states.
- Carries forward v0.18 controlled-beta invitation access and v0.17 SupportAssistant null-safety fix.


## v0.20 — The AutoFace Experience

A complete public landing-page repositioning focused on what makes AutoFace different.

- New proposition: introductions should be more than a first impression.
- Hero centres an example Atlas introduction with visible compatibility and authenticity.
- Reframes AutoFace around understanding, discovery and mutual introduction rather than a feature inventory.
- Clearly separates Atlas compatibility from authenticity evidence.
- Removes technical architecture detail from the homepage while retaining links to Trust and How It Works.
- Stronger controlled-beta CTA and waiting-list path.
- Premium consumer-focused responsive visual language using the existing AutoFace dark brand.
- Footer removes obsolete `v0.1 Foundation` wording.
- No changes to matching, authentication, verification, safety or beta-access logic.


## v0.20.1 — Hero Atlas Card Polish

Refines the v0.20 public landing-page hero visual.

- Removes the tilted recommendation-card treatment.
- Removes floating external Atlas/authenticity callouts.
- Makes the example recommendation card wider, shorter and visually calmer.
- Replaces the competing `88% authenticity` score with `Strong authenticity`.
- Reduces the example compatibility breakdown to three clear dimensions.
- Adds explicit percentages to each dimension.
- Strengthens the `Why Atlas recommended Maya` action.
- Adds a softer background aura so the card feels like a premium product object rather than a dashboard screenshot.


## v0.21 — Atlas AI Discovery

Adds a meaningful Gemini-powered semantic layer to real AutoFace recommendations without replacing the deterministic engine.

- Eligibility, hard Discovery preferences and the official compatibility percentage remain deterministic.
- New explicit `consentForAiDiscovery` permission on the private Atlas Relationship Profile.
- Atlas AI Discovery is available only when **both** members explicitly opt in.
- On a recommendation detail page, the viewer provides an additional per-request confirmation before Gemini is called.
- Gemini compares the two opted-in relationship profiles and returns structured JSON containing:
  - a concise semantic headline;
  - 2–3 shared themes;
  - strength labels;
  - neutral explanations;
  - 1–2 topics worth discussing.
- Gemini is instructed not to predict relationship success, infer sensitive traits, judge either member, or change the published compatibility score.
- AI Discovery results are session-only and are not persisted.
- Private messages, identity-verification evidence and authenticity data are not sent to Gemini for AI Discovery.
- Firestore rules explicitly allow the new boolean consent field and keep relationship profiles owner-only.


## v0.21.1 — Reviewed Recommendations & Demo Reset

Improves the Atlas AI Discovery testing flow and fixes a product-journey gap discovered during v0.21 testing.

- New `/recommendations/history` page lets members revisit people they already reviewed.
- Previous `Interested` and `Not for me` decisions no longer make the recommendation explanation effectively inaccessible.
- Recommendation history reuses the current deterministic Atlas projection and links back to full recommendation details, including Atlas AI Discovery where available.
- Discover includes a `Reviewed recommendations` action.
- Test/demo accounts get a `Reset demo recommendations` control when no new candidates remain.
- Demo reset deletes only the signed-in test profile's **non-mutual** outgoing review decisions.
- Existing mutual introductions are deliberately preserved rather than silently dismantled.
- Reset endpoint verifies the server-owned `demoProfiles.isTestProfile` marker, so production members cannot use the test reset function.
- No new Firestore client permissions are required.


## v0.21.2 — Atlas AI Discovery Teaser Patch

Makes the Gemini capability visible earlier in the recommendation journey without generating AI content automatically.

- Discover now checks AI Discovery availability for displayed candidates in one authenticated server request.
- When both members have opted in and Gemini is configured, the recommendation card shows an `Atlas AI Discovery available` teaser.
- The teaser links to recommendation details but does **not** call Gemini or claim an AI insight already exists.
- When the viewer opted in but the candidate did not, Discover explains that semantic comparison is unavailable rather than silently hiding the feature.
- Reviewed Recommendations also indicates which previous recommendations are eligible for Atlas AI Discovery.
- Recommendation details use stronger visual hierarchy and clearer separation between the official deterministic score and the optional Gemini semantic layer.
- No AI-generated insight is persisted and no Gemini call occurs until the member explicitly confirms it on recommendation details.


## v0.22 — Atlas Introduction Coach

Adds an optional Gemini-powered conversation-coaching layer after a mutual introduction.

- Introduction Coach appears inside an active mutual conversation.
- Requires the existing Atlas AI configuration and both members' explicit `consentForAiDiscovery` opt-in.
- The signed-in member provides an additional per-generation confirmation before Gemini is called.
- Gemini returns structured, editable conversation starters grounded in the two opted-in relationship profiles and published deterministic compatibility dimensions.
- Prompts prohibit sensitive-trait inference, private/contact-data requests, relationship-success predictions and prescriptive introductions decisions.
- `Use this question` copies a starter into the message composer; it never sends automatically.
- Generated starters are not persisted to Firestore.
- Existing messaging, moderation, blocking, reporting, matching and deterministic compatibility logic is unchanged.
- No new Firestore client permissions or schema deployment is required.


## v0.22.1 — Demo Mutual Introduction Harness

Adds a test-profile-only way to create a complete mutual introduction without knowing another demo member's login credentials.

- New server-restricted demo harness in Compatibility Lab.
- Lists eligible real Firestore demo/test profiles and their current deterministic compatibility score.
- `Create mutual introduction` writes both reciprocal Interested decisions, the mutual match, initial Connection state and Conversation shell.
- Optionally enables `consentForAiDiscovery` on the **synthetic target only**, allowing Atlas AI Discovery and Atlas Introduction Coach to be tested without the target login.
- The signed-in tester's own AI consent is never changed.
- Existing block records are respected; the harness refuses to bypass safety controls.
- Creates audit/security metadata and demo notifications.
- Normal production accounts receive `TEST_PROFILE_REQUIRED` and cannot access the harness.
- No new client-writeable Firestore permissions are introduced.


## v0.22.2 — Demo Block Recovery Patch

Improves the test-profile mutual-introduction harness after blocked demo pairs made the Coach journey difficult to test.

- Demo dropdown now labels each eligible synthetic profile as `READY`, `BLOCKED` or `MUTUAL`.
- Selected profile preview displays the pair state explicitly.
- Blocked demo pairs expose a clear `Clear demo block` action.
- Clearing a block is server-side restricted to test profiles on both sides.
- The patch deletes only the two directional block documents for the selected demo pair.
- A previously blocked match is moved to an unmatched test state; a new mutual introduction is **not** silently created.
- The tester must still explicitly click `Create mutual introduction` after clearing the block.
- Demo block clearing is written to `securityEvents`.
- Normal production users cannot access either the demo match harness or the clear-block action.


## v0.22.3 — Atlas Coach JSON Reliability Patch

Hardens the Gemini response path after `ATLAS_AI_INVALID_JSON` was observed in the Introduction Coach.

- Gemini JSON responses are now parsed through a tolerant but bounded parser.
- Accepts clean JSON, JSON wrapped in Markdown fences and a single balanced JSON object surrounded by accidental provider text.
- Safely removes trailing commas before one final parse attempt.
- If the first Gemini response is still invalid, AutoFace performs one controlled retry with a stricter JSON-only instruction.
- Gemini generation temperature is reduced and output headroom increased for more reliable structured output.
- Introduction Coach prompt explicitly forbids Markdown wrappers, commentary and trailing text.
- Fixes the v0.22.2 TypeScript `state` field declaration in the demo mutual-introduction API.
- The UI now turns raw JSON-format failures into a user-friendly retry message.
- No changes to compatibility scoring, AI consent, message sending, Firestore security rules or persistence boundaries.


## v0.22.4 — Gemini Timeout Reliability Patch

Improves Atlas Introduction Coach reliability when Gemini takes longer to respond.

- Extends the Gemini request timeout from 20 seconds to 45 seconds.
- Converts abort/timeout failures into the stable `ATLAS_AI_TIMEOUT` application error.
- The JSON-repair retry is not attempted after a timeout; retries remain limited to invalid JSON only.
- Slightly shortens the Introduction Coach prompt and reduces output token headroom to improve latency.
- Conversation UI shows a clear `Atlas is thinking…` wait state.
- Raw browser/server abort messages are replaced with `Atlas is taking longer than expected. Please try again.`
- No changes to matching, consent, Firestore permissions, persistence or message sending.


## v0.22.5 — Atlas Coach Structured Output Fix

Moves Atlas Introduction Coach from prompt-only JSON formatting to Gemini structured output.

- Sends `responseMimeType: application/json` plus `responseJsonSchema` in the Gemini `generateContent` request.
- The response schema requires exactly three conversation starters.
- Every starter must contain `theme`, `question` and `basis`.
- `basis` is constrained by schema to `shared_theme` or `discussion_point`.
- Unknown object fields are rejected by the response schema.
- Server validation now reports narrow development diagnostics such as `ATLAS_AI_INVALID_INTRO`, `ATLAS_AI_INVALID_STARTERS`, `ATLAS_AI_INVALID_BASIS`, and `ATLAS_AI_EMPTY_RESPONSE`.
- Diagnostics never include private relationship answers or raw Gemini response text.
- The 45-second timeout and bounded JSON repair from v0.22.4 remain in place.
- Atlas AI Discovery remains unchanged; structured output is applied specifically to Introduction Coach.
- No Firestore rules, collections, consent rules, matching logic or message-send behaviour change.


## v0.23 — Profile Experience

- Reframes the Profile page around member readiness rather than simple form completion.
- Adds Atlas Readiness, combining member-profile completeness with Atlas relationship-profile completeness.
- Readiness is explicitly separate from attractiveness, authenticity and compatibility scoring.
- Improves the existing profile preview into a clearer `Member View`, respecting age/location/occupation visibility choices.
- Clarifies that private Atlas relationship answers and AI analysis are not automatically exposed in the public-facing preview.
- Adds Facial Verification to the Authenticity Centre as a clearly disabled `COMING SOON` capability.
- Facial Verification is positioned as authenticity-only: it will never influence compatibility, ranking or Atlas recommendations.
- No biometric processing is introduced in v0.23.
- No new Firestore collections, rules or environment variables are required.


## v0.24 — Atlas Daily Discovery

Reframes Discovery around considered introductions instead of a swipe-style catalogue.

- Atlas now returns up to the top **3** currently eligible recommendations rather than a larger browseable queue.
- Ranking remains deterministic: compatibility first, then authenticity as a tie-breaker.
- Adds `Atlas Daily Discovery` language and a clear `quality over quantity` explanation.
- Each card is numbered as an Atlas pick and shows a concise `Why Atlas showed you ...` explanation.
- Recommendation details remain available for the full deterministic dimension breakdown and optional Atlas AI Discovery.
- No AI model is used to select or rank the daily picks.
- Reviewed Recommendations, demo reset, Interested / Not for me, and safety boundaries remain unchanged.
- No new Firestore rules, collections or environment variables are required.


## v0.25 — Thoughtful Decisions

Adds a lower-pressure decision path to Atlas Daily Discovery.

- Discovery now offers `Interested`, `Save for later`, and `Not for me`.
- `Save for later` is private and never notifies the other member.
- Saved profiles leave the active Daily Discovery queue so the next eligible recommendation can surface.
- Recommendation History becomes a considered-decisions area with All, Saved, Interested and Not for me filters.
- Non-mutual decisions can be reconsidered directly from history.
- Changing a saved recommendation to Interested uses the existing mutual-interest flow; no unsolicited messaging is introduced.
- Existing mutual introductions are protected from history decision controls.
- Uses the existing `interests` collection with a new `saved` status; no new Firestore collection or environment variable is required.


## v0.26 — Privacy & Control

Consolidates the member's most important privacy choices into Account & Privacy.

- Existing `Pause Discovery` remains the main control for temporarily leaving new recommendations without deleting the account.
- Adds direct visibility controls for age, general location and occupation.
- Clearly lists data never shown in Discovery: email, mobile number, private Atlas answers and verification documents.
- Adds in-app notification preferences for introductions, messages, connection updates and verification updates.
- Safety and account-protection notifications are deliberately non-optional.
- Server-side notification creation now honours notification preferences before creating routine notification records.
- Adds a server-owned `notificationPreferences/{uid}` document.
- Notification preferences are included in account data export and removed during account deletion.
- The navigation label is updated to `Privacy & Control`.
- No new environment variables are required.
- Updated Firestore rules explicitly keep notification preferences server-owned.


## v0.26.1 — Recommendation History JSX Fix

- Fixes the invalid nested JSX conditional introduced with the v0.25 Saved / history filters.
- Rewrites Recommendation History rendering into explicit, readable conditional blocks.
- Preserves All, Saved, Interested and Not for me filters.
- Preserves reconsidering non-mutual decisions directly from history.
- Preserves Atlas AI Discovery availability links and mutual-introduction protection.
- No Firestore, rules, schema or environment changes.


## v0.26.2 — Public Pricing Page

- Adds a public `/pricing` page accessible without authentication.
- Shows the proposed Free, AutoFace+ (£9.99/month) and Atlas Premium (£19.99/month) product structure.
- Clearly labels commercial pricing as indicative/planned while AutoFace remains in controlled beta.
- States that premium capabilities are currently unlocked for founding-member beta testing.
- Reinforces product principles: safety is never premium, mutual messaging is not a premium gate, and paid value focuses on deeper intelligence rather than boosts.
- Adds a Coming Soon facial-verification pricing note without committing to a provider or fixed price.
- Adds Pricing to the desktop Trust menu, mobile navigation and footer.
- No Firebase, Firestore, billing provider or environment changes are introduced.


## v0.27 — Production Hardening

This release intentionally adds little new product functionality. It hardens the MVP boundary before controlled external testing.

- Adds one bounded retry for temporary Gemini capacity/rate-limit/server failures and timeouts.
- Converts provider 429/5xx responses into `ATLAS_AI_TEMPORARILY_UNAVAILABLE`.
- Stops raw Gemini provider messages from being exposed to member-facing clients.
- Atlas APIs return a friendly degradation message while deterministic compatibility remains available.
- Existing deterministic Discovery, compatibility scoring and mutual-introduction flows remain independent of Gemini availability.
- Adds `/api/health` for non-secret deployment/configuration sanity checks.
- Adds baseline response security headers and removes the Next.js `X-Powered-By` header.
- Adds `MVP-PRODUCTION-CHECKLIST.md` covering security, privacy, two-user, blocking, Firebase, mobile and operational checks.
- No new Firebase collections, rules or environment variables are required.


## v0.28 — Profile Photo Experience

Adds production-oriented member profile-photo management without introducing biometric processing.

- Members can upload, replace and remove one primary profile photograph from My Profile.
- Accepts JPEG, PNG and WebP only, with a 5 MB server-enforced limit.
- File type is validated from image bytes rather than trusting the browser MIME declaration.
- Photo bytes are stored under a per-user Firebase Storage path and are never made public through a permanent download URL.
- Photos are streamed through an authenticated AutoFace API.
- The photo endpoint denies access after either member blocks the other.
- Other-member photo access is limited to an eligible recommendation or an existing mutual introduction.
- Profile photos now appear in Profile Preview, Atlas Daily Discovery and Recommendation Details with an initials fallback.
- Profile-photo metadata is server-owned in Firestore, included in account export, and deleted with the account.
- Stored profile-photo bytes are also deleted during account deletion.
- Facial verification remains separate and Coming Soon. v0.28 does not perform face matching, liveness, biometric templating or facial recognition.
- Requires Firebase Storage to be enabled for the project and the Firebase Admin service account to have bucket object permissions.
- Uses existing `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`; optionally set `FIREBASE_ADMIN_STORAGE_BUCKET` if the Admin bucket differs.


## v0.28.1 — Local Development Photo Storage

This patch removes Firebase Storage as a development-time dependency while preserving the v0.28 authenticated photo API.

- In `npm run dev`, profile-photo bytes default to private local storage under `.autoface-local/profile-photos/`.
- `.autoface-local/` is gitignored and must never be committed.
- Firestore continues to store only server-owned profile-photo metadata.
- The browser still retrieves photos only through the authenticated `/api/profile-photo/[uid]` route.
- Recommendation/mutual/block visibility checks are unchanged.
- Upload/replace/remove, 5 MB limit and JPEG/PNG/WebP byte-signature checks are unchanged.
- Production continues to use Firebase Storage; local filesystem storage is intentionally disabled when `NODE_ENV=production`.
- Set `AUTOFACE_LOCAL_PHOTO_STORAGE=false` in development only when you deliberately want to test Firebase Storage.
- `/api/health` reports `photoStorage: "local-dev"` during normal local development.
- Local photos are machine-local development data and are not suitable for Vercel, Cloud Run, multi-instance hosting, backups or real beta members.


## v0.28.2 — Profile Visual Refresh

- Redesigns My Profile to use the same stronger visual language as Atlas Daily Discovery.
- Adds a profile identity summary with photo, member details, relationship intent, profile completeness and Atlas readiness.
- Breaks the long edit form into three aligned colour-accented cards: About You, Relationship and Visibility.
- Removes old development-era `v0.5` language from the Profile experience.
- Completely refreshes the photo manager with a stronger photo stage, upload dropzone, photo-quality guidance, trust messaging and clearer remove action.
- Makes Member View feel more like an actual Discovery profile card.
- Adds stronger visual hierarchy to Atlas Readiness and privacy/minimisation content.
- No profile schema, Firestore rules, photo storage, matching or Atlas scoring changes.


## v0.28.3 — Landing Message Patch

- Sharpens the landing-page proposition around considered introductions rather than generic AI introductions.
- New hero: “Introductions shouldn’t feel like searching. It should feel like being introduced.”
- Positions Atlas as the reason behind recommendations: fewer people, with an explanation of why each may be worth getting to know.
- Strengthens the proof strip with no endless swiping, explainable compatibility, mutual introductions and private-by-design messaging.
- Refreshes the Why AutoFace, journey, principle and final beta CTA copy to reinforce the same proposition.
- No application logic, Firebase, matching, Atlas scoring, photo storage or environment changes.


## v0.29 — Atlas Introduction Intelligence
Recommendation details now lead with explainable foundations, deterministic Atlas Confidence, and a visible eligibility → compatibility → Atlas explanation → member decision flow.


## v0.29.1 — Discover Card Layout Patch
Atlas Daily Discovery now uses wider one/two-column recommendation cards with more room for profile, compatibility, Atlas explanation and decision controls. No recommendation logic changes.


## v0.29.2 — Discover CTA + Readability
Discover now uses a prominent full-width `View full recommendation` Atlas CTA and larger supporting card text for improved readability. No logic changes.


## v0.29.3 — Introduction Language Patch
User-facing brand copy moves away from `dating` terminology and positions AutoFace around considered introductions, compatibility and mutual interest.


## v0.30 — Sikh Community Direction
AutoFace launches a Sikh-community-first proposition, adds a global Sikh community network map and an optional self-described caste/community profile field. Caste is not inferred or automatically weighted by Atlas.


## v0.30.1 — Sikh Identity & Lifestyle Profile
Adds optional Sikh appearance, practice and diet fields alongside caste/community. All are self-described and are not automatically weighted by Atlas.


## v0.30.2 — Homepage Typography Consistency
Standardises the major homepage statement sections so the Atlas Principle and Controlled Beta areas use the same heading scale, line-height, alignment and spacing.


## v0.30.3 — Development Reset & Sikh Test Data
Adds local-only Development Tools for resetting a test user's AutoFace journey without deleting Firebase Auth, plus seeding/removing eight synthetic Sikh test profiles for Discovery and compatibility testing.


## v0.30.5 — Richer Profiles & Career Preferences
Adds structured profession/education profile data, richer Discover cards, and soft career/education preferences. Career preferences do not exclude candidates or alter the official compatibility score in this release.


## v0.30.6 — Engaging Discover Profile Traits
Discover cards now use a colourful About Me highlight and an icon-based At a Glance row for education, profession, Sikh appearance, diet and Sikh practice. No ranking or data-model changes.


## v0.30.7 — Lifestyle & Introduction Preferences
Adds visual hobbies plus height, location and shared-interest introduction preferences. Soft preferences only in this release.


## v0.30.7.1 — TypeScript Build Fix
Fixes strict typing in the Discovery Preferences API introduced in v0.30.7.


## v0.30.8 — Atlas Profile Intelligence
Recommendation details now include deterministic profile-alignment context for lifestyle, career/education, Sikh lifestyle, shared interests and location. The official compatibility score remains unchanged, and caste is not used in these indicators.


## v0.30.8.1 — Profile Permissions & Development Tools
Updates Firestore profile field validation and makes Development Tools available to authenticated local-development accounts without requiring an @autoface.test email.


## v0.30.8.2 — Firestore Profile Enum Fix
Synchronises Firestore profile validation with the current Sikh practice and education UI values.


## v0.30.8.3 — Profile Identity & Test Readiness
Adds private surname + optional preferred name and a Development Tools Discovery-readiness panel for testing seeded profiles.


## v0.30.8.4 — Neutral Homepage Demo Labels
Public landing-page examples now use neutral `Profile A/B/C` labels rather than realistic personal names.


## v0.30.8.5 — Homepage User Journey Flow
Adds a visual six-stage `Profile → Atlas → Discover → Interest → Mutual → Introduced` journey to explain how AutoFace works.


## v0.31.0 — My Introductions
Adds a member journey for Waiting, Saved and Mutual Introductions, with clear progression from Introduced through Connection progressing.


## v0.32.0 — Guided Onboarding & Readiness
Reworks Getting Started into `My Journey`, with six-step onboarding, setup progress, next-best-action guidance and clear Discovery readiness.


## v0.33.0 — Guided Profile-to-Discovery Journey
Connects Profile → Atlas → Introduction Preferences → Discover into one explicit guided flow, with completion CTAs and a readiness-aware Discover screen.


## v0.33.2 — My Journey Readability Polish
Increases text size and spacing across the My Journey roadmap, summary cards and supporting copy for easier reading.


## v0.33.3 — Discovery Resilience
Skips orphaned candidate Auth records and distinguishes a missing requester Authentication account from ordinary onboarding/readiness failures.


## v0.33.4 — My Introductions Readability Polish
Improves summary-card and tab readability on My Introductions without changing matching behaviour.


## v0.33.5 — Discovery Test Reset & Development Tools Readability
Adds a safe reviewed-profile reset for repeated Discovery testing and improves readability across Development Tools.


## v0.33.6 — Navigation Dropdown Fix
Fixes sticky My AutoFace and Trust desktop dropdown behaviour.


## v0.34.0 — Deterministic Test Environment
Adds a clean local factory-reset workflow and validated deterministic seed community so Discovery testing can start from a known state.


## v0.34.1 — Structured Atlas Relationship Choices
Replaces large written Atlas questions with selectable tiles plus one optional context field, while retaining backwards-compatible text values.


## v0.34.2 — Discover Readiness Readability
Improves readability of the Discover readiness checklist without changing eligibility or matching behaviour.


## v0.34.3 — Engaging Empty Discovery
Replaces the dead-end empty Discovery state with an active-profile message and a browser-only This or That activity while Atlas waits for a suitable introduction.
