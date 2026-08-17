# AutoFace v0.1 Security & Privacy Foundation

## Core principles

1. Security before matchmaking.
2. Data minimisation by default.
3. Separate account identity from future relationship-profile data.
4. Do not create passport, driving-licence, raw biometric or liveness storage in AutoFace.
5. Future identity verification should be delegated to a specialist provider and AutoFace should retain only the minimum verification result/reference required.
6. Authenticity is evidence-based and deterministic; it is not an AI judgement of whether someone is safe.

## Planned verification state

```ts
export type VerificationState = {
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  identityVerified: boolean;
  livenessVerified: boolean;
  photoVerified: boolean;
  providerReference?: string;
  verifiedAt?: string;
};
```

## Intended retained identity-assurance data

- Firebase user ID
- Email verification state
- Phone verification state
- MFA/passkey state
- Verification provider reference
- Verification outcome/level
- Verification timestamps
- Security/audit events

## Explicitly excluded from the AutoFace application datastore

- Passport image
- Passport number
- Driving-licence image
- Driving-licence number
- Raw selfie/liveness capture
- Biometric template

## Evidence model

Compliance evidence should include:

- Data inventory / ROPA
- Architecture and data-flow diagram
- Database schema showing excluded ID-document fields
- Storage policy showing no ID-document bucket
- Verification-provider processor agreement
- DPIA before biometric recognition is enabled
- Retention/deletion policy
- Privacy notice
- Security event/audit logging design

This document is an engineering design baseline, not legal advice. Review the final production implementation and vendor contracts with an appropriate UK privacy professional before launch.
