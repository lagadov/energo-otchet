import type { FastifyInstance } from "fastify";
import type { Pokazanie } from "../dogovor.js";
import type { Hranilishte } from "../hranilishte/tip.js";
import { proveriPokazanie } from "./pravila.js";
import type { ModulSignali } from "./signali.js";

type Izhod = { kod: 201 | 409 | 422; tialo: { status: string } | { greshka: string } };

/** Модул „приемане“: проверява показанието и го добавя в дневника. */
export async function marshrutiPriemane(
  app: FastifyInstance,
  hranilishte: Hranilishte,
  signali: ModulSignali,
  chasovnik: () => Date,
) {
  app.post<{ Body: Pokazanie }>(
    "/api/pokazaniya",
    {
      schema: {
        summary: "Приема едно показание от електромер",
        body: { $ref: "Pokazanie#" },
        response: {
          201: {
            type: "object",
            properties: { status: { type: "string" } },
          },
          409: { $ref: "Greshka#" },
          422: { $ref: "Greshka#" },
        },
      },
    },
    async (req, reply) => {
      // Времето се свежда до милисекунди: толкова различава JavaScript. Иначе база с
      // микросекунди би видяла два различни момента там, където правилата виждат един.
      const novo: Pokazanie = { ...req.body, vreme: new Date(req.body.vreme).toISOString() };

      // Четенето на предишното, проверката и записът са едно цяло за този електромер.
      const izhod = await hranilishte.posledovatelno<Izhod>(novo.elektromerId, async (tx) => {
        const predishno = await tx.posledno(novo.elektromerId);
        const reshenie = proveriPokazanie(novo, predishno, chasovnik());

        if (reshenie.vid === "otkazhi") {
          if (reshenie.signal) await signali.vdigni(reshenie.signal, tx);
          return { kod: 422, tialo: { greshka: reshenie.prichina } };
        }

        const rezultat = await tx.zapishi(novo);
        if (rezultat === "dublikat") {
          return { kod: 409, tialo: { greshka: "Показание за този момент вече е записано." } };
        }
        // Сигналът за скок се записва само ако самото показание е записано.
        if (reshenie.signal) await signali.vdigni(reshenie.signal, tx);
        return { kod: 201, tialo: { status: "zapisano" } };
      });

      if (izhod.kod === 422) {
        req.log.warn({ elektromerId: novo.elektromerId, izhod: izhod.tialo }, "отказано показание");
      }
      return reply.code(izhod.kod).send(izhod.tialo);
    },
  );
}
