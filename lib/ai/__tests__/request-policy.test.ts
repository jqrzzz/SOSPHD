import { describe, expect, it } from "vitest";
import {
  AI_EVIDENCE_MAX_BYTES,
  AI_REQUEST_MAX_BYTES,
  AIEvidenceTooLargeError,
  AIMalformedRequestError,
  AIRequestBodyTooLargeError,
  assertWithinAIEvidenceLimit,
  maxOutputTokensFor,
  readAIRequestJson,
  utf8ByteLength,
} from "../request-policy";

const JSON_PREFIX = '{"value":"';
const JSON_SUFFIX = '"}';
const FRAMING_BYTES = utf8ByteLength(JSON_PREFIX + JSON_SUFFIX);

function asciiJsonWithByteLength(bytes: number): string {
  return JSON_PREFIX + "a".repeat(bytes - FRAMING_BYTES) + JSON_SUFFIX;
}

function request(body: string, headers?: HeadersInit): Request {
  return new Request("https://example.test/api", {
    method: "POST",
    headers,
    body,
  });
}

describe("readAIRequestJson", () => {
  it("accepts valid JSON at exactly 32 KiB", async () => {
    const body = asciiJsonWithByteLength(AI_REQUEST_MAX_BYTES);
    expect(utf8ByteLength(body)).toBe(AI_REQUEST_MAX_BYTES);

    await expect(readAIRequestJson(request(body))).resolves.toEqual({
      value: "a".repeat(AI_REQUEST_MAX_BYTES - FRAMING_BYTES),
    });
  });

  it("rejects an actual body one byte over the cap", async () => {
    const body = asciiJsonWithByteLength(AI_REQUEST_MAX_BYTES + 1);

    await expect(readAIRequestJson(request(body))).rejects.toBeInstanceOf(
      AIRequestBodyTooLargeError,
    );
  });

  it("measures multibyte UTF-8 bytes rather than JavaScript characters", async () => {
    const exactCount = (AI_REQUEST_MAX_BYTES - FRAMING_BYTES) / 2;
    const exact = JSON_PREFIX + "é".repeat(exactCount) + JSON_SUFFIX;
    const oversized = JSON_PREFIX + "é".repeat(exactCount + 1) + JSON_SUFFIX;
    expect(utf8ByteLength(exact)).toBe(AI_REQUEST_MAX_BYTES);
    expect(utf8ByteLength(oversized)).toBe(AI_REQUEST_MAX_BYTES + 2);

    await expect(readAIRequestJson(request(exact))).resolves.toBeTruthy();
    await expect(
      readAIRequestJson(request(oversized)),
    ).rejects.toBeInstanceOf(AIRequestBodyTooLargeError);
  });

  it("does not trust a falsely small Content-Length header", async () => {
    const body = asciiJsonWithByteLength(AI_REQUEST_MAX_BYTES + 1);

    await expect(
      readAIRequestJson(request(body, { "Content-Length": "2" })),
    ).rejects.toBeInstanceOf(AIRequestBodyTooLargeError);
  });

  it("rejects an oversized declared Content-Length before reading", async () => {
    await expect(
      readAIRequestJson(
        request("{}", {
          "Content-Length": String(AI_REQUEST_MAX_BYTES + 1),
        }),
      ),
    ).rejects.toBeInstanceOf(AIRequestBodyTooLargeError);
  });

  it("classifies malformed JSON at the byte cap as 400, not 413", async () => {
    const malformed = " ".repeat(AI_REQUEST_MAX_BYTES - 1) + "{";
    expect(utf8ByteLength(malformed)).toBe(AI_REQUEST_MAX_BYTES);

    await expect(
      readAIRequestJson(request(malformed)),
    ).rejects.toBeInstanceOf(AIMalformedRequestError);
  });
});

describe("AI evidence and output policy", () => {
  it("accepts exactly 64 KiB of evidence and rejects one byte more", () => {
    expect(() =>
      assertWithinAIEvidenceLimit("a".repeat(AI_EVIDENCE_MAX_BYTES)),
    ).not.toThrow();
    expect(() =>
      assertWithinAIEvidenceLimit("a".repeat(AI_EVIDENCE_MAX_BYTES + 1)),
    ).toThrow(AIEvidenceTooLargeError);
  });

  it("defines an explicit output ceiling for every AI surface", () => {
    expect(maxOutputTokensFor("recommendations")).toBe(1_536);
    expect(maxOutputTokensFor("advisor")).toBe(2_048);
    expect(maxOutputTokensFor("doc_assistant")).toBe(4_096);
    expect(maxOutputTokensFor("paper_builder")).toBe(6_144);
    expect(maxOutputTokensFor("categorize")).toBe(512);
  });
});
