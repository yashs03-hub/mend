import { describe, expect, it } from "vitest";
import { pickDefaultPatientId } from "./hub-selection";

describe("pickDefaultPatientId", () => {
  it("prefers Margaret when present in the roster", () => {
    expect(
      pickDefaultPatientId([
        { id: "alan-chen" },
        { id: "margaret-ellison" },
        { id: "rosa-nguyen" },
      ]),
    ).toBe("margaret-ellison");
  });

  it("falls back to the first patient when Margaret is absent", () => {
    expect(pickDefaultPatientId([{ id: "alan-chen" }, { id: "rosa-nguyen" }])).toBe(
      "alan-chen",
    );
  });

  it("returns undefined for an empty roster", () => {
    expect(pickDefaultPatientId([])).toBeUndefined();
  });
});
