import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapa comas, comillas y saltos", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'he said "hi"'], [null, "line\nbreak"]]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi"""\r\n,"line\nbreak"\r\n');
  });
  it("agrega BOM si se pide", () => {
    expect(toCsv(["a"], [[1]], { bom: true }).startsWith("﻿")).toBe(true);
  });
});
