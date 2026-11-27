import type { Konsumaciya, Pokazanie, Signal } from "../dogovor.js";

/**
 * Какво модулите искат от хранилището. Има две изпълнения:
 * PostgreSQL (в работа) и в паметта (в тестовете).
 * Няма операции за промяна или изтриване — дневникът само се допълва.
 */
export interface Hranilishte {
  /** Последното записано показание на електромера или null. */
  posledno(elektromerId: string): Promise<Pokazanie | null>;
  /** Записва показание. "dublikat", ако за същия електромер и момент вече има запис. */
  zapishi(p: Pokazanie): Promise<"zapisano" | "dublikat">;
  konsumaciya(elektromerId: string, ot: Date, doMoment: Date): Promise<Konsumaciya>;
  elektromeri(): Promise<string[]>;
  zapishiSignal(s: Signal): Promise<void>;
  signali(limit: number): Promise<Signal[]>;
  /**
   * Изпълнява `rabota` последователно за един електромер и като едно цяло:
   * докато тя тече, друга заявка за същия електромер чака, а ако `rabota` хвърли
   * грешка, нищо от записаното в нея не остава. Без това две едновременни показания
   * четат едно и също „предишно“ и намаляващ регистър минава без сигнал.
   */
  posledovatelno<T>(elektromerId: string, rabota: (h: Hranilishte) => Promise<T>): Promise<T>;
  /** true, ако хранилището отговаря. */
  zdrave(): Promise<boolean>;
  zatvori(): Promise<void>;
}
