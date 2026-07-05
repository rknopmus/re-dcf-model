import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const CONTACT = {
  email: "roberto@knop.es",
  web: "https://www.knop.es",
  linkedin: "https://www.linkedin.com/in/RobertoKnop",
};

const DEF = {
  maturity: 10,
  year1Income: 100000,
  incomeGrowth: 3,
  year1Expenses: 35000,
  expenseGrowth: 2,
  exitCapRate: 5,
  discountRate: 8,
};

const TX = {
  en: {
    title: "DCF Pro - Roberto Knop",
    sub: "Generic discounted cash flow valuation dashboard with NPV, IRR, CAGR, payback, terminal value and sensitivity analysis.",
    term: "Financial Valuation Terminal",
    reset: "Reset",
    print: "Generate PDF Report",
    year: "Year",
    years: "years",
    inputs: "DCF Inputs",
    maturity: "Project Maturity (Years)",
    year1Income: "Year 1 Inflows",
    incomeGrowth: "Inflow Growth Rate (%)",
    year1Expenses: "Year 1 Outflows",
    expenseGrowth: "Outflow Growth Rate (%)",
    exitCapRate: "Exit Cap Rate / Terminal Yield (%)",
    discountRate: "Discount Rate (%)",
    npv: "NPV",
    irr: "IRR",
    cagr: "CAGR",
    payback: "Payback",
    terminal: "Terminal Value",
    total: "Total Net Income",
    income: "Inflows",
    expenses: "Outflows",
    noi: "Net Income",
    dcf: "DCF",
    sens: "Sensitivity",
    drivers: "Value Drivers",
    table: "Cash Flow Table",
    up: "Upside",
    down: "Downside",
  },
  es: {
    title: "DCF Pro - Roberto Knop",
    sub: "Dashboard genérico de valoración por descuento de flujos con NPV, TIR, CAGR, payback, valor terminal y sensibilidad.",
    term: "Terminal de Valoración Financiera",
    reset: "Restaurar",
    print: "Generar PDF",
    year: "Año",
    years: "años",
    inputs: "Inputs DCF",
    maturity: "Vencimiento (Años)",
    year1Income: "Inflows Año 1",
    incomeGrowth: "Crecimiento Inflows (%)",
    year1Expenses: "Outflows Año 1",
    expenseGrowth: "Crecimiento Outflows (%)",
    exitCapRate: "Exit Cap / Yield Terminal (%)",
    discountRate: "Discount Rate (%)",
    npv: "NPV",
    irr: "TIR",
    cagr: "CAGR",
    payback: "Payback",
    terminal: "Valor Terminal",
    total: "Resultado Neto Total",
    income: "Inflows",
    expenses: "Outflows",
    noi: "Resultado Neto",
    dcf: "DCF",
    sens: "Sensibilidad",
    drivers: "Variables de Impacto",
    table: "Tabla de Flujos",
    up: "Alcista",
    down: "Bajista",
  },
};

const CUR = [
  ["NONE", "No currency", "Sin divisa", ""],
  ["EUR", "EUR", "EUR", "€"],
  ["USD", "USD", "USD", "$"],
  ["GBP", "GBP", "GBP", "£"],
  ["MXN", "MXN", "MXN", "MXN"],
  ["PEN", "PEN", "PEN", "PEN"],
];

function fmt(v, c) {
  if (!Number.isFinite(v)) return "-";
  const n = Math.round(v).toLocaleString("en-US");
  const item = CUR.find((x) => x[0] === c);
  if (c === "NONE") return n;
  if (["EUR", "USD", "GBP"].includes(c)) return item[3] + n;
  return item[3] + " " + n;
}

function sh(v, c) {
  if (!Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  let s = "";
  let x = v;

  if (a >= 1e9) {
    x = v / 1e9;
    s = " B";
  } else if (a >= 1e6) {
    x = v / 1e6;
    s = " MM";
  } else if (a >= 1e3) {
    x = v / 1e3;
    s = " K";
  }

  const n = x.toFixed(a >= 1e3 ? 2 : 0);
  const item = CUR.find((y) => y[0] === c);

  if (c === "NONE") return n + s;
  if (["EUR", "USD", "GBP"].includes(c)) return item[3] + n + s;
  return item[3] + " " + n + s;
}

function pct(v) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "-";
}

