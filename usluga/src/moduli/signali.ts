import type { FastifyInstance } from "fastify";
import type { Signal } from "../dogovor.js";
import type { Hranilishte } from "../hranilishte/tip.js";

/** Модул „сигнали“: другите модули вдигат сигнал само през тази функция. */
export function sazdaiSignali(hranilishte: Hranilishte) {
  return {
    /** `prez` — хранилището на текущата транзакция, ако сигналът е част от нея. */
    async vdigni(s: Signal, prez: Hranilishte = hranilishte): Promise<void> {
      await prez.zapishiSignal(s);
    },
  };
}

export type ModulSignali = ReturnType<typeof sazdaiSignali>;

export async function marshrutiSignali(app: FastifyInstance, hranilishte: Hranilishte) {
  app.get<{ Querystring: { limit?: string } }>(
    "/api/signali",
    {
      schema: {
        summary: "Последните сигнали за необичайни показания",
        querystring: {
          type: "object",
          additionalProperties: false,
          // Параметрите в адреса са низове; договорът не ги превръща тихо в числа.
          properties: { limit: { type: "string", pattern: "^[1-9][0-9]{0,2}$" } },
        },
        response: { 200: { type: "array", items: { $ref: "Signal#" } } },
      },
    },
    async (req) => hranilishte.signali(Math.min(Number(req.query.limit ?? 50), 500)),
  );
}
