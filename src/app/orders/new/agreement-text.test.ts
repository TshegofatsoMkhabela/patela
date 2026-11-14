import { describe, expect, it } from "vitest";
import { appendText, cleanPdfText } from "./agreement-text";

describe("appendText", () => {
  it("uses the addition as-is when the field is empty", () => {
    expect(appendText("", "  20 crates of tomatoes ")).toBe("20 crates of tomatoes");
  });

  it("adds dictated text after existing text with one space", () => {
    expect(appendText("20 crates of tomatoes,", "delivered by Friday")).toBe(
      "20 crates of tomatoes, delivered by Friday",
    );
  });

  it("starts a new sentence after a full stop", () => {
    expect(appendText("Deliver by Friday.", "pay on delivery")).toBe(
      "Deliver by Friday. Pay on delivery",
    );
  });

  it("ignores an empty addition", () => {
    expect(appendText("Keep this", "   ")).toBe("Keep this");
  });
});

describe("cleanPdfText", () => {
  it("collapses runs of spaces and blank lines from PDF extraction", () => {
    expect(cleanPdfText("Item:   40  chairs\n\n\n\nDeliver   to Durban  ")).toBe(
      "Item: 40 chairs\n\nDeliver to Durban",
    );
  });

  it("caps very long documents so the agreement stays readable", () => {
    const long = "a".repeat(5000);
    expect(cleanPdfText(long).length).toBeLessThanOrEqual(4000);
  });
});
