import pg from "pg";
import type { Konsumaciya, Pokazanie, Signal, VidSignal } from "../dogovor.js";
import type { Hranilishte } from "./tip.js";

// bigint от PostgreSQL идва като низ; стойностите ни са под 2^53, затова ги превръщаме в число.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

const UNIKALNOST_NARUSHENA = "23505";

/** Пул от връзки или една връзка в транзакция — заявките се пишат еднакво и за двете. */
type Izpalnitel = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

export class HranilishtePostgres implements Hranilishte {
  private readonly pool: pg.Pool | null;
  private readonly db: Izpalnitel;

  /** Низ за връзка — нов пул; готова връзка — работа вътре в транзакция. */
  constructor(izvor: string | Izpalnitel) {
    if (typeof izvor === "string") {
      this.pool = new pg.Pool({ connectionString: izvor, max: 10 });
      this.db = this.pool;
    } else {
      this.pool = null;
      this.db = izvor;
    }
  }

  async posledovatelno<T>(elektromerId: string, rabota: (h: Hranilishte) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error("Вложените транзакции не се поддържат.");
    const vrazka = await this.pool.connect();
    try {
      await vrazka.query("BEGIN");
      // Заключване за този електромер до края на транзакцията. Другите електромери не чакат.
      await vrazka.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [elektromerId]);
      const rezultat = await rabota(new HranilishtePostgres(vrazka));
      await vrazka.query("COMMIT");
      return rezultat;
    } catch (e) {
      await vrazka.query("ROLLBACK");
      throw e;
    } finally {
      vrazka.release();
    }
  }

  async posledno(elektromerId: string): Promise<Pokazanie | null> {
    const r = await this.db.query(
      `SELECT elektromer_id, vreme, energiya_wh FROM pokazaniya
        WHERE elektromer_id = $1 ORDER BY vreme DESC LIMIT 1`,
      [elektromerId],
    );
    const red = r.rows[0];
    return red
      ? { elektromerId: red.elektromer_id, vreme: red.vreme.toISOString(), energiyaWh: red.energiya_wh }
      : null;
  }

  async zapishi(p: Pokazanie): Promise<"zapisano" | "dublikat"> {
    // ON CONFLICT вместо прихващане на грешка: грешка би провалила цялата транзакция.
    const r = await this.db.query(
      `INSERT INTO pokazaniya (elektromer_id, vreme, energiya_wh) VALUES ($1, $2, $3)
       ON CONFLICT (elektromer_id, vreme) DO NOTHING`,
      [p.elektromerId, p.vreme, p.energiyaWh],
    );
    return r.rowCount === 1 ? "zapisano" : "dublikat";
  }

  async konsumaciya(elektromerId: string, ot: Date, doMoment: Date): Promise<Konsumaciya> {
    // Натрупаният регистър само расте, затова консумацията е разликата между
    // най-голямото и най-малкото показание в интервала.
    const r = await this.db.query(
      `SELECT COALESCE(MAX(energiya_wh) - MIN(energiya_wh), 0) AS wh, COUNT(*)::int AS broi
         FROM pokazaniya
        WHERE elektromer_id = $1 AND vreme BETWEEN $2 AND $3`,
      [elektromerId, ot, doMoment],
    );
    const red = r.rows[0];
    return {
      elektromerId,
      ot: ot.toISOString(),
      do: doMoment.toISOString(),
      energiyaWh: red.wh,
      broiPokazaniya: red.broi,
    };
  }

  async elektromeri(): Promise<string[]> {
    const r = await this.db.query(
      `SELECT DISTINCT elektromer_id FROM pokazaniya ORDER BY elektromer_id`,
    );
    return r.rows.map((red) => red.elektromer_id as string);
  }

  async zapishiSignal(s: Signal): Promise<void> {
    await this.db.query(
      `INSERT INTO signali (elektromer_id, vreme, vid, opisanie) VALUES ($1, $2, $3, $4)`,
      [s.elektromerId, s.vreme, s.vid, s.opisanie],
    );
  }

  async signali(limit: number): Promise<Signal[]> {
    const r = await this.db.query(
      `SELECT elektromer_id, vreme, vid, opisanie FROM signali ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return r.rows.map((red) => ({
      elektromerId: red.elektromer_id,
      vreme: red.vreme.toISOString(),
      vid: red.vid as VidSignal,
      opisanie: red.opisanie,
    }));
  }

  async zdrave(): Promise<boolean> {
    try {
      await this.db.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async zatvori(): Promise<void> {
    await this.pool?.end();
  }
}
