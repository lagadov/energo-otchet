// Типовете идват от договора на услугата — описани са веднъж, ползват се от двете страни.
import type { Konsumaciya, Signal } from "../../usluga/src/dogovor";

async function vzemi<T>(pat: string): Promise<T> {
  const r = await fetch(pat);
  if (!r.ok) throw new Error(`${pat}: ${r.status}`);
  return (await r.json()) as T;
}

export const api = {
  elektromeri: () => vzemi<string[]>("/api/elektromeri"),
  konsumaciya: (id: string, ot: string, doMoment: string) =>
    vzemi<Konsumaciya>(
      `/api/elektromeri/${encodeURIComponent(id)}/konsumaciya?ot=${encodeURIComponent(ot)}&do=${encodeURIComponent(doMoment)}`,
    ),
  signali: (limit = 20) => vzemi<Signal[]>(`/api/signali?limit=${limit}`),
};
