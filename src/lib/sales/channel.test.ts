import { describe, expect, it } from "vitest";
import { channelFromSource, toCents } from "./channel";

describe("canal de venta", () => {
  it("detecta web, pos y tiktok por source_name", () => {
    expect(channelFromSource("web")).toBe("web");
    expect(channelFromSource("pos")).toBe("pos");
    expect(channelFromSource("Shopify POS")).toBe("pos");
    expect(channelFromSource("tiktok")).toBe("tiktok");
    expect(channelFromSource("TikTok Shop")).toBe("tiktok");
    expect(channelFromSource("shopify_draft_order")).toBe("web");
    expect(channelFromSource("12345")).toBe("other");
    expect(channelFromSource(null)).toBe("other");
  });
  it("convierte montos a centavos", () => {
    expect(toCents("630.00")).toBe(63000);
    expect(toCents("0.1")).toBe(10);
    expect(toCents(null)).toBe(0);
  });
});
