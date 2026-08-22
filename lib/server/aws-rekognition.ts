import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";

const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || "eu-west-1";

export const awsRekognitionConfigured = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  region,
);

export const awsRekognitionRegion = region;

function client() {
  if (!awsRekognitionConfigured) throw new Error("AWS_REKOGNITION_NOT_CONFIGURED");
  return new RekognitionClient({ region });
}

export async function createFaceLivenessSession() {
  const response = await client().send(new CreateFaceLivenessSessionCommand({
    Settings: { AuditImagesLimit: 0 },
  }));
  if (!response.SessionId) throw new Error("AWS_SESSION_NOT_CREATED");
  return response.SessionId;
}

export async function getFaceLivenessResult(sessionId: string) {
  return client().send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
}

export async function compareFaceImages(sourceBytes: Uint8Array, targetBytes: Uint8Array) {
  return client().send(new CompareFacesCommand({
    SourceImage: { Bytes: sourceBytes },
    TargetImage: { Bytes: targetBytes },
    SimilarityThreshold: 0,
    QualityFilter: "AUTO",
  }));
}
