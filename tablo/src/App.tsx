import { useEffect, useState } from "react";
import type { Konsumaciya, Signal } from "../../usluga/src/dogovor";
import { api } from "./api";
import { kwh, period } from "./formati";

const PERIODI = [
  { etiket: "24 часа", dni: 1 },
  { etiket: "7 дни", dni: 7 },
  { etiket: "30 дни", dni: 30 },
];

const VID_SIGNAL: Record<Signal["vid"], string> = {
  namalyavashto: "Намаляващо показание",
  skok: "Скок в потреблението",
};

export function App() {
  const [elektromeri, setElektromeri] = useState<string[]>([]);
  const [izbran, setIzbran] = useState<string>("");
  // 30 дни по подразбиране: симулаторът започва месец назад и „24 часа“ е празно, докато не стигне днес.
  const [dni, setDni] = useState(30);
  const [konsumaciya, setKonsumaciya] = useState<Konsumaciya | null>(null);
  const [signali, setSignali] = useState<Signal[]>([]);
  const [greshka, setGreshka] = useState<string | null>(null);

  // Опресняване на всеки 5 секунди: симулаторът добавя нови показания.
  useEffect(() => {
    const zaredi = () => {
      api.elektromeri().then(setElektromeri).catch((e) => setGreshka(String(e)));
      api.signali().then(setSignali).catch((e) => setGreshka(String(e)));
    };
    zaredi();
    const t = setInterval(zaredi, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!izbran && elektromeri[0]) setIzbran(elektromeri[0]);
  }, [elektromeri, izbran]);

  useEffect(() => {
    if (!izbran) return;
    // Отговор, пристигнал след смяна на електромера или периода, се пренебрегва:
    // иначе закъсняла заявка би показала консумацията на предишния избор.
    let aktualen = true;
    setKonsumaciya(null);
    const zaredi = () => {
      const p = period(dni);
      api
        .konsumaciya(izbran, p.ot, p.do)
        .then((k) => aktualen && setKonsumaciya(k))
        .catch((e) => aktualen && setGreshka(String(e)));
    };
    zaredi();
    const t = setInterval(zaredi, 5000);
    return () => {
      aktualen = false;
      clearInterval(t);
    };
  }, [izbran, dni]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Енерго-отчет</h1>
      {greshka && <p role="alert" style={{ color: "#b00020" }}>Грешка при връзка с услугата: {greshka}</p>}

      <section>
        <h2>Консумация</h2>
        <label>
          Електромер{" "}
          <select value={izbran} onChange={(e) => setIzbran(e.target.value)}>
            {elektromeri.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>{" "}
        {PERIODI.map((p) => (
          <button key={p.dni} onClick={() => setDni(p.dni)} aria-pressed={dni === p.dni} disabled={dni === p.dni}>
            {p.etiket}
          </button>
        ))}
        {konsumaciya && konsumaciya.elektromerId === izbran ? (
          <p style={{ fontSize: "2rem", margin: "1rem 0" }}>
            {kwh(konsumaciya.energiyaWh)}{" "}
            <small style={{ fontSize: "1rem", color: "#555" }}>от {konsumaciya.broiPokazaniya} показания</small>
          </p>
        ) : (
          <p>Няма данни.</p>
        )}
      </section>

      <section>
        <h2>Сигнали</h2>
        {signali.length === 0 ? (
          <p>Няма сигнали.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Електромер</th>
                <th align="left">Момент</th>
                <th align="left">Вид</th>
                <th align="left">Описание</th>
              </tr>
            </thead>
            <tbody>
              {signali.map((s, i) => (
                <tr key={i}>
                  <td>{s.elektromerId}</td>
                  <td>{new Date(s.vreme).toLocaleString("bg-BG")}</td>
                  <td>{VID_SIGNAL[s.vid]}</td>
                  <td>{s.opisanie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
