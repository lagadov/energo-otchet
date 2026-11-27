import { describe, expect, it } from "vitest";
import { kwh, period } from "../src/formati";

describe("формати", () => {
  it("превръща Wh в kWh с два знака", () => {
    expect(kwh(1500)).toMatch(/^1[,.]50 kWh$/);
    expect(kwh(0)).toMatch(/^0[,.]00 kWh$/);
  });

  it("периодът завършва сега и започва N дни назад", () => {
    const sega = new Date("2026-11-27T12:00:00Z");
    expect(period(7, sega)).toEqual({
      ot: "2026-11-20T12:00:00.000Z",
      do: "2026-11-27T12:00:00.000Z",
    });
  });
});
