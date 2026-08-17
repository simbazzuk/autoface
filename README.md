# AutoFace v0.1

Security-first foundation for AutoFace.

## Included

- Public landing page
- How It Works page
- Trust & Privacy page
- Early-access form and development-only local capture endpoint
- Security Centre preview
- Firebase-ready configuration scaffold
- Security/privacy baseline documentation
- Zero-ID Storage design principle

## Deliberately not included in v0.1

- Matrimonial/relationship profiles
- Matching
- Atlas compatibility
- Messaging
- Passport/driving-licence upload
- Biometric storage
- Production identity verification

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The landing page works without Firebase environment variables. Firebase configuration is scaffolded for the next phase.

## Production build

```powershell
npm run build
npm start
```

## Important early-access note

The v0.1 early-access API writes to `.data/early-access.ndjson` only in development. It deliberately does not pretend to be a production datastore. Before public deployment, replace this endpoint with an approved persistent service and document its retention/deletion policy.

## Suggested next release — v0.2

- Firebase sign-up/sign-in
- Email verification
- Mobile verification
- MFA/passkey design
- Protected Security Centre
- Deterministic authenticity score service
- Security event model


## v0.3 identity-verification setup

Carry forward your existing client-side Firebase values into `.env.local`, then add the three `FIREBASE_ADMIN_*` values shown in `.env.example`. Keep `AUTOFACE_VERIFICATION_MODE=demo` for development.

The v0.3 simulator is not real identity verification. It exists to test the provider boundary, server-only verification writes, audit trail and Authenticity Centre scoring before a production identity provider is selected.

After changing Firestore rules, deploy `firestore.rules` to the AutoFace Firebase project so browsers cannot self-award identity or liveness verification.
