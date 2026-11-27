import type { Pokazanie, Signal } from "../dogovor.js";

/** Показание с време повече от толкова в бъдещето се отхвърля (часовникът на уреда е грешен). */
export const DOPUSTIMO_BADESHTE_MS = 5 * 60 * 1000;

/** Средна мощност над този праг между две показания вдига сигнал „скок“. 50 kW ≈ 3 пъти над
 *  максималната мощност на битово трифазно захранване. */
export const PRAG_SKOK_W = 50_000;

export type Reshenie =
  | { vid: "priemi"; signal?: Signal }
  | { vid: "otkazhi"; prichina: string; signal?: Signal };

/**
 * Чисти правила за едно ново показание спрямо предишното. Без вход/изход —
 * затова се тестват директно.
 */
export function proveriPokazanie(
  novo: Pokazanie,
  predishno: Pokazanie | null,
  sega: Date,
): Reshenie {
  const tNovo = Date.parse(novo.vreme);

  if (tNovo > sega.getTime() + DOPUSTIMO_BADESHTE_MS) {
    return { vid: "otkazhi", prichina: "Времето на показанието е в бъдещето." };
  }
  if (!predishno) return { vid: "priemi" };

  const tPredishno = Date.parse(predishno.vreme);
  if (tNovo < tPredishno) {
    return { vid: "otkazhi", prichina: "Показанието е по-старо от последното записано." };
  }
  if (tNovo === tPredishno) {
    // Същият момент: хранилището ще го разпознае като дубликат.
    return { vid: "priemi" };
  }

  if (novo.energiyaWh < predishno.energiyaWh) {
    return {
      vid: "otkazhi",
      prichina: "Натрупаната енергия е по-малка от предишното показание.",
      signal: {
        elektromerId: novo.elektromerId,
        vreme: novo.vreme,
        vid: "namalyavashto",
        opisanie: `Показание ${novo.energiyaWh} Wh след ${predishno.energiyaWh} Wh`,
      },
    };
  }

  const chasove = (tNovo - tPredishno) / 3_600_000;
  const moshtnostW = (novo.energiyaWh - predishno.energiyaWh) / chasove;
  if (moshtnostW > PRAG_SKOK_W) {
    return {
      vid: "priemi",
      signal: {
        elektromerId: novo.elektromerId,
        vreme: novo.vreme,
        vid: "skok",
        opisanie: `Средна мощност ${Math.round(moshtnostW)} W над прага ${PRAG_SKOK_W} W`,
      },
    };
  }
  return { vid: "priemi" };
}
