// Договорът на API-то: типовете се ползват и от таблото (само `import type`),
// а JSON схемите — от Fastify за валидиране и за пораждане на OpenAPI документа.

/** Показание на електромер: натрупаната енергия в цели ватчасове (Wh). */
export interface Pokazanie {
  elektromerId: string;
  /** Момент на измерване, ISO 8601 с часова зона. */
  vreme: string;
  /** Натрупана енергия от началото на уреда, в Wh. Цяло число, никога дробно. */
  energiyaWh: number;
}

export type VidSignal = "namalyavashto" | "skok";

export interface Signal {
  elektromerId: string;
  vreme: string;
  vid: VidSignal;
  opisanie: string;
}

export interface Konsumaciya {
  elektromerId: string;
  ot: string;
  do: string;
  energiyaWh: number;
  broiPokazaniya: number;
}

export const ELEKTROMER_ID = "^EM-[0-9]{4}$";

export const shemaPokazanie = {
  $id: "Pokazanie",
  type: "object",
  additionalProperties: false,
  required: ["elektromerId", "vreme", "energiyaWh"],
  properties: {
    elektromerId: { type: "string", pattern: ELEKTROMER_ID },
    vreme: { type: "string", format: "date-time" },
    energiyaWh: { type: "integer", minimum: 0, maximum: 9007199254740991 },
  },
} as const;

export const shemaSignal = {
  $id: "Signal",
  type: "object",
  required: ["elektromerId", "vreme", "vid", "opisanie"],
  properties: {
    elektromerId: { type: "string" },
    vreme: { type: "string", format: "date-time" },
    vid: { type: "string", enum: ["namalyavashto", "skok"] },
    opisanie: { type: "string" },
  },
} as const;

export const shemaKonsumaciya = {
  $id: "Konsumaciya",
  type: "object",
  required: ["elektromerId", "ot", "do", "energiyaWh", "broiPokazaniya"],
  properties: {
    elektromerId: { type: "string" },
    ot: { type: "string", format: "date-time" },
    do: { type: "string", format: "date-time" },
    energiyaWh: { type: "integer" },
    broiPokazaniya: { type: "integer" },
  },
} as const;

export const shemaGreshka = {
  $id: "Greshka",
  type: "object",
  required: ["greshka"],
  properties: { greshka: { type: "string" } },
} as const;
