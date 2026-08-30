import type { AISurface } from "./config";

export const AI_REQUEST_MAX_BYTES = 32 * 1024;
export const AI_CUSTOM_INSTRUCTIONS_MAX_CHARS = 4_000;
export const AI_MAX_ILLUSTRATIVE_ROWS = 20;
export const AI_EVIDENCE_MAX_BYTES = 64 * 1024;

const MAX_OUTPUT_TOKENS: Record<AISurface, number> = {
  recommendations: 1_536,
  advisor: 2_048,
  doc_assistant: 4_096,
  paper_builder: 6_144,
  categorize: 512,
};

export class AIRequestBodyTooLargeError extends Error {
  status = 413;

  constructor() {
    super(`AI request body exceeds ${AI_REQUEST_MAX_BYTES} bytes`);
    this.name = "AIRequestBodyTooLargeError";
  }
}

export class AIMalformedRequestError extends Error {
  status = 400;

  constructor() {
    super("Malformed JSON in request body");
    this.name = "AIMalformedRequestError";
  }
}

export class AIEvidenceTooLargeError extends Error {
  status = 413;

  constructor() {
    super(`AI evidence context exceeds ${AI_EVIDENCE_MAX_BYTES} bytes`);
    this.name = "AIEvidenceTooLargeError";
  }
}

export function maxOutputTokensFor(surface: AISurface): number {
  return MAX_OUTPUT_TOKENS[surface];
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertWithinAIEvidenceLimit(value: string): void {
  if (utf8ByteLength(value) > AI_EVIDENCE_MAX_BYTES) {
    throw new AIEvidenceTooLargeError();
  }
}

/**
 * Read and parse JSON while enforcing the actual streamed byte count. The
 * Content-Length check is only an early rejection; chunked or dishonest
 * requests are still bounded while being read.
 */
export async function readAIRequestJson(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > AI_REQUEST_MAX_BYTES) {
      throw new AIRequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    throw new AIMalformedRequestError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > AI_REQUEST_MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the deterministic 413 even if stream cancellation fails.
        }
        throw new AIRequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new AIMalformedRequestError();
  }
}

export function requestPolicyErrorResponse(error: unknown): Response | null {
  if (
    error instanceof AIRequestBodyTooLargeError ||
    error instanceof AIMalformedRequestError ||
    error instanceof AIEvidenceTooLargeError
  ) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
