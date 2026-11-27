import { describe, expect, it } from "vitest";
import type { Pokazanie } from "../src/dogovor.js";
import { proveriPokazanie } from "../src/moduli/pravila.js";

const SEGA = new Date("2026-11-27T12:00:00Z");
const p = (vreme: string, energiyaWh: number): Pokazanie => ({
  elektromerId: "EM-0001",
  vreme,
  energiyaWh,
});

describe("правила за показание", () => {
  it("приема първото показание на електромер", () => {
    expect(proveriPokazanie(p("2026-11-27T11:00:00Z", 1000), null, SEGA).vid).toBe("priemi");
  });

  it("отказва показание повече от 5 минути в бъдещето", () => {
    const r = proveriPokazanie(p("2026-11-27T12:06:00Z", 1000), null, SEGA);
    expect(r.vid).toBe("otkazhi");
  });

  it("приема показание до 5 минути в бъдещето (разминаване на часовниците)", () => {
    expect(proveriPokazanie(p("2026-11-27T12:04:00Z", 1000), null, SEGA).vid).toBe("priemi");
  });

  it("отказва показание, по-старо от последното", () => {
    const r = proveriPokazanie(p("2026-11-27T10:00:00Z", 2000), p("2026-11-27T11:00:00Z", 1000), SEGA);
    expect(r.vid).toBe("otkazhi");
  });

  it("отказва намаляваща енергия и вдига сигнал", () => {
    const r = proveriPokazanie(p("2026-11-27T11:15:00Z", 900), p("2026-11-27T11:00:00Z", 1000), SEGA);
    expect(r.vid).toBe("otkazhi");
    expect(r.signal?.vid).toBe("namalyavashto");
  });

  it("приема скок, но вдига сигнал", () => {
    // 20 000 Wh за 15 минути = 80 000 W средно, над прага от 50 000 W
    const r = proveriPokazanie(p("2026-11-27T11:15:00Z", 21_000), p("2026-11-27T11:00:00Z", 1000), SEGA);
    expect(r.vid).toBe("priemi");
    expect(r.signal?.vid).toBe("skok");
  });

  it("нормално потребление — без сигнал", () => {
    const r = proveriPokazanie(p("2026-11-27T11:15:00Z", 1300), p("2026-11-27T11:00:00Z", 1000), SEGA);
    expect(r).toEqual({ vid: "priemi" });
  });
});