function irr(f, g = 0.1) {
  let r = g;

  for (let i = 0; i < 1000; i++) {
    let n = 0;
    let d = 0;

    for (let t = 0; t < f.length; t++) {
      n += f[t] / (1 + r) ** t;
      if (t > 0) d -= (t * f[t]) / (1 + r) ** (t + 1);
    }

    if (Math.abs(d) < 1e-12) return null;

    const nr = r - n / d;

    if (!Number.isFinite(nr) || nr <= -0.9999) return null;
    if (Math.abs(nr - r) < 1e-8) return nr;

    r = nr;
  }

  return null;
}

function pb(inv, flows) {
  let c = 0;

  for (let i = 0; i < flows.length; i++) {
    const p = c;
    c += flows[i];

    if (c >= inv) {
      return i + (inv - p) / flows[i];
    }
  }

  return null;
}

function calc(inp) {
  const m = Math.max(1, Math.round(inp.maturity || 1));
  const ig = inp.incomeGrowth / 100;
  const eg = inp.expenseGrowth / 100;
  const ec = inp.exitCapRate / 100;
  const dr = inp.discountRate / 100;
  const rows = [];

  for (let i = 0; i < m; i++) {
    const income = i ? rows[i - 1].income * (1 + ig) : inp.year1Income;
    const expenses = i ? rows[i - 1].expenses * (1 + eg) : inp.year1Expenses;
    const noi = income - expenses;

    rows.push({
      year: i + 1,
      income,
      expenses,
      noi,
      terminalValue: 0,
      discountedCashFlow: 0,
    });
  }

  const tv = ec > 0 ? rows.at(-1).noi / ec : 0;
  rows.at(-1).terminalValue = tv;

  rows.forEach((r, i) => {
    r.discountedCashFlow = (r.noi + r.terminalValue) / (1 + dr) ** (i + 1);
  });

  const npv = rows.reduce((s, r) => s + r.discountedCashFlow, 0);

  const flows = rows.map((r, i) =>
    i === rows.length - 1 ? r.noi + r.terminalValue : r.noi
  );

  const totalInflows = flows.reduce((s, v) => s + v, 0);

  return {
    rows,
    npv,
    terminalValue: tv,
    totalNOI: rows.reduce((s, r) => s + r.noi, 0),
    irr: irr([-npv, ...flows]),
    cagr: npv > 0 ? (totalInflows / npv) ** (1 / m) - 1 : null,
    payback: pb(npv, flows),
  };
}

function sensitivity(inp) {
  const ec = inp.exitCapRate;
  const dr = inp.discountRate;

  const ex = [ec - 1, ec - 0.5, ec, ec + 0.5, ec + 1].map((v) =>
    Math.max(0.1, +v.toFixed(2))
  );

  const ds = [dr - 1, dr - 0.5, dr, dr + 0.5, dr + 1].map((v) =>
    Math.max(0.1, +v.toFixed(2))
  );

  return {
    ex,
    ds,
    table: ex.map((e) => ({
      e,
      vals: ds.map((d) => calc({ ...inp, exitCapRate: e, discountRate: d }).npv),
    })),
  };
}

function tornado(inp, base) {
  const arr = [
    ["incomeGrowth", "Inflow Growth", 1],
    ["expenseGrowth", "Outflow Growth", -1],
    ["exitCapRate", "Terminal Yield", -1],
    ["discountRate", "Discount Rate", -1],
  ];

  return arr
    .map(([k, name, dir]) => {
      const up = calc({ ...inp, [k]: inp[k] + 1 }).npv;
      const down = calc({ ...inp, [k]: Math.max(0.1, inp[k] - 1) }).npv;

      const pos = dir === 1 ? up - base : down - base;
      const neg = dir === 1 ? down - base : up - base;

      return {
        name,
        positive: pos,
        negative: Math.abs(neg),
        abs: Math.max(Math.abs(pos), Math.abs(neg)),
      };
    })
    .sort((a, b) => b.abs - a.abs);
}

