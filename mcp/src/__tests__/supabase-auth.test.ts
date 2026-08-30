import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertResearchAllowlisted } from "../supabase.js";

function clientWithResult(data: boolean, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const schema = vi.fn().mockReturnValue({ rpc });
  const client = { schema } as unknown as SupabaseClient;
  return { client, schema, rpc };
}

describe("assertResearchAllowlisted", () => {
  it("accepts only an explicitly allowed signed-in session", async () => {
    const { client, schema, rpc } = clientWithResult(true);

    await expect(assertResearchAllowlisted(client)).resolves.toBeUndefined();
    expect(schema).toHaveBeenCalledWith("research");
    expect(rpc).toHaveBeenCalledWith("is_allowed_user");
  });

  it("rejects a signed-in user outside the research allowlist", async () => {
    const { client } = clientWithResult(false);

    await expect(assertResearchAllowlisted(client)).rejects.toThrow(
      "SOSPHD MCP: research access denied",
    );
  });

  it("fails closed when the allowlist lookup errors", async () => {
    const { client } = clientWithResult(
      false,
      new Error("database unavailable"),
    );

    await expect(assertResearchAllowlisted(client)).rejects.toThrow(
      "SOSPHD MCP: research access denied",
    );
  });
});
