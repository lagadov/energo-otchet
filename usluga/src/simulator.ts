// Симулатор на електромери: изпраща показания към услугата, както биха го правили истински уреди.
// Времето е ускорено: всяка стъпка е 15 минути симулирано време, изпратени на всеки INTERVAL_MS.
import type { Pokazanie } from "./dogovor.js";

const USLUGA_URL = process.env.USLUGA_URL ?? "http://localhost:3000";
const BROI = Number(process.env.BROI_ELEKTROMERI ?? 5);
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 2000);
const STAPKA_MS = 15 * 60 * 1000;
/** Вероятност за умишлено необичайно показание — за да има какво да показват сигналите. */
const SHANS_SKOK = 0.01;
const SHANS_NAMALYAVASHTO = 0.005;

interface Ured {
  id: string;
  registarWh: number;
}

const uredi: Ured[] = Array.from({ length: BROI }, (_, i) => ({
  id: `EM-${String(i + 1).padStart(4, "0")}`,
  registarWh: 1_000_000 + Math.floor(Math.random() * 500_000),
}));

// По подразбиране започваме 30 дни назад, за да има история. Ако базата вече има
// показания (рестарт), продължаваме от последното — иначе услугата би отхвърляла
// всичко като „по-старо“ и „намаляващо“.
let vreme = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / STAPKA_MS) * STAPKA_MS;

async function prodalzhiOtBazata(): Promise<void> {
  for (const u of uredi) {
    const r = await fetch(`${USLUGA_URL}/api/elektromeri/${u.id}/posledno`);
    if (r.status === 404) continue;
    if (!r.ok) throw new Error(`posledno ${u.id}: ${r.status}`);
    const p = (await r.json()) as Pokazanie;
    u.registarWh = p.energiyaWh;
    vreme = Math.max(vreme, Math.floor(Date.parse(p.vreme) / STAPKA_MS) * STAPKA_MS);
  }
}

function sledvashto(u: Ured): Pokazanie {
  let prirast = 50 + Math.floor(Math.random() * 350); // 50–400 Wh за 15 минути
  const r = Math.random();
  if (r < SHANS_SKOK) prirast = 20_000; // 80 kW средно — над прага
  let energiya = u.registarWh + prirast;
  if (r > 1 - SHANS_NAMALYAVASHTO) energiya = u.registarWh - 1_000; // повреден регистър
  else u.registarWh = energiya;
  return { elektromerId: u.id, vreme: new Date(vreme).toISOString(), energiyaWh: energiya };
}

async function izprati(p: Pokazanie): Promise<void> {
  try {
    const r = await fetch(`${USLUGA_URL}/api/pokazaniya`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (r.status !== 201) {
      console.log(JSON.stringify({ elektromer: p.elektromerId, status: r.status, otgovor: await r.text() }));
    }
  } catch (e) {
    console.log(JSON.stringify({ elektromer: p.elektromerId, greshka: String(e) }));
  }
}

async function stapka(): Promise<void> {
  if (vreme + STAPKA_MS > Date.now()) return; // стигнахме настоящето — чакаме реалното време
  vreme += STAPKA_MS;
  await Promise.all(uredi.map((u) => izprati(sledvashto(u))));
}

let tajmer: ReturnType<typeof setInterval> | undefined;

// Спокойно спиране при `docker compose down` / Ctrl+C. Без това Docker чака 10 секунди
// и убива процеса принудително (код 137).
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    if (tajmer) clearInterval(tajmer);
    console.log(JSON.stringify({ spirane: signal }));
    process.exit(0);
  });
}

// Услугата може още да тръгва — опитваме няколко пъти.
for (let opit = 1; ; opit++) {
  try {
    await prodalzhiOtBazata();
    break;
  } catch (e) {
    if (opit >= 30) throw e;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
console.log(JSON.stringify({ start: new Date(vreme).toISOString(), uredi: BROI, usluga: USLUGA_URL }));
tajmer = setInterval(() => void stapka(), INTERVAL_MS);
