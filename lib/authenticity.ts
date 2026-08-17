export type AuthenticitySignals = {
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  identityVerified: boolean;
  livenessVerified: boolean;
  photoVerified: boolean;
};

export const authenticityWeights: Record<keyof AuthenticitySignals, number> = {
  emailVerified: 10,
  phoneVerified: 15,
  mfaEnabled: 10,
  identityVerified: 30,
  livenessVerified: 20,
  photoVerified: 15,
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

  const completed = (Object.keys(authenticityWeights) as (keyof AuthenticitySignals)[])
    .filter((key) => signals[key]).length;

  return { score, level, completed, total: Object.keys(authenticityWeights).length, weights: authenticityWeights };
}
