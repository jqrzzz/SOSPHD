import { describe, it, expect } from "vitest";
import { deriveCorridor } from "../corridor";

describe("deriveCorridor", () => {
  it("maps Krabi-area geography including Phi Phi and Ao Nang", () => {
    expect(deriveCorridor(["Krabi", "Ao Nang"])).toBe("Krabi → Bangkok");
    expect(deriveCorridor([null, "Phi Phi Island"])).toBe("Krabi → Bangkok");
  });
  it("maps Pai / Mae Hong Son to the Chiang Mai corridor", () => {
    expect(deriveCorridor(["Mae Hong Son", "Pai"])).toBe("Chiang Mai → Bangkok");
  });
  it("maps Samui-archipelago keywords", () => {
    expect(deriveCorridor(["Surat Thani", "Koh Phangan"])).toBe("Koh Samui → Bangkok");
  });
  it("returns null for Indonesia even when other keywords are present", () => {
    expect(deriveCorridor(["Lombok", "Krabi Street Clinic"])).toBeNull();
    expect(deriveCorridor(["Gili Trawangan"])).toBeNull();
  });
  it("returns null for unknown geography and empty input", () => {
    expect(deriveCorridor(["Somewhere"])).toBeNull();
    expect(deriveCorridor([])).toBeNull();
  });
});
