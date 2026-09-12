import { describe, expect, it } from "vitest";
import { getSourceRecords, parseReleaseDate, parseRuntimeToMinutes } from "@/lib/importers/ghmoviesdb";

describe("GHMoviesDB import normalization", () => {
  it("parses source runtimes conservatively", () => {
    expect(parseRuntimeToMinutes("2h 52m")).toBe(172);
    expect(parseRuntimeToMinutes("1h 45m")).toBe(105);
    expect(parseRuntimeToMinutes("28m")).toBe(28);
    expect(parseRuntimeToMinutes("N/A")).toBeNull();
  });

  it("accepts an array or a common export envelope", () => {
    expect(getSourceRecords([{ id: "one" }])).toHaveLength(1);
    expect(getSourceRecords({ data: [{ id: "one" }] })).toHaveLength(1);
  });

  it("preserves unparseable source dates without throwing", () => {
    expect(parseReleaseDate("10 Sep 2022")?.getUTCFullYear()).toBe(2022);
    expect(parseReleaseDate("not a date")).toBeNull();
  });
});
