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
