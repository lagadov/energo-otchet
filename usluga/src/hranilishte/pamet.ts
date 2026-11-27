import type { Konsumaciya, Pokazanie, Signal } from "../dogovor.js";
import type { Hranilishte } from "./tip.js";

/**
 * Закъснение като при истинска база. Без него операциите приключват мигновено,
 * едновременните заявки никога не се застъпват и грешки в подредбата остават скрити
 * (проверено: тестът за едновременни показания минаваше и без заключване).
 */
const zabavyane = () => new Promise((r) => setTimeout(r, 5));

/** Хранилище в паметта — за тестовете. Повтаря поведението на PostgreSQL изпълнението. */
export class HranilishtePamet implements Hranilishte {
  readonly pokazaniya: Pokazanie[] = [];
  readonly signaliSpisak: Signal[] = [];
  private readonly opashki = new Map<string, Promise<unknown>>();

  /** Добавя синхронно и връща добавения запис или null при дубликат. */
  private dobavi(p: Pokazanie): Pokazanie | null {
    const ima = this.pokazaniya.some(
      (x) => x.elektromerId === p.elektromerId && Date.parse(x.vreme) === Date.parse(p.vreme),
    );
    if (ima) return null;
    const kopie = { ...p };
    this.pokazaniya.push(kopie);
    return kopie;
  }

  async posledno(elektromerId: string): Promise<Pokazanie | null> {
    await zabavyane();
    const negovi = this.pokazaniya
      .filter((p) => p.elektromerId === elektromerId)
      .sort((a, b) => Date.parse(a.vreme) - Date.parse(b.vreme));
    return negovi.at(-1) ?? null;
  }

  async zapishi(p: Pokazanie): Promise<"zapisano" | "dublikat"> {
    await zabavyane();
    return this.dobavi(p) ? "zapisano" : "dublikat";
  }

  async konsumaciya(elektromerId: string, ot: Date, doMoment: Date): Promise<Konsumaciya> {
    const v = this.pokazaniya.filter(
      (p) =>
        p.elektromerId === elektromerId &&
        Date.parse(p.vreme) >= ot.getTime() &&
        Date.parse(p.vreme) <= doMoment.getTime(),
    );
    const stoinosti = v.map((p) => p.energiyaWh);
    return {
      elektromerId,
      ot: ot.toISOString(),
      do: doMoment.toISOString(),
      energiyaWh: v.length ? Math.max(...stoinosti) - Math.min(...stoinosti) : 0,
      broiPokazaniya: v.length,
    };
  }

  async elektromeri(): Promise<string[]> {
    return [...new Set(this.pokazaniya.map((p) => p.elektromerId))].sort();
  }

  async zapishiSignal(s: Signal): Promise<void> {
    this.signaliSpisak.push({ ...s });
  }

  async signali(limit: number): Promise<Signal[]> {
    return [...this.signaliSpisak].reverse().slice(0, limit);
  }

  async posledovatelno<T>(elektromerId: string, rabota: (h: Hranilishte) => Promise<T>): Promise<T> {
    // Опашка за всеки електромер: следващата работа започва, когато предишната свърши.
    const predishna = this.opashki.get(elektromerId) ?? Promise.resolve();
    const tazi = predishna
      .catch(() => {})
      .then(async () => {
        // Изглед, който помни какво е добавил — за да може да го махне като ROLLBACK.
        const dobaveniP: Pokazanie[] = [];
        const dobaveniS: Signal[] = [];
        const izgled: Hranilishte = Object.assign(Object.create(this) as HranilishtePamet, {
          zapishi: async (p: Pokazanie) => {
            await zabavyane();
            const zapis = this.dobavi(p);
            if (zapis) dobaveniP.push(zapis);
            return zapis ? ("zapisano" as const) : ("dublikat" as const);
          },
          zapishiSignal: async (s: Signal) => {
            const kopie = { ...s };
            this.signaliSpisak.push(kopie);
            dobaveniS.push(kopie);
          },
        });
        try {
          return await rabota(izgled);
        } catch (e) {
          for (const x of dobaveniP) this.pokazaniya.splice(this.pokazaniya.indexOf(x), 1);
          for (const x of dobaveniS) this.signaliSpisak.splice(this.signaliSpisak.indexOf(x), 1);
          throw e;
        }
      });
    this.opashki.set(elektromerId, tazi);
    return tazi;
  }

  async zdrave(): Promise<boolean> {
    return true;
  }

  async zatvori(): Promise<void> {}
}
