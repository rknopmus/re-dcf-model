import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Upload, Calculator, FileSpreadsheet } from "lucide-react";
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

const DEFAULT_INPUTS = {
  rentMonthM2: 26,
  meters: 85,
  inflationRate: 0.02945,
  capRate: 0.035,
  discountRate: 0.04,
  vacancyRate: 0,
  vacancyGrowth: 0,
  repairs: 400,
  repairsGrowth: 0,
  realEstateTaxRate: 0.004,
  taxGrowth: 0,
  insuranceRate: 0.001,
  insuranceGrowth: 0,
  hoa: 1800,
  hoaGrowth: 0,
  reserve: 500,
  reserveGrowth: 0,
};

function money(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function getCellNumber(sheet, address, fallback = 0) {
  const cell = sheet?.[address];
  if (!cell) return fallback;
  if (typeof cell.v === "number") return cell.v;
  const parsed = Number(cell.v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInputsFromWorkbook(workbook) {
  const sheet = workbook.Sheets.Inputs;
  if (!sheet) throw new Error("No se encontró la pestaña 'Inputs'.");

  return {
    rentMonthM2: getCellNumber(sheet, "B2", DEFAULT_INPUTS.rentMonthM2),
    meters: getCellNumber(sheet, "B4", DEFAULT_INPUTS.meters),
    inflationRate: getCellNumber(sheet, "B5", DEFAULT_INPUTS.inflationRate),
    capRate: getCellNumber(sheet, "B6", DEFAULT_INPUTS.capRate),
    discountRate: getCellNumber(sheet, "B7", DEFAULT_INPUTS.discountRate),
    vacancyRate: getCellNumber(sheet, "B8", DEFAULT_INPUTS.vacancyRate),
    vacancyGrowth: getCellNumber(sheet, "C8", DEFAULT_INPUTS.vacancyGrowth),
    repairs: getCellNumber(sheet, "B10", DEFAULT_INPUTS.repairs),
    repairsGrowth: getCellNumber(sheet, "C10", DEFAULT_INPUTS.repairsGrowth),
    realEstateTaxRate: getCellNumber(sheet, "B11", DEFAULT_INPUTS.realEstateTaxRate),
    taxGrowth: getCellNumber(sheet, "C11", DEFAULT_INPUTS.taxGrowth),
    insuranceRate: DEFAULT_INPUTS.insuranceRate,
    insuranceGrowth: getCellNumber(sheet, "C12", DEFAULT_INPUTS.insuranceGrowth),
    hoa: getCellNumber(sheet, "B13", DEFAULT_INPUTS.hoa),
    hoaGrowth: getCellNumber(sheet, "C13", DEFAULT_INPUTS.hoaGrowth),
    reserve: getCellNumber(sheet, "B14", DEFAULT_INPUTS.reserve),
    reserveGrowth: getCellNumber(sheet, "C14", DEFAULT_INPUTS.reserveGrowth),
  };
}

function calculateModel(inputs, years = 11, maxIter = 10000, tolerance = 1e-8) {
  let value = 0;
  let iteration = 0;

  const rows = Array.from({ length: years }, (_, i) => ({ year: i + 1 }));

  for (let i = 0; i < years; i++) {
    rows[i].rent =
      i === 0
        ? inputs.rentMonthM2 * inputs.meters * 12
        : rows[i - 1].rent * (1 + inputs.inflationRate);

    rows[i].vacancyRate =
      i === 0
        ? inputs.vacancyRate
        : rows[i - 1].vacancyRate * (1 + inputs.vacancyGrowth);

    rows[i].vacancyLoss = rows[i].rent * rows[i].vacancyRate;
    rows[i].income = rows[i].rent - rows[i].vacancyLoss;

    rows[i].hoa =
      i === 0 ? inputs.hoa : rows[i - 1].hoa * (1 + inputs.hoaGrowth);

    rows[i].reserve =
      i === 0
        ? inputs.reserve
        : rows[i - 1].reserve * (1 + inputs.reserveGrowth);
  }

  for (iteration = 1; iteration <= maxIter; iteration++) {
    const oldValue = value;

    for (let i = 0; i < years; i++) {
      rows[i].repairs =
        i === 0
          ? inputs.repairs
          : rows[i - 1].repairs * (1 + inputs.repairsGrowth);

      rows[i].taxes =
        i === 0
          ? inputs.realEstateTaxRate * oldValue
          : rows[i - 1].taxes * (1 + inputs.taxGrowth);

      rows[i].insurance =
        i === 0
          ? inputs.insuranceRate * oldValue
          : rows[i - 1].insurance * (1 + inputs.insuranceGrowth);

      rows[i].expenses =
        rows[i].repairs +
        rows[i].taxes +
        rows[i].insurance +
        rows[i].hoa +
        rows[i].reserve;

      rows[i].noi = rows[i].income - rows[i].expenses;
    }

    const terminalValue = rows[years - 1].noi / inputs.capRate;

    value = rows.reduce(
      (sum, row, i) => sum + row.noi / Math.pow(1 + inputs.discountRate, i + 1),
      0
    );

    value += terminalValue / Math.pow(1 + inputs.discountRate, years);

    if (Math.abs(value - oldValue) < tolerance) break;
  }

  const terminalValue = rows[years - 1].noi / inputs.capRate;

  rows.forEach((row, i) => {
    row.terminalValue = i === years - 1 ? terminalValue : 0;
    row.discountedCashFlow =
      (row.noi + row.terminalValue) /
      Math.pow(1 + inputs.discountRate, i + 1);
  });

  return { value, rows, iteration };
}

export default function App() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [fileName, setFileName] = useState("Modelo por defecto");
  const [error, setError] = useState("");

  const result = useMemo(() => calculateModel(inputs), [inputs]);

  async function handleFileUpload(event) {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellFormula: true });
      const loadedInputs = readInputsFromWorkbook(workbook);
      setInputs(loadedInputs);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || "Excel file unable to read.");
    }
  }

  function updateInput(key, value) {
    setInputs((current) => ({ ...current, [key]: Number(value) || 0 }));
  }

  const chartData = result.rows.map((row) => ({
    year: `Year ${row.year}`,
    Income: Math.round(row.income),
    Expenses: Math.round(row.expenses),
    NOI: Math.round(row.noi),
    DCF: Math.round(row.discountedCashFlow),
  }));

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">RE DCF Web App</h1>
            <p className="text-slate-600">
              Load the Excel file, read the Inputs sheet and calculate VALUE using circular iteration.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Upload RE_DCF.xlsx
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="h-4 w-4" /> Archivo
              </div>
              <div className="mt-2 truncate text-lg font-semibold">{fileName}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm md:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calculator className="h-4 w-4" /> VALUE / Model!H1
              </div>
              <div className="mt-2 text-4xl font-bold">{money(result.value)}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-slate-500">Iteraciones</div>
              <div className="mt-2 text-4xl font-bold">{result.iteration}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl shadow-sm lg:col-span-1">
            <CardContent className="space-y-4 p-5">
              <h2 className="text-xl font-semibold">Inputs</h2>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(inputs).map(([key, value]) => (
                  <label key={key} className="space-y-1" htmlFor={key}>
                    <span className="text-xs font-medium uppercase text-slate-500">
                      {key}
                    </span>
                    <input
                      id={key}
                      type="number"
                      step="0.0001"
                      value={value}
                      onChange={(e) => updateInput(key, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <h2 className="mb-4 text-xl font-semibold">
                  Income, Expenses y NOI
                </h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
<Bar dataKey="Income" fill="#3b82f6" />
<Bar dataKey="Expenses" fill="#ef4444" />
<Bar dataKey="NOI" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <h2 className="mb-4 text-xl font-semibold">DCF Waterfall</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="DCF" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="overflow-x-auto p-5">
            <h2 className="mb-4 text-xl font-semibold">Tabla del modelo</h2>
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="p-2">Year</th>
                  <th className="p-2">Total Annual Operating Income</th>
                  <th className="p-2">Total Annual Operating Expense</th>
                  <th className="p-2">Annual Net Operating Income</th>
                  <th className="p-2">Terminal Value</th>
                  <th className="p-2">Discounted Cash Flow</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.year} className="border-b hover:bg-slate-50">
                    <td className="p-2">{row.year}</td>
                    <td className="p-2">{money(row.income)}</td>
                    <td className="p-2">{money(row.expenses)}</td>
                    <td className="p-2 font-semibold">{money(row.noi)}</td>
                    <td className="p-2">{money(row.terminalValue)}</td>
                    <td className="p-2">{money(row.discountedCashFlow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => setInputs(DEFAULT_INPUTS)}>
            Restore inputs base
          </Button>
        </div>
      </div>
    </div>
  );
}
