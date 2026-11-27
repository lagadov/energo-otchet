import { beforeEach, describe, expect, it } from "vitest";
import { sazdaiPrilozhenie } from "../src/app.js";
import { HranilishtePamet } from "../src/hranilishte/pamet.js";

const SEGA = new Date("2026-11-27T12:00:00Z");

async function prilozhenie() {
  const hranilishte = new HranilishtePamet();
  const app = await sazdaiPrilozhenie({ hranilishte, chasovnik: () => SEGA });
  return { app, hranilishte };
}

const pokazanie = (vreme: string, energiyaWh: number) => ({
  method: "POST" as const,
  url: "/api/pokazaniya",
  payload: { elektromerId: "EM-0001", vreme, energiyaWh },
});

describe("API", () => {
  let ctx: Awaited<ReturnType<typeof prilozhenie>>;
  beforeEach(async () => {
    ctx = await prilozhenie();
  });

  it("записва валидно показание — 201", async () => {
    const r = await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    expect(r.statusCode).toBe(201);
    expect(ctx.hranilishte.pokazaniya).toHaveLength(1);
  });

  it("отказва невалиден вход по схемата — 400, нищо не се записва", async () => {
    const r = await ctx.app.inject({
      method: "POST",
      url: "/api/pokazaniya",
      payload: { elektromerId: "лош", vreme: "вчера", energiyaWh: 1.5 },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toHaveProperty("greshka");
    expect(ctx.hranilishte.pokazaniya).toHaveLength(0);
  });

  it("отказва непознати полета — 400", async () => {
    const r = await ctx.app.inject({
      method: "POST",
      url: "/api/pokazaniya",
      payload: { elektromerId: "EM-0001", vreme: "2026-11-27T11:00:00Z", energiyaWh: 1, admin: true },
    });
    expect(r.statusCode).toBe(400);
  });

  it("второ показание за същия момент е дубликат — 409", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    const r = await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    expect(r.statusCode).toBe(409);
  });

  it("намаляваща енергия — 422 и сигнал", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    const r = await ctx.app.inject(pokazanie("2026-11-27T11:15:00Z", 500));
    expect(r.statusCode).toBe(422);
    const s = await ctx.app.inject({ method: "GET", url: "/api/signali" });
    expect(s.json()[0].vid).toBe("namalyavashto");
  });

  it("смята консумация за период", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T10:00:00Z", 1000));
    await ctx.app.inject(pokazanie("2026-11-27T10:15:00Z", 1200));
    await ctx.app.inject(pokazanie("2026-11-27T10:30:00Z", 1450));
    const r = await ctx.app.inject({
      method: "GET",
      url: "/api/elektromeri/EM-0001/konsumaciya?ot=2026-11-27T10:00:00Z&do=2026-11-27T11:00:00Z",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ energiyaWh: 450, broiPokazaniya: 3 });
  });

  it("отказва период с начало след края — 400", async () => {
    const r = await ctx.app.inject({
      method: "GET",
      url: "/api/elektromeri/EM-0001/konsumaciya?ot=2026-11-27T12:00:00Z&do=2026-11-27T10:00:00Z",
    });
    expect(r.statusCode).toBe(400);
  });

  it("публикува OpenAPI договор с маршрута за показания", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/openapi.json" });
    expect(r.statusCode).toBe(200);
    expect(r.json().paths).toHaveProperty("/api/pokazaniya");
  });

  it("здравната проверка отговаря — 200", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
  });

  // --- Находки от прегледа на кода (Codex, 2026-11-27) ---

  it("null вместо число не се превръща тихо в 0 Wh — 400", async () => {
    const r = await ctx.app.inject({
      method: "POST",
      url: "/api/pokazaniya",
      payload: { elektromerId: "EM-0001", vreme: "2026-11-27T11:00:00Z", energiyaWh: null },
    });
    expect(r.statusCode).toBe(400);
    expect(ctx.hranilishte.pokazaniya).toHaveLength(0);
  });

  it("число, подадено като низ, се отказва — 400", async () => {
    const r = await ctx.app.inject({
      method: "POST",
      url: "/api/pokazaniya",
      payload: { elektromerId: "EM-0001", vreme: "2026-11-27T11:00:00Z", energiyaWh: "1000" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("две едновременни показания: намаляващото не минава без сигнал", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    const [a, b] = await Promise.all([
      ctx.app.inject(pokazanie("2026-11-27T11:15:00Z", 1200)),
      ctx.app.inject(pokazanie("2026-11-27T11:30:00Z", 1100)),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 422]);
    // Регистърът в дневника никога не намалява.
    const stoinosti = ctx.hranilishte.pokazaniya.map((p) => p.energiyaWh);
    expect(stoinosti).toEqual([...stoinosti].sort((x, y) => x - y));
  });

  it("време с точност под милисекунда се свежда до милисекунди — дубликат, 409", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00.000Z", 1000));
    const r = await ctx.app.inject(pokazanie("2026-11-27T11:00:00.0004Z", 900));
    expect(r.statusCode).toBe(409);
    expect(ctx.hranilishte.pokazaniya).toHaveLength(1);
  });

  it("ако записът се провали, не остава сигнал без показание", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    (ctx.hranilishte as unknown as { dobavi: () => never }).dobavi = () => {
      throw new Error("дискът е пълен");
    };
    const r = await ctx.app.inject(pokazanie("2026-11-27T11:15:00Z", 21_000)); // би бил скок
    expect(r.statusCode).toBe(500);
    expect(ctx.hranilishte.signaliSpisak).toHaveLength(0);
  });

  it("връща последното показание на електромер и 404 за непознат", async () => {
    await ctx.app.inject(pokazanie("2026-11-27T11:00:00Z", 1000));
    const r = await ctx.app.inject({ method: "GET", url: "/api/elektromeri/EM-0001/posledno" });
    expect(r.json()).toMatchObject({ energiyaWh: 1000 });
    const n = await ctx.app.inject({ method: "GET", url: "/api/elektromeri/EM-0002/posledno" });
    expect(n.statusCode).toBe(404);
  });

  it("лимитът за сигнали се проверява — 400 за нечисло", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/api/signali?limit=abc" });
    expect(r.statusCode).toBe(400);
    const ok = await ctx.app.inject({ method: "GET", url: "/api/signali?limit=5" });
    expect(ok.statusCode).toBe(200);
  });
});
