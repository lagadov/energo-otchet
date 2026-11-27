// Тестове срещу истинска PostgreSQL. Пускат се, когато е зададен TEST_DATABASE_URL
// (в конвейера — да; локално — по желание). Иначе се прескачат.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sazdaiPrilozhenie } from "../src/app.js";
import { HranilishtePostgres } from "../src/hranilishte/postgres.js";

const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)("PostgreSQL", () => {
  let hranilishte: HranilishtePostgres;
  let app: Awaited<ReturnType<typeof sazdaiPrilozhenie>>;
  // Дневникът не позволява изтриване, затова всеки пуск ползва нов електромер.
  const id = `EM-${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;

  beforeAll(async () => {
    hranilishte = new HranilishtePostgres(URL!);
    app = await sazdaiPrilozhenie({ hranilishte, chasovnik: () => new Date("2100-01-01T00:00:00Z") });
  });
  afterAll(async () => {
    await app.close();
    await hranilishte.zatvori();
  });

  it("30 едновременни показания: регистърът в базата никога не намалява", async () => {
    const nachalo = Date.parse("2026-01-01T00:00:00Z") + Math.floor(Math.random() * 1e9);
    const zaiavki = Array.from({ length: 30 }, (_, i) =>
      app.inject({
        method: "POST",
        url: "/api/pokazaniya",
        payload: {
          elektromerId: id,
          vreme: new Date(nachalo + i * 15 * 60_000).toISOString(),
          // Нарочно разбъркани стойности: някои по-малки от предишните.
          energiyaWh: 1_000_000 + Math.floor(Math.random() * 2_000),
        },
      }),
    );
    const otgovori = await Promise.all(zaiavki);
    expect(otgovori.every((r) => [201, 422].includes(r.statusCode))).toBe(true);

    const r = await app.inject({
      method: "GET",
      url: `/api/elektromeri/${id}/konsumaciya?ot=2000-01-01T00:00:00Z&do=2100-01-01T00:00:00Z`,
    });
    expect(r.statusCode).toBe(200);

    // Проверка директно в базата, по реда на времето.
    const pg = (await import("pg")).default;
    const klient = new pg.Client({ connectionString: URL });
    await klient.connect();
    const redove = await klient.query(
      "SELECT energiya_wh FROM pokazaniya WHERE elektromer_id = $1 ORDER BY vreme",
      [id],
    );
    await klient.end();
    const stoinosti = redove.rows.map((x) => Number(x.energiya_wh));
    expect(stoinosti.length).toBeGreaterThan(0);
    expect(stoinosti).toEqual([...stoinosti].sort((a, b) => a - b));
  });

  it("потребителят на приложението не може да променя или изтрива показания", async () => {
    const pg = (await import("pg")).default;
    const klient = new pg.Client({ connectionString: URL });
    await klient.connect();
    await expect(klient.query("UPDATE pokazaniya SET energiya_wh = 0")).rejects.toThrow(/permission denied/);
    await expect(klient.query("DELETE FROM pokazaniya")).rejects.toThrow(/permission denied/);
    await klient.end();
  });
});
