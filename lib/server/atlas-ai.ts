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


export type AtlasAiDiscoveryInsight = {
  headline: string;
  summary: string;
  sharedThemes: Array<{
    theme: string;
    strength: "strong" | "moderate";
    explanation: string;
  }>;
  discussionPoints: Array<{
    theme: string;
    explanation: string;
  }>;
};

function aiDiscoveryPrompt(
  candidateName: string,
  viewer: RelationshipProfile,
  candidate: RelationshipProfile,
  result: CompatibilityResult,
) {
  const dimensions = result.dimensions
    .map((d) => `- ${d.label}: ${d.score}%`)
    .join("\n");

  return `
You are Atlas AI Discovery inside AutoFace.

A deterministic compatibility engine has ALREADY decided eligibility and calculated the official compatibility score. Your role is to find semantic themes in two members' explicitly opted-in relationship answers and explain them in a useful, neutral way.

NON-NEGOTIABLE RULES:
- Never calculate, alter, override or recommend a different compatibility score.
- Never decide whether the people should date, marry, reject or continue with each other.
- Never predict relationship success.
- Do not infer religion, ethnicity, caste, sexuality, health, disability, politics, finances or other sensitive traits.
- Do not judge attractiveness, worth, personality quality or moral character.
- Treat differences as neutral things to discuss, not warnings or flaws.
- Use only the supplied relationship answers and published deterministic dimension scores.
- Do not quote long passages from either member.
- Keep the output concise.

Return ONLY JSON matching this structure:
{
  "headline": "short sentence, max 12 words",
  "summary": "1-2 sentences, max 55 words",
  "sharedThemes": [
    {
      "theme": "short theme name",
      "strength": "strong|moderate",
      "explanation": "one concise sentence"
    }
  ],
  "discussionPoints": [
    {
      "theme": "short theme name",
      "explanation": "one concise, neutral sentence"
    }
  ]
}

Return 2-3 sharedThemes and 1-2 discussionPoints.

Published deterministic score: ${result.score}% (${result.level})
Candidate display name: ${candidateName}

Published deterministic dimensions:
${dimensions}

Viewer opted-in relationship answers:
- Ideal weekend: ${viewer.idealWeekend}
- What matters most: ${viewer.whatMattersMost}
- Non-negotiables: ${viewer.nonNegotiables}
- Relationship pace: ${viewer.relationshipPace}
- Family orientation: ${scale(viewer.familyOrientation)}
- Communication directness: ${scale(viewer.communicationDirectness)}
- Social energy: ${scale(viewer.socialEnergy)}
- Career priority: ${scale(viewer.careerPriority)}
- Routine vs adventure: ${scale(viewer.routineVsAdventure)}
- Shared interests importance: ${scale(viewer.sharedInterestsImportance)}
- Independence preference: ${scale(viewer.independencePreference)}

${candidateName}'s opted-in relationship answers:
- Ideal weekend: ${candidate.idealWeekend}
- What matters most: ${candidate.whatMattersMost}
- Non-negotiables: ${candidate.nonNegotiables}
- Relationship pace: ${candidate.relationshipPace}
- Family orientation: ${scale(candidate.familyOrientation)}
- Communication directness: ${scale(candidate.communicationDirectness)}
- Social energy: ${scale(candidate.socialEnergy)}
- Career priority: ${scale(candidate.careerPriority)}
- Routine vs adventure: ${scale(candidate.routineVsAdventure)}
- Shared interests importance: ${scale(candidate.sharedInterestsImportance)}
- Independence preference: ${scale(candidate.independencePreference)}
`.trim();
}

function sanitiseDiscoveryInsight(value: unknown): AtlasAiDiscoveryInsight {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const sharedRaw = Array.isArray(raw.sharedThemes) ? raw.sharedThemes : [];
  const discussRaw = Array.isArray(raw.discussionPoints) ? raw.discussionPoints : [];

  const sharedThemes = sharedRaw.slice(0, 3).map((item) => {
    const x = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      theme: String(x.theme ?? "Shared outlook").slice(0, 80),
      strength: x.strength === "moderate" ? "moderate" as const : "strong" as const,
      explanation: String(x.explanation ?? "").slice(0, 280),
    };
  }).filter((x) => x.explanation);

  const discussionPoints = discussRaw.slice(0, 2).map((item) => {
    const x = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      theme: String(x.theme ?? "Worth discussing").slice(0, 80),
      explanation: String(x.explanation ?? "").slice(0, 280),
    };
  }).filter((x) => x.explanation);

  if (sharedThemes.length === 0) throw new Error("ATLAS_AI_INVALID_RESPONSE");

  return {
    headline: String(raw.headline ?? "Atlas noticed some shared themes").slice(0, 120),
    summary: String(raw.summary ?? "Gemini found semantic themes in your opted-in relationship answers.").slice(0, 500),
    sharedThemes,
    discussionPoints,
  };
}

async function callGeminiJson(prompt: string) {
  if (!atlasAiEnabled()) throw new Error("ATLAS_AI_NOT_CONFIGURED");

  const apiKey = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL!;
  const base = (process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

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
          temperature: 0.15,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
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
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("ATLAS_AI_INVALID_JSON");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiDiscoveryInsight(
  candidateName: string,
  viewer: RelationshipProfile,
  candidate: RelationshipProfile,
  result: CompatibilityResult,
) {
  const raw = await callGeminiJson(aiDiscoveryPrompt(candidateName, viewer, candidate, result));
  return sanitiseDiscoveryInsight(raw);
}
