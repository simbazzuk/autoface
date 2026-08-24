export type AuthenticitySignals = {
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  identityVerified: boolean;
  livenessVerified: boolean;
  photoVerified: boolean;
};

export const authenticityWeights: Record<keyof AuthenticitySignals, number> = {
  // v0.35.9.2: only verification capabilities that genuinely operate in the
  // current product contribute to the user-facing authenticity score.
  emailVerified: 20,
  phoneVerified: 25,
  mfaEnabled: 0,
  identityVerified: 0,
  livenessVerified: 0,
  // Face Verification combines AWS Face Liveness with the one-to-one
  // comparison against the user's current profile photo.
  photoVerified: 55,
};

export function calculateAuthenticity(signals: AuthenticitySignals) {
  const score = (Object.keys(authenticityWeights) as (keyof AuthenticitySignals)[])
    .reduce((sum, key) => sum + (signals[key] ? authenticityWeights[key] : 0), 0);

  const level = score >= 80
    ? "HIGHLY VERIFIED"
    : score >= 50
      ? "VERIFIED"
      : score >= 25
        ? "CONFIRMED"
        : score > 0
          ? "BASIC"
          : "NOT YET ESTABLISHED";

  const activeKeys = (Object.keys(authenticityWeights) as (keyof AuthenticitySignals)[])
    .filter((key) => authenticityWeights[key] > 0);

  const completed = activeKeys.filter((key) => signals[key]).length;

  return { score, level, completed, total: activeKeys.length, weights: authenticityWeights };
}
