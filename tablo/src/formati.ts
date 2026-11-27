/** Ватчасове → четим низ в kWh с два знака след десетичната запетая (българско изписване). */
export function kwh(energiyaWh: number): string {
  return (
    (energiyaWh / 1000).toLocaleString("bg-BG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " kWh"
  );
}

/** Интервал [сега − дни, сега] в ISO формат за заявката към API-то. */
export function period(dni: number, sega: Date = new Date()): { ot: string; do: string } {
  const ot = new Date(sega.getTime() - dni * 24 * 3600 * 1000);
  return { ot: ot.toISOString(), do: sega.toISOString() };
}
