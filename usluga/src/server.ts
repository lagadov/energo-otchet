import { sazdaiPrilozhenie } from "./app.js";
import { HranilishtePostgres } from "./hranilishte/postgres.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Липсва DATABASE_URL.");
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 3000);

const hranilishte = new HranilishtePostgres(DATABASE_URL);
const app = await sazdaiPrilozhenie({ hranilishte, logger: true });

// Спокойно спиране: Docker изпраща SIGTERM при `docker compose down`.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "спиране");
    await app.close();
    await hranilishte.zatvori();
    process.exit(0);
  });
}

await app.listen({ host: "0.0.0.0", port: PORT });
