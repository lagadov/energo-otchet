import type { FastifyInstance } from "fastify";
import { ELEKTROMER_ID } from "../dogovor.js";
import type { Hranilishte } from "../hranilishte/tip.js";

/** Модул „отчети“: консумация по период и списък на електромерите. */
export async function marshrutiOtcheti(app: FastifyInstance, hranilishte: Hranilishte) {
  app.get(
    "/api/elektromeri",
    {
      schema: {
        summary: "Електромерите, за които има показания",
        response: { 200: { type: "array", items: { type: "string" } } },
      },
    },
    async () => hranilishte.elektromeri(),
  );

  app.get<{ Params: { id: string } }>(
    "/api/elektromeri/:id/posledno",
    {
      schema: {
        summary: "Последното записано показание на електромер",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: ELEKTROMER_ID } },
        },
        response: { 200: { $ref: "Pokazanie#" }, 404: { $ref: "Greshka#" } },
      },
    },
    async (req, reply) => {
      const p = await hranilishte.posledno(req.params.id);
      return p ?? reply.code(404).send({ greshka: "Няма показания за този електромер." });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { ot: string; do: string } }>(
    "/api/elektromeri/:id/konsumaciya",
    {
      schema: {
        summary: "Консумация на електромер за период, в Wh",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: ELEKTROMER_ID } },
        },
        querystring: {
          type: "object",
          required: ["ot", "do"],
          properties: {
            ot: { type: "string", format: "date-time" },
            do: { type: "string", format: "date-time" },
          },
        },
        response: { 200: { $ref: "Konsumaciya#" }, 400: { $ref: "Greshka#" } },
      },
    },
    async (req, reply) => {
      const ot = new Date(req.query.ot);
      const doMoment = new Date(req.query.do);
      if (ot > doMoment) {
        return reply.code(400).send({ greshka: "Началото на периода е след края му." });
      }
      return hranilishte.konsumaciya(req.params.id, ot, doMoment);
    },
  );
}
