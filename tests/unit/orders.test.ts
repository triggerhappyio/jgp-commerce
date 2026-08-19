import { describe, it, expect } from "vitest";
import { formatOrderNumber } from "@/lib/orders";

describe("formatOrderNumber", () => {
  it("formats a sequence number into the JGP-##### human order number", () => {
    expect(formatOrderNumber(1)).toBe("JGP-10001");
    expect(formatOrderNumber(42)).toBe("JGP-10042");
  });

  it("stays unique for distinct sequence values (no collision by construction)", () => {
    const seen = new Set<string>();
    for (let seq = 1; seq <= 1000; seq++) {
      const num = formatOrderNumber(seq);
      expect(seen.has(num)).toBe(false);
      seen.add(num);
    }
  });
});
