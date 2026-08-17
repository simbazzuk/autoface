import type { RelationshipProfile } from "@/lib/relationship-profile";
import type { CompatibilityResult } from "@/lib/compatibility";

export function atlasAiEnabled() {
  return process.env.ATLAS_AI_ENABLED === "true"
    && Boolean(process.env.GEMINI_API_KEY)
    && Boolean(process.env.GEMINI_MODEL);
}

function scale(value: number) {
  return ["", "Low", "Somewhat low", "Balanced", "Important", "Very important"][value] ?? "Balanced";
}

function relationshipProfilePrompt(profile: RelationshipProfile) {
  return `
You are Atlas, an optional explanation assistant inside AutoFace, a relationship-introduction product.

Your role is to reflect the user's own stated preferences. Do not judge attractiveness, worth, personality quality, mental health, identity, or likelihood of relationship success. Do not tell the user who they should marry or reject. Do not infer religion, ethnicity, caste, sexuality, health, politics, or other sensitive traits.

Write a warm, concise reflection of no more than 160 words using only the supplied answers.
Structure:
1. A short paragraph describing the user's stated relationship style.
2. "Likely strengths:" followed by 2-3 short phrases.
3. "Worth exploring:" followed by 1-2 neutral conversation themes.

Structured answers:
- Family orientation: ${scale(profile.familyOrientation)}
- Communication directness: ${scale(profile.communicationDirectness)}
- Social energy: ${scale(profile.socialEnergy)}
- Career priority: ${scale(profile.careerPriority)}
- Routine vs adventure: ${scale(profile.routineVsAdventure)}
- Relocation flexibility: ${scale(profile.relocationFlexibility)}
- Shared interests importance: ${scale(profile.sharedInterestsImportance)}
- Independence preference: ${scale(profile.independencePreference)}
- Relationship pace: ${profile.relationshipPace}

User-written answers:
- Ideal weekend: ${profile.idealWeekend}
- What matters most: ${profile.whatMattersMost}
- Non-negotiables: ${profile.nonNegotiables}
`.trim();
}

function compatibilityPrompt(
  candidateName: string,
  result: CompatibilityResult,
) {
  const dimensions = result.dimensions
    .map((d) => `- ${d.label}: ${d.score}% (You: ${d.userValue}; ${candidateName}: ${d.candidateValue})`)
    .join("\n");

  return `
You are Atlas, an optional explanation assistant inside AutoFace.

A deterministic compatibility engine has already calculated the scores below. You MUST NOT alter, recalculate, overrule, or invent a compatibility score. Your job is only to explain the published result in plain language.

Do not predict relationship success. Do not describe either person as a good/bad match. Do not infer sensitive traits. Differences must be framed as neutral conversation points, never rejection criteria.

Write no more than 140 words.
Start with one short paragraph explaining the strongest alignment.
Then include:
"Good alignment:" with 2-3 short phrases.
"Worth discussing:" with up to 2 short phrases.

Published overall score: ${result.score}% (${result.level})
Candidate display name: ${candidateName}

Published dimensions:
${dimensions}
`.trim();
}

async function callGemini(prompt: string) {
  if (!atlasAiEnabled()) throw new Error("ATLAS_AI_NOT_CONFIGURED");

  const apiKey = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL!;
  const base = (process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 300,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = body?.error?.message;
      throw new Error(providerMessage ? `ATLAS_AI_PROVIDER_ERROR: ${providerMessage}` : `ATLAS_AI_PROVIDER_ERROR_${response.status}`);
    }

    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!text) throw new Error("ATLAS_AI_EMPTY_RESPONSE");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateProfileReflection(profile: RelationshipProfile) {
  return callGemini(relationshipProfilePrompt(profile));
}

export async function generateCompatibilityReflection(candidateName: string, result: CompatibilityResult) {
  return callGemini(compatibilityPrompt(candidateName, result));
}