export default function App() {
  const [lang, setLang] = useState("en");
  const [currency, setCurrency] = useState("NONE");
  const [inputs, setInputs] = useState(DEF);

  const t = TX[lang];

  const res = useMemo(() => calc(inputs), [inputs]);
  const sen = useMemo(() => sensitivity(inputs), [inputs]);
  const tor = useMemo(() => tornado(inputs, res.npv), [inputs, res.npv]);

  const fields = [
    "maturity",
    "year1Income",
    "incomeGrowth",
    "year1Expenses",
    "expenseGrowth",
    "exitCapRate",
    "discountRate",
  ];

  const chart = res.rows.map((r) => ({
    year: `${t.year} ${r.year}`,
    [t.income]: Math.round(r.income),
    [t.expenses]: Math.round(r.expenses),
    [t.noi]: Math.round(r.noi),
    [t.dcf]: Math.round(r.discountedCashFlow),
  }));

  function upd(k, v) {
    setInputs((o) => ({ ...o, [k]: Number(v) || 0 }));
  }

  function step(k) {
    return k === "maturity"
      ? "1"
      : k.includes("Growth") || k.includes("Rate")
      ? ".1"
      : "1000";
  }

  function color(v) {
    const diff = (v - res.npv) / Math.abs(res.npv);

    if (diff > 0.1) return "bg-[#ff9900] text-black";
    if (diff > 0.03) return "bg-[#3a2400] text-[#ffcc66]";
    if (diff < -0.1) return "bg-red-950 text-red-200";
    if (diff < -0.03) return "bg-zinc-900 text-zinc-400";

    return "bg-black text-zinc-300";
  }

  const kpis = [
[t.npv, fmt(res.npv, currency), 1],
    [t.irr, res.irr === null ? "-" : pct(res.irr)],
    [t.cagr, res.cagr === null ? "-" : pct(res.cagr)],
    [
      t.payback,
      Number.isFinite(res.payback)
        ? res.payback.toFixed(2) + " " + t.years
        : "-",
    ],
    [t.terminal, sh(res.terminalValue, currency)],
    [t.total, sh(res.totalNOI, currency)],
  ];

  const axis = { stroke: "#8a8a8a", fontSize: 11 };

  const tooltip = {
    backgroundColor: "#050505",
    border: "1px solid #333",
    color: "#fff",
    fontFamily:
      '"Neue Haas Grotesk Display", "Helvetica Neue", "Arial Narrow", Arial, sans-serif',
  };

  return (
    <div
      className="min-h-screen bg-black text-zinc-100"
      style={{
        fontFamily:
          '"Neue Haas Grotesk Display", "Helvetica Neue", "Arial Narrow", Arial, sans-serif',
      }}
    >
      <header className="border-b border-[#222] bg-black px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
         <div>
  <div className="mb-1 text-2xl font-black uppercase tracking-[-0.04em] text-[#ff9900] md:text-3xl">
    DCF PRO
  </div>

  <div className="text-sm font-bold uppercase tracking-[0.28em] text-white">
    Financial Valuation Terminal
  </div>

  <div className="mt-2 text-xs font-medium text-zinc-500">
    by Roberto Knop
  </div>

  <p className="mt-3 max-w-4xl text-sm font-medium text-zinc-500">
    {t.sub}
  </p>
</div>

          <div className="no-print flex flex-wrap gap-3">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="rounded-none border border-zinc-700 bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white outline-none focus:border-[#ff9900]"
            >
              <option value="en">English</option>
              <option value="es">Castellano</option>
            </select>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-none border border-zinc-700 bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white outline-none focus:border-[#ff9900]"
            >
              {CUR.map((c) => (
                <option key={c[0]} value={c[0]}>
                  {lang === "en" ? c[1] : c[2]}
                </option>
              ))}
            </select>

            <Button
              onClick={() => setInputs(DEF)}
              className="rounded-none border border-zinc-700 bg-black text-xs uppercase tracking-wider text-white hover:border-[#ff9900] hover:text-[#ff9900]"
            >
              {t.reset}
            </Button>

            <Button
              onClick={() => window.print()}
              className="rounded-none bg-[#ff9900] text-xs uppercase tracking-wider text-black hover:bg-[#ffb13b]"
            >
              {t.print}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-5">
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <Card
              key={k[0]}
              className={`rounded-none border-[#222] bg-[#050505] ${
                k[2] ? "border-[#ff9900]" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  {k[0]}
                </div>

                <div
     className={`mt-2 font-mono font-black tracking-[-0.04em] ${
  k[2] ? "text-3xl text-[#ff9900]" : "text-2xl text-white"
}`}
                >
                  {k[1]}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <Card className="rounded-none border-[#222] bg-[#050505]">
            <CardContent className="space-y-4 p-5">
              <h2 className="border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
                {t.inputs}
              </h2>

              <div className="grid grid-cols-1 gap-3">
                {fields.map((k) => (
                  <label key={k} className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {t[k]}
                    </span>

                    <input
                      type="number"
                      step={step(k)}
                      value={inputs[k]}
                      onChange={(e) => upd(k, e.target.value)}
                      className="w-full rounded-none border border-[#333] bg-black px-3 py-2 font-mono text-[#ff9900] outline-none focus:border-[#ff9900]"
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5 lg:col-span-2">
            <Card className="rounded-none border-[#222] bg-[#050505]">
              <CardContent className="p-5">
                <h2 className="mb-4 border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
                  {t.income}, {t.expenses} & {t.noi}
                </h2>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#222" />
                      <XAxis dataKey="year" {...axis} />
                      <YAxis {...axis} tickFormatter={(v) => sh(v, currency)} />
                      <Tooltip
                        formatter={(v) => fmt(v, currency)}
                        contentStyle={tooltip}
                      />
                      <Legend />
                      <Bar dataKey={t.income} fill="#00c853" />
                      <Bar dataKey={t.expenses} fill="#d50000" />
                      <Bar dataKey={t.noi} fill="#ff9900" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-[#222] bg-[#050505]">
              <CardContent className="p-5">
                <h2 className="mb-4 border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
                  {t.dcf}
                </h2>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#222" />
                      <XAxis dataKey="year" {...axis} />
                      <YAxis {...axis} tickFormatter={(v) => sh(v, currency)} />
                      <Tooltip
                        formatter={(v) => fmt(v, currency)}
                        contentStyle={tooltip}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={t.dcf}
                        stroke="#ff9900"
                        strokeWidth={3}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-none border-[#222] bg-[#050505]">
            <CardContent className="p-5">
              <h2 className="border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
                {t.sens}
              </h2>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="border border-[#222] bg-black p-2 text-left text-zinc-500">
                        Exit ↓ / Discount →
                      </th>
                      {sen.ds.map((d) => (
                        <th
                          key={d}
                          className="border border-[#222] bg-black p-2 text-[#ff9900]"
                        >
                          {d.toFixed(1)}%
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sen.table.map((r) => (
                      <tr key={r.e}>
                        <th className="border border-[#222] bg-black p-2 text-left text-[#ff9900]">
                          {r.e.toFixed(1)}%
                        </th>

                        {r.vals.map((v, i) => (
                          <td
                            key={i}
                            className={`border border-[#222] p-2 text-center font-bold ${color(
                              v
                            )}`}
                          >
                            {sh(v, currency)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-[#222] bg-[#050505]">
            <CardContent className="p-5">
              <h2 className="border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
                {t.drivers}
              </h2>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tor}
                    layout="vertical"
                    margin={{ left: 30, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#222" />
                    <XAxis
                      type="number"
                      {...axis}
                      tickFormatter={(v) => sh(v, currency)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={115}
                      {...axis}
                    />
                    <Tooltip
                      formatter={(v) => fmt(v, currency)}
                      contentStyle={tooltip}
                    />
                    <Legend />
                    <Bar dataKey="positive" name={t.up} fill="#ff9900" />
                    <Bar dataKey="negative" name={t.down} fill="#d50000" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-none border-[#222] bg-[#050505]">
          <CardContent className="overflow-x-auto p-5">
            <h2 className="mb-4 border-b border-[#222] pb-2 text-lg font-black uppercase tracking-[-0.02em] text-[#ff9900]">
              {t.table}
            </h2>

            <table className="w-full min-w-[900px] border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-[#222] bg-black text-left text-[#ff9900]">
                  <th className="p-2">{t.year}</th>
                  <th className="p-2">{t.income}</th>
                  <th className="p-2">{t.expenses}</th>
                  <th className="p-2">{t.noi}</th>
                  <th className="p-2">{t.terminal}</th>
                  <th className="p-2">{t.dcf}</th>
                </tr>
              </thead>

              <tbody>
                {res.rows.map((r) => (
                  <tr
                    key={r.year}
                    className="border-b border-[#111] text-zinc-300 hover:bg-zinc-950"
                  >
                    <td className="p-2">{r.year}</td>
                    <td className="p-2">{fmt(r.income, currency)}</td>
                    <td className="p-2">{fmt(r.expenses, currency)}</td>
                    <td className="p-2 font-bold text-[#ff9900]">
                      {fmt(r.noi, currency)}
                    </td>
                    <td className="p-2">{fmt(r.terminalValue, currency)}</td>
                    <td className="p-2">
                      {fmt(r.discountedCashFlow, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <footer className="mt-8 border-t border-[#222] pb-6 pt-6 text-center text-sm text-zinc-500">
          <p className="font-black uppercase tracking-wider text-zinc-300">
            Roberto Knop
          </p>

          <div className="mt-2 flex flex-wrap justify-center gap-4">
            <a
              href={`mailto:${CONTACT.email}`}
              className="hover:text-[#ff9900] hover:underline"
            >
              {CONTACT.email}
            </a>

            <a
              href={CONTACT.web}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ff9900] hover:underline"
            >
              www.knop.es
            </a>

            <a
              href={CONTACT.linkedin}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ff9900] hover:underline"
            >
              www.linkedin.com/in/RobertoKnop
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
