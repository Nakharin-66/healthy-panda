import { describe, expect, it } from "vitest";
import { miniappDestination, validAppPath } from "./miniapp";

describe("LINE MINI App deep links", () => {
  it.each(["/scan", "/coach", "/dashboard"])("opens actual route %s from LINE state", (path) => {
    expect(miniappDestination("/", `?liff.state=${encodeURIComponent(path)}`)).toBe(path);
  });
  it.each(["/scan", "/coach", "/dashboard"])("keeps actual pathname %s", (path) => {
    expect(miniappDestination(path, "")).toBe(path);
  });
  it("handles nested encoding", () => expect(miniappDestination("/", "?liff.state=%252Fcoach")).toBe("/coach"));
  it("state takes priority over endpoint path", () => expect(miniappDestination("/dashboard", "?liff.state=%2Fscan")).toBe("/scan"));
  it("recognizes the provided MINI App prefix", () => expect(miniappDestination("/2011792304-d4sxwgO2/scan", "")).toBe("/scan"));
  it("invalid route returns home", () => expect(miniappDestination("/", "?liff.state=%2Fwater")).toBe("/"));
  it.each(["//evil.example/scan", "https://evil.example/scan", "/api/public/private", "/scan/../coach", "/scan\\evil", "/%2fscan"])("rejects unsafe or unknown destination %s", (path) => {
    expect(validAppPath(path)).toBeNull();
  });
  it("retains valid destination search", () => expect(validAppPath("/food/search?q=rice")).toBe("/food/search?q=rice"));
});