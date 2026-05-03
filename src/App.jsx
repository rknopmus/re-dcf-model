import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Calculator, FileSpreadsheet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";

const DEFAULT_INPUTS = { rentMonthM2: 26, meters: 85, inflationRate: 0.02945, capRate: 0.035, discountRate: 0.04, vacancyRate: 0, vacancyGrowth: 0, repairs: 400, repairsGrowth: 0, realEstateTaxRate: 0.004, taxGrowth: 0, insuranceRate: 0.001, insuranceGrowth: 0, hoa: 1800, hoaGrowth: 0, reserve: 500, reserveGrowth: 0 };

function money(value){ if(!Number.isFinite(value))return "-"; return value.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}); }

function getCellNumber(sheet,address,fallback=0){const cell=sheet?.[address];if(!cell)return fallback;if(typeof cell.v==="number")return cell.v;const parsed=Number(cell.v);return Number.isFinite(parsed)?parsed:fallback;}

function readInputsFromWorkbook(workbook){const sheet=workbook.Sheets.Inputs;if(!sheet)throw new Error("No Inputs");return{rentMonthM2:getCellNumber(sheet,"B2"),meters:getCellNumber(sheet,"B3"),inflationRate:getCellNumber(sheet,"B4"),capRate:getCellNumber(sheet,"B5"),discountRate:getCellNumber(sheet,"B6"),vacancyRate:getCellNumber(sheet,"B7"),vacancyGrowth:getCellNumber(sheet,"C7"),repairs:getCellNumber(sheet,"B8"),repairsGrowth:getCellNumber(sheet,"C8"),realEstateTaxRate:getCellNumber(sheet,"B9"),taxGrowth:getCellNumber(sheet,"C9"),insuranceRate:0.001,insuranceGrowth:getCellNumber(sheet,"C10"),hoa:getCellNumber(sheet,"B11"),hoaGrowth:getCellNumber(sheet,"C11"),reserve:getCellNumber(sheet,"B12"),reserveGrowth:getCellNumber(sheet,"C12")};}

function calculateModel(inputs,years=10,maxIter=10000,tolerance=1e-8){let value=0;let iteration=0;const rows=Array.from({length:years},(_,i)=>({year:i+1}));
for(let i=0;i<years;i++){rows[i].rent=i===0?inputs.rentMonthM2*inputs.meters*12:rows[i-1].rent*(1+inputs.inflationRate);rows[i].vacancyRate=i===0?inputs.vacancyRate:rows[i-1].vacancyRate*(1+inputs.vacancyGrowth);rows[i].vacancyLoss=rows[i].rent*rows[i].vacancyRate;rows[i].income=rows[i].rent-rows[i].vacancyLoss;rows[i].hoa=i===0?inputs.hoa:rows[i-1].hoa*(1+inputs.hoaGrowth);rows[i].reserve=i===0?inputs.reserve:rows[i-1].reserve*(1+inputs.reserveGrowth);}
for(iteration=1;iteration<=maxIter;iteration++){const oldValue=value;for(let i=0;i<years;i++){rows[i].repairs=i===0?inputs.repairs:inputs.repairs*(1+inputs.repairsGrowth);rows[i].taxes=i===0?inputs.realEstateTaxRate*oldValue:inputs.realEstateTaxRate*oldValue*(1+inputs.taxGrowth);rows[i].insurance=i===0?inputs.insuranceRate*oldValue:inputs.insuranceRate*oldValue*(1+inputs.insuranceGrowth);rows[i].expenses=rows[i].repairs+rows[i].taxes+rows[i].insurance+rows[i].hoa+rows[i].reserve;rows[i].noi=rows[i].income-rows[i].expenses;}
const terminalValue=rows[years-1].noi/inputs.capRate;value=rows.reduce((s,r,i)=>s+r.noi/Math.pow(1+inputs.discountRate,i+1),0);value+=terminalValue/Math.pow(1+inputs.discountRate,years);if(Math.abs(value-oldValue)<tolerance)break;}
const terminalValue=rows[years-1].noi/inputs.capRate;rows.forEach((r,i)=>{r.terminalValue=i===years-1?terminalValue:0;r.discountedCashFlow=(r.noi+r.terminalValue)/Math.pow(1+inputs.discountRate,i+1);});return{value,rows,iteration};}

export default function App(){const[inputs,setInputs]=useState(DEFAULT_INPUTS);const[fileName,setFileName]=useState("Modelo");const[result]=[calculateModel(inputs)];
async function handleFileUpload(e){const file=e.target.files?.[0];if(!file)return;const buffer=await file.arrayBuffer();const wb=XLSX.read(buffer,{type:"array"});setInputs(readInputsFromWorkbook(wb));setFileName(file.name);}
const chartData=result.rows.map(r=>({year:`Year ${r.year}`,Income:Math.round(r.income),Expenses:Math.round(r.expenses),NOI:Math.round(r.noi)}));
return <div><h1>RE DCF</h1></div>}