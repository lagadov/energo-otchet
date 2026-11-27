import swagger from "@fastify/swagger";
import Fastify, { type FastifyServerOptions } from "fastify";
import { shemaGreshka, shemaKonsumaciya, shemaPokazanie, shemaSignal } from "./dogovor.js";
import type { Hranilishte } from "./hranilishte/tip.js";
import { marshrutiOtcheti } from "./moduli/otcheti.js";
import { marshrutiPriemane } from "./moduli/priemane.js";
import { marshrutiSignali, sazdaiSignali } from "./moduli/signali.js";

export interface Nastroiki {
  hranilishte: Hranilishte;
  chasovnik?: () => Date;
  logger?: FastifyServerOptions["logger"];
}

/** Сглобява приложението. Хранилището се подава отвън — така тестовете ползват това в паметта. */
export async function sazdaiPrilozhenie({ hranilishte, chasovnik = () => new Date(), logger = false }: Nastroiki) {
  const app = Fastify({
    logger,
    // По подразбиране Fastify тихо поправя входа: изрязва непознатите полета и превръща
    // типовете (null → 0, "5" → 5). Договорът е строг: такъв вход се отказва с 400.
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });

  for (const shema of [shemaPokazanie, shemaSignal, shemaKonsumaciya, shemaGreshka]) {
    app.addSchema(shema);
  }

  await app.register(swagger, {
    openapi: {
      info: { title: "Енерго-отчет API", version: "0.1.0" },
    },
  });

  // Грешките при валидиране излизат в същата форма като останалите: { greshka }.
  app.setErrorHandler((err: { validation?: unknown; message: string; statusCode?: number }, req, reply) => {
    if (err.validation) return reply.code(400).send({ greshka: err.message });
    req.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ greshka: "Вътрешна грешка." });
  });

  const signali = sazdaiSignali(hranilishte);
  await marshrutiPriemane(app, hranilishte, signali, chasovnik);
  await marshrutiOtcheti(app, hranilishte);
  await marshrutiSignali(app, hranilishte);

  app.get("/health", { schema: { hide: true } }, async (_req, reply) => {
    const ok = await hranilishte.zdrave();
    return reply.code(ok ? 200 : 503).send({ status: ok ? "ok" : "bazata ne otgovarya" });
  });

  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());

  return app;
}
