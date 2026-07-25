"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Calculator,
  DollarSign,
  Percent,
  CalendarRange,
  Binary,
  TrendingUp,
  Landmark,
  Scale,
  Delete,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
  History,
  X
} from "lucide-react";

interface CalculatorWidgetProps {
  type?: "loan" | "compound" | "tax" | "scientific";
  title?: string;
  isExpanded?: boolean;
}

export default function CalculatorWidget({
  type = "compound",
  title = "Financial & Engineering Calculator",
  isExpanded = false
}: CalculatorWidgetProps) {
  // Mode selection: "compound" | "loan" | "tax" | "scientific"
  const [mode, setMode] = useState<"compound" | "loan" | "tax" | "scientific">(type || "compound");

  // 1. Compound / Stock Parameters
  const [principalComp, setPrincipalComp] = useState<number>(10000);
  const [rateComp, setRateComp] = useState<number>(8.0);
  const [yearsComp, setYearsComp] = useState<number>(15);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(250);
  const [compFreq, setCompFreq] = useState<number>(12);

  // 2. Loan Parameters
  const [principalLoan, setPrincipalLoan] = useState<number>(250000);
  const [rateLoan, setRateLoan] = useState<number>(6.5);
  const [yearsLoan, setYearsLoan] = useState<number>(30);

  // 3. Tax Parameters
  const [income, setIncome] = useState<number>(90000);

  // 4. Scientific Pad Parameters
  const [sciExpr, setSciExpr] = useState<string>("");
  const [sciResult, setSciResult] = useState<string | null>(null);
  const [sciHistory, setSciHistory] = useState<{ expr: string; res: string }[]>([]);
  const [isRad, setIsRad] = useState<boolean>(true);
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Load persistent history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("voxkage_calculator_history");
      if (saved) {
        setSciHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load calculator history from storage:", e);
    }
  }, []);

  // Save history to localStorage on change
  useEffect(() => {
    if (sciHistory.length > 0) {
      try {
        localStorage.setItem("voxkage_calculator_history", JSON.stringify(sciHistory));
      } catch (e) {}
    }
  }, [sciHistory]);

  // --- Compound Calculations ---
  const compoundResults = useMemo(() => {
    const p = Math.max(0, principalComp);
    const r = Math.max(0, rateComp / 100);
    const t = Math.max(1, yearsComp);
    const m = Math.max(0, monthlyContribution);
    const n = compFreq;

    let balance = p;
    let totalInvested = p;

    const totalMonths = t * 12;
    const monthlyRate = r / n;

    for (let i = 1; i <= totalMonths; i++) {
      balance = balance * (1 + monthlyRate / (12 / n)) + m;
      totalInvested += m;
    }

    const totalInterest = Math.max(0, balance - totalInvested);
    const roi = totalInvested > 0 ? (totalInterest / totalInvested) * 100 : 0;
    const principalPct = balance > 0 ? Math.round((totalInvested / balance) * 100) : 50;
    const interestPct = 100 - principalPct;

    const milestoneYears = [1, 5, 10, 15, 20, 30].filter(y => y <= t);
    if (!milestoneYears.includes(t)) milestoneYears.push(t);

    const growthMilestones = milestoneYears.map(yr => {
      let b = p;
      let inv = p;
      const stepMonths = yr * 12;
      for (let i = 1; i <= stepMonths; i++) {
        b = b * (1 + monthlyRate / (12 / n)) + m;
        inv += m;
      }
      return { year: yr, balance: Math.round(b), invested: Math.round(inv), interest: Math.round(b - inv) };
    });

    return {
      accruedValue: isNaN(balance) ? 0 : balance,
      totalInvested: isNaN(totalInvested) ? 0 : totalInvested,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      roi,
      principalPct,
      interestPct,
      growthMilestones
    };
  }, [principalComp, rateComp, yearsComp, monthlyContribution, compFreq]);

  // --- Loan Calculations ---
  const loanResults = useMemo(() => {
    const p = Math.max(0, principalLoan);
    const r = (rateLoan / 100) / 12;
    const n = Math.max(1, yearsLoan * 12);
    if (r === 0) {
      const emi = p / n;
      return { monthly: emi, totalInterest: 0, totalPay: p, principalPct: 100, interestPct: 0 };
    }
    const monthlyPayment = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPay = monthlyPayment * n;
    const totalInterest = Math.max(0, totalPay - p);

    const principalPct = totalPay > 0 ? Math.round((p / totalPay) * 100) : 50;
    const interestPct = 100 - principalPct;

    return {
      monthly: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      totalPay: isNaN(totalPay) ? 0 : totalPay,
      principalPct,
      interestPct
    };
  }, [principalLoan, rateLoan, yearsLoan]);

  // --- Income Tax Calculations ---
  const taxResults = useMemo(() => {
    const brackets = [
      { cap: 11600, rate: 0.10, label: "10% Bracket ($0 - $11.6k)" },
      { cap: 47150, rate: 0.12, label: "12% Bracket ($11.6k - $47.1k)" },
      { cap: 100525, rate: 0.22, label: "22% Bracket ($47.1k - $100.5k)" },
      { cap: 191950, rate: 0.24, label: "24% Bracket ($100.5k - $191.9k)" },
      { cap: 243725, rate: 0.32, label: "32% Bracket ($191.9k - $243.7k)" },
      { cap: 609350, rate: 0.35, label: "35% Bracket ($243.7k - $609.3k)" },
      { cap: Infinity, rate: 0.37, label: "37% Bracket (Over $609.3k)" }
    ];
    let remaining = Math.max(0, income);
    let tax = 0;
    let prevCap = 0;

    const bracketBreakdown = brackets.map(b => {
      const range = b.cap - prevCap;
      let taxableInBracket = 0;
      if (remaining > range) {
        taxableInBracket = range;
        remaining -= range;
        prevCap = b.cap;
      } else if (remaining > 0) {
        taxableInBracket = remaining;
        remaining = 0;
      }
      const taxInBracket = taxableInBracket * b.rate;
      tax += taxInBracket;
      return {
        label: b.label,
        taxable: Math.round(taxableInBracket),
        tax: Math.round(taxInBracket),
        rate: b.rate * 100
      };
    }).filter(b => b.taxable > 0);

    const net = Math.max(0, income - tax);
    const monthlyNet = net / 12;
    const effRate = income > 0 ? (tax / income) * 100 : 0;

    return { tax, net, monthlyNet, effRate, bracketBreakdown };
  }, [income]);

  // --- Scientific Handlers (Auto-Reset on New Typing After =) ---
  const appendSci = useCallback((val: string) => {
    const isOperator = ["+", "-", "×", "÷", "^", "%"].includes(val);

    if (isEvaluated) {
      setIsEvaluated(false);
      if (isOperator && sciResult && sciResult !== "Error") {
        setSciExpr(sciResult + val);
      } else {
        setSciExpr(val);
      }
      setSciResult(null);
    } else {
      setSciExpr(prev => prev + val);
    }
  }, [isEvaluated, sciResult]);

  const clearSci = useCallback(() => {
    setSciExpr("");
    setSciResult(null);
    setIsEvaluated(false);
  }, []);

  const backspaceSci = useCallback(() => {
    setSciExpr(prev => prev.slice(0, -1));
    setIsEvaluated(false);
  }, []);

  const evaluateSci = useCallback(() => {
    if (!sciExpr) return;
    try {
      let sanitized = sciExpr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/g, "Math.PI")
        .replace(/e(?![a-zA-Z])/g, "Math.E")
        .replace(/√\(/g, "Math.sqrt(")
        .replace(/sin\(/g, isRad ? "Math.sin(" : "Math.sin((Math.PI/180)*")
        .replace(/cos\(/g, isRad ? "Math.cos(" : "Math.cos((Math.PI/180)*")
        .replace(/tan\(/g, isRad ? "Math.tan(" : "Math.tan((Math.PI/180)*")
        .replace(/log\(/g, "Math.log10(")
        .replace(/ln\(/g, "Math.log(")
        .replace(/\^/g, "**");

      sanitized = sanitized.replace(/(\d+)!/g, (_, num) => {
        let n = parseInt(num);
        let fact = 1;
        for (let i = 2; i <= n; i++) fact *= i;
        return fact.toString();
      });

      const res = Function(`"use strict"; return (${sanitized})`)();
      if (typeof res === "number" && !isNaN(res)) {
        const formattedRes = res % 1 === 0 ? res.toString() : res.toFixed(6).replace(/\.?0+$/, "");
        setSciResult(formattedRes);
        setIsEvaluated(true);
        setSciHistory(prev => [{ expr: sciExpr, res: formattedRes }, ...prev.slice(0, 14)]);
      } else {
        setSciResult("Error");
        setIsEvaluated(true);
      }
    } catch {
      setSciResult("Error");
      setIsEvaluated(true);
    }
  }, [sciExpr, isRad]);

  // Keyboard navigation for Scientific Pad
  useEffect(() => {
    if (mode !== "scientific") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= "0" && e.key <= "9") appendSci(e.key);
      else if (e.key === ".") appendSci(".");
      else if (e.key === "+") appendSci("+");
      else if (e.key === "-") appendSci("-");
      else if (e.key === "*") appendSci("×");
      else if (e.key === "/") {
        e.preventDefault();
        appendSci("÷");
      }
      else if (e.key === "(" || e.key === ")") appendSci(e.key);
      else if (e.key === "^") appendSci("^");
      else if (e.key === "%") appendSci("%");
      else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        evaluateSci();
      }
      else if (e.key === "Backspace") {
        e.preventDefault();
        backspaceSci();
      }
      else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        clearSci();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, appendSci, evaluateSci, backspaceSci, clearSci]);

  return (
    <div className={`relative w-full max-w-full overflow-hidden mx-auto bg-[#0c0c0e]/90 [.light_&]:bg-[#faf9f5] border border-zinc-850/60 [.light_&]:border-[#e6dfd8] rounded-2xl p-4 sm:p-6 shadow-2xl [.light_&]:shadow-xl flex flex-col justify-between select-none transition-all duration-300 ${
      isExpanded ? "h-[85vh] my-0 p-6 sm:p-8 flex flex-col" : "h-[540px] sm:h-[580px] my-3"
    }`}>
      {/* --- TOP HEADER BAR --- */}
      <div className="flex flex-col gap-3 pb-3 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] shrink-0">
        <div className="flex items-center justify-between gap-3 select-text">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-sky-500 [.light_&]:text-sky-600 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-mono tracking-wider uppercase font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">
                Financial & Engineering Suite
              </span>
              <h4 className="text-zinc-100 [.light_&]:text-[#141413] font-serif text-base sm:text-lg md:text-xl font-normal tracking-tight truncate">
                {title}
              </h4>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1 pb-0.5 select-none">
          <button
            type="button"
            onClick={() => setMode("compound")}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              mode === "compound"
                ? "bg-sky-600 text-white [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] shadow-md font-semibold"
                : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Investment APY
          </button>

          <button
            type="button"
            onClick={() => setMode("loan")}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              mode === "loan"
                ? "bg-sky-600 text-white [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] shadow-md font-semibold"
                : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            Loan EMI
          </button>

          <button
            type="button"
            onClick={() => setMode("tax")}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              mode === "tax"
                ? "bg-sky-600 text-white [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] shadow-md font-semibold"
                : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Income Tax
          </button>

          <button
            type="button"
            onClick={() => setMode("scientific")}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              mode === "scientific"
                ? "bg-sky-600 text-white [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] shadow-md font-semibold"
                : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            Scientific Pad
          </button>
        </div>
      </div>

      {/* --- SCROLLABLE / EXPANDED CONTENT BODY AREA --- */}
      <div className={`flex-1 w-full min-h-0 relative overflow-y-auto custom-scrollbar pt-3 ${
        isExpanded ? "h-full flex flex-col" : ""
      }`}>
        {/* --- 1. COMPOUND INTEREST / STOCK INVESTMENT MODE --- */}
        {mode === "compound" && (
          <div className={`flex flex-col gap-4 ${isExpanded ? "h-full justify-between" : ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-sky-500" /> Initial Deposit</span>
                  <input
                    type="number"
                    value={principalComp}
                    onChange={e => setPrincipalComp(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-28 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="250000"
                  step="1000"
                  value={principalComp}
                  onChange={e => setPrincipalComp(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-sky-500" /> Monthly Contribution</span>
                  <input
                    type="number"
                    value={monthlyContribution}
                    onChange={e => setMonthlyContribution(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-24 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={monthlyContribution}
                  onChange={e => setMonthlyContribution(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span className="flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-sky-500" /> Expected APY Rate</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={rateComp}
                      onChange={e => setRateComp(Number(e.target.value))}
                      className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-20 text-right font-semibold"
                    />
                    <span className="text-xs font-mono text-zinc-400">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={rateComp}
                  onChange={e => setRateComp(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span className="flex items-center gap-1"><CalendarRange className="w-3.5 h-3.5 text-sky-500" /> Time Horizon (Yrs)</span>
                  <input
                    type="number"
                    value={yearsComp}
                    onChange={e => setYearsComp(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-20 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="1"
                  value={yearsComp}
                  onChange={e => setYearsComp(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* Results Display Card */}
            <div className="bg-zinc-900/90 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] rounded-xl p-4 flex flex-col gap-3 shadow-md">
              <div className="flex justify-between items-center border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-2">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">Projected Future Balance</span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-sky-400 [.light_&]:text-[#141413]">
                    ${Math.round(compoundResults.accruedValue).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-mono text-zinc-500">Overall ROI</span>
                  <span className="text-sm font-semibold font-mono text-emerald-400 [.light_&]:text-emerald-700 bg-emerald-500/10 [.light_&]:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/30">
                    +{compoundResults.roi.toFixed(1)}% ROI
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span>Principal: ${Math.round(compoundResults.totalInvested).toLocaleString()} ({compoundResults.principalPct}%)</span>
                  <span>Interest: ${Math.round(compoundResults.totalInterest).toLocaleString()} ({compoundResults.interestPct}%)</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-950 [.light_&]:bg-[#faf9f5] rounded-full overflow-hidden flex border border-zinc-800 [.light_&]:border-[#c3c2b7]">
                  <div style={{ width: `${compoundResults.principalPct}%` }} className="bg-sky-500 h-full" />
                  <div style={{ width: `${compoundResults.interestPct}%` }} className="bg-emerald-400 [.light_&]:bg-emerald-600 h-full" />
                </div>
              </div>
            </div>

            {/* Growth Milestone Table */}
            <div className={`bg-zinc-900/60 [.light_&]:bg-[#efe9de]/60 border border-zinc-800/80 [.light_&]:border-[#c3c2b7] rounded-xl p-3 flex flex-col gap-2 ${
              isExpanded ? "flex-1 min-h-[220px]" : ""
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64] border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-1.5">
                <TableIcon className="w-3.5 h-3.5 text-sky-500" />
                <span>Compounding Milestone Growth Table</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] font-mono font-semibold text-zinc-400 [.light_&]:text-[#6c6a64] px-1">
                <span>Timeline</span>
                <span className="text-right">Invested</span>
                <span className="text-right">Interest</span>
                <span className="text-right">Total Balance</span>
              </div>
              <div className={`flex flex-col gap-1 overflow-y-auto custom-scrollbar ${isExpanded ? "flex-1" : "max-h-36"}`}>
                {compoundResults.growthMilestones.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 text-[11.5px] font-mono text-zinc-200 [.light_&]:text-[#141413] px-1 py-1.5 rounded bg-zinc-950/40 [.light_&]:bg-[#faf9f5]">
                    <span className="font-semibold">Year {m.year}</span>
                    <span className="text-right text-zinc-400 [.light_&]:text-[#6c6a64]">${m.invested.toLocaleString()}</span>
                    <span className="text-right text-emerald-400 [.light_&]:text-emerald-700">+${m.interest.toLocaleString()}</span>
                    <span className="text-right font-bold text-sky-400 [.light_&]:text-[#141413]">${m.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 2. LOAN & MORTGAGE EMI MODE --- */}
        {mode === "loan" && (
          <div className={`flex flex-col gap-4 ${isExpanded ? "h-full justify-between" : ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span>Principal</span>
                  <input
                    type="number"
                    value={principalLoan}
                    onChange={e => setPrincipalLoan(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-28 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="10000"
                  max="1000000"
                  step="5000"
                  value={principalLoan}
                  onChange={e => setPrincipalLoan(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span>Interest Rate %</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rateLoan}
                    onChange={e => setRateLoan(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-20 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.1"
                  value={rateLoan}
                  onChange={e => setRateLoan(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70">
                <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span>Tenure (Yrs)</span>
                  <input
                    type="number"
                    value={yearsLoan}
                    onChange={e => setYearsLoan(Number(e.target.value))}
                    className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2 py-0.5 rounded-md font-mono text-xs w-20 text-right font-semibold"
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="35"
                  step="1"
                  value={yearsLoan}
                  onChange={e => setYearsLoan(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            <div className={`bg-zinc-900/90 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] rounded-xl p-4 flex flex-col gap-4 shadow-md ${
              isExpanded ? "flex-1 justify-around" : ""
            }`}>
              <div className="flex justify-between items-center border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-3">
                <span className="text-xs font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">Monthly EMI Repayment</span>
                <span className="text-2xl sm:text-4xl font-bold font-mono text-sky-400 [.light_&]:text-[#141413]">
                  ${Math.round(loanResults.monthly).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-zinc-400 [.light_&]:text-[#6c6a64]">Total Interest Payable</span>
                  <span className="text-base font-semibold text-zinc-100 [.light_&]:text-[#141413]">
                    ${Math.round(loanResults.totalInterest).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-400 [.light_&]:text-[#6c6a64]">Total Payback Outflow</span>
                  <span className="text-base font-semibold text-zinc-100 [.light_&]:text-[#141413]">
                    ${Math.round(loanResults.totalPay).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                  <span>Principal Loan: {loanResults.principalPct}%</span>
                  <span>Interest Cost: {loanResults.interestPct}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-950 [.light_&]:bg-[#faf9f5] rounded-full overflow-hidden flex border border-zinc-800 [.light_&]:border-[#c3c2b7]">
                  <div style={{ width: `${loanResults.principalPct}%` }} className="bg-sky-500 h-full" />
                  <div style={{ width: `${loanResults.interestPct}%` }} className="bg-rose-450 [.light_&]:bg-rose-600 h-full" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 3. INCOME TAX MODE --- */}
        {mode === "tax" && (
          <div className={`flex flex-col gap-4 ${isExpanded ? "h-full justify-between" : ""}`}>
            <div className="bg-zinc-900/40 [.light_&]:bg-[#efe9de]/50 p-3 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7]/70 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                <span>Gross Annual Salary / Income</span>
                <input
                  type="number"
                  value={income}
                  onChange={e => setIncome(Number(e.target.value))}
                  className="bg-zinc-900 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-100 [.light_&]:text-[#141413] px-2.5 py-0.5 rounded-md font-mono text-xs w-32 text-right font-semibold"
                />
              </div>
              <input
                type="range"
                min="10000"
                max="500000"
                step="5000"
                value={income}
                onChange={e => setIncome(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 [.light_&]:bg-[#c3c2b7] rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="bg-zinc-900/90 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] rounded-xl p-4 flex flex-col gap-3 shadow-md">
              <div className="flex justify-between items-center border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-2">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">Estimated Take-Home Annual Net</span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 [.light_&]:text-emerald-700">
                    ${Math.round(taxResults.net).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-mono text-zinc-500">Monthly Net</span>
                  <span className="text-sm font-semibold font-mono text-zinc-100 [.light_&]:text-[#141413]">
                    ${Math.round(taxResults.monthlyNet).toLocaleString()}/mo
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-zinc-400 [.light_&]:text-[#6c6a64]">Total Tax Liability</span>
                  <span className="text-sm font-semibold text-zinc-100 [.light_&]:text-[#141413]">
                    ${Math.round(taxResults.tax).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-400 [.light_&]:text-[#6c6a64]">Effective Tax Rate</span>
                  <span className="text-sm font-semibold text-sky-400 [.light_&]:text-sky-700">
                    {taxResults.effRate.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className={`bg-zinc-900/60 [.light_&]:bg-[#efe9de]/60 border border-zinc-800/80 [.light_&]:border-[#c3c2b7] rounded-xl p-3 flex flex-col gap-2 ${
              isExpanded ? "flex-1 min-h-[220px]" : ""
            }`}>
              <span className="text-xs font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64] border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-1.5">
                Progressive Tax Bracket Breakdown Table
              </span>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono font-semibold text-zinc-400 [.light_&]:text-[#6c6a64] px-1">
                <span>Tax Bracket</span>
                <span className="text-right">Taxable Income</span>
                <span className="text-right">Tax Paid</span>
              </div>
              <div className={`flex flex-col gap-1 overflow-y-auto custom-scrollbar ${isExpanded ? "flex-1" : "max-h-32"}`}>
                {taxResults.bracketBreakdown.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 text-[11.5px] font-mono text-zinc-200 [.light_&]:text-[#141413] px-1 py-1.5 rounded bg-zinc-950/40 [.light_&]:bg-[#faf9f5]">
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-right text-zinc-400 [.light_&]:text-[#6c6a64]">${b.taxable.toLocaleString()}</span>
                    <span className="text-right font-bold text-sky-400 [.light_&]:text-[#141413]">${b.tax.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 4. SCIENTIFIC CALCULATOR PAD MODE --- */}
        {mode === "scientific" && (
          <div className={`relative w-full ${isExpanded ? "h-full flex-1 flex flex-col" : "h-full flex flex-col"}`}>
            {/* Non-Expanded History Overlay Drawer */}
            {!isExpanded && showHistoryDrawer && (
              <div className="absolute inset-0 z-20 bg-zinc-950/95 [.light_&]:bg-[#faf9f5]/95 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 border border-zinc-800 [.light_&]:border-[#c3c2b7] animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-2">
                  <span className="text-xs font-mono font-semibold text-zinc-200 [.light_&]:text-[#141413] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-sky-500" /> Session Calculation History ({sciHistory.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHistoryDrawer(false)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
                  {sciHistory.length === 0 ? (
                    <span className="text-xs font-mono text-zinc-500 italic p-3 text-center">No calculations in this session yet.</span>
                  ) : (
                    sciHistory.map((h, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSciExpr(h.expr);
                          setShowHistoryDrawer(false);
                        }}
                        className="flex flex-col gap-0.5 p-2 rounded-lg bg-zinc-900/80 [.light_&]:bg-[#efe9de] hover:border-sky-500 border border-transparent cursor-pointer transition-all"
                      >
                        <span className="text-[11px] font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">{h.expr}</span>
                        <span className="text-sm font-bold font-mono text-sky-400 [.light_&]:text-[#141413]">= {h.res}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className={`flex flex-col ${isExpanded ? "md:flex-row gap-6 items-stretch h-full flex-1" : "gap-3 max-w-xl mx-auto"}`}>
              {/* Expanded Left Side: Persistent History Log (Fills Vertical Height!) */}
              {isExpanded && (
                <div className="w-full md:w-1/3 flex flex-col gap-2 bg-zinc-900/60 [.light_&]:bg-[#efe9de]/60 border border-zinc-800 [.light_&]:border-[#c3c2b7] p-4 rounded-xl h-full flex-1">
                  <span className="text-xs font-mono font-semibold text-zinc-400 [.light_&]:text-[#6c6a64] border-b border-zinc-800 [.light_&]:border-[#c3c2b7] pb-2 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-sky-500" /> Session History ({sciHistory.length})
                  </span>
                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {sciHistory.length === 0 ? (
                      <span className="text-xs font-mono text-zinc-500 italic p-2">No past calculations in this session yet.</span>
                    ) : (
                      sciHistory.map((h, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSciExpr(h.expr)}
                          className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-950/50 [.light_&]:bg-[#faf9f5] hover:border-sky-500 border border-transparent cursor-pointer transition-all select-text"
                        >
                          <span className="text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">{h.expr}</span>
                          <span className="text-base font-bold font-mono text-sky-400 [.light_&]:text-[#141413]">= {h.res}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Keypad Container (Stretches Vertically in Expanded Mode!) */}
              <div className={`flex flex-col justify-between ${isExpanded ? "w-full md:w-2/3 h-full flex-1 gap-4" : "w-full gap-2.5"}`}>
                {/* Digital Display Screen */}
                <div className={`bg-zinc-950 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] rounded-xl flex flex-col justify-center items-end select-text shadow-inner ${
                  isExpanded ? "p-5 min-h-[90px]" : "p-3"
                }`}>
                  <div className="text-xs font-mono text-zinc-500 [.light_&]:text-[#6c6a64] h-5 overflow-x-auto custom-scrollbar w-full text-right">
                    {sciExpr || "0"}
                  </div>
                  <div className={`font-bold font-mono text-zinc-100 [.light_&]:text-[#141413] ${
                    isExpanded ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
                  }`}>
                    {sciResult !== null ? `= ${sciResult}` : sciExpr ? "" : "0"}
                  </div>
                </div>

                {/* RAD/DEG Unit Toggle & Non-expanded History Drawer Button */}
                <div className="flex items-center justify-between text-[11px] font-mono px-1 select-none shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRad(!isRad)}
                      className="px-2.5 py-0.5 rounded-md bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] hover:border-sky-500 transition-all cursor-pointer"
                    >
                      Unit: <span className="font-bold text-sky-400">{isRad ? "RAD" : "DEG"}</span>
                    </button>

                    {!isExpanded && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryDrawer(true)}
                        className="px-2.5 py-0.5 rounded-md bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] hover:border-sky-500 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3 text-sky-500" />
                        <span>History ({sciHistory.length})</span>
                      </button>
                    )}
                  </div>

                  <span className="text-zinc-400 [.light_&]:text-[#6c6a64] text-[10.5px] hidden sm:inline">
                    Auto-resets on new typing after =
                  </span>
                </div>

                {/* 5-Column Keypad Grid (Stretches cleanly in Expanded Mode!) */}
                <div className={`grid grid-cols-5 gap-2 select-none font-mono ${
                  isExpanded ? "flex-1 grid-rows-6" : "text-xs"
                }`}>
                  {/* Row 1: Trig */}
                  <button type="button" onClick={() => appendSci("sin(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>sin</button>
                  <button type="button" onClick={() => appendSci("cos(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>cos</button>
                  <button type="button" onClick={() => appendSci("tan(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>tan</button>
                  <button type="button" onClick={() => appendSci("ln(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>ln</button>
                  <button type="button" onClick={clearSci} className={`rounded-xl bg-rose-950/60 [.light_&]:bg-rose-100 border border-rose-800/60 [.light_&]:border-rose-300 text-rose-400 [.light_&]:text-rose-700 font-bold hover:bg-rose-900/60 cursor-pointer flex items-center justify-center ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>AC</button>

                  {/* Row 2: Powers & Roots */}
                  <button type="button" onClick={() => appendSci("^")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>x^y</button>
                  <button type="button" onClick={() => appendSci("√(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>√</button>
                  <button type="button" onClick={() => appendSci("π")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>π</button>
                  <button type="button" onClick={() => appendSci("e")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-800 cursor-pointer flex items-center justify-center font-medium ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}>e</button>
                  <button type="button" onClick={backspaceSci} className={`rounded-xl bg-zinc-800 [.light_&]:bg-[#c3c2b7] border border-zinc-700 text-zinc-200 [.light_&]:text-[#141413] hover:bg-zinc-700 flex items-center justify-center cursor-pointer ${isExpanded ? "text-base font-semibold" : "p-2.5 text-xs"}`}><Delete className={isExpanded ? "w-5 h-5" : "w-3.5 h-3.5"} /></button>

                  {/* Row 3: 7 8 9 ÷ ( */}
                  <button type="button" onClick={() => appendSci("7")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>7</button>
                  <button type="button" onClick={() => appendSci("8")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>8</button>
                  <button type="button" onClick={() => appendSci("9")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>9</button>
                  <button type="button" onClick={() => appendSci("÷")} className={`rounded-xl bg-sky-950/50 [.light_&]:bg-sky-100 border border-sky-800/50 [.light_&]:border-sky-300 text-sky-400 [.light_&]:text-sky-700 font-bold cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>÷</button>
                  <button type="button" onClick={() => appendSci("(")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] cursor-pointer flex items-center justify-center ${isExpanded ? "text-base font-semibold" : "p-3 text-xs"}`}>(</button>

                  {/* Row 4: 4 5 6 × ) */}
                  <button type="button" onClick={() => appendSci("4")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>4</button>
                  <button type="button" onClick={() => appendSci("5")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>5</button>
                  <button type="button" onClick={() => appendSci("6")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>6</button>
                  <button type="button" onClick={() => appendSci("×")} className={`rounded-xl bg-sky-950/50 [.light_&]:bg-sky-100 border border-sky-800/50 [.light_&]:border-sky-300 text-sky-400 [.light_&]:text-sky-700 font-bold cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>×</button>
                  <button type="button" onClick={() => appendSci(")")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] cursor-pointer flex items-center justify-center ${isExpanded ? "text-base font-semibold" : "p-3 text-xs"}`}>)</button>

                  {/* Row 5: 1 2 3 - n! */}
                  <button type="button" onClick={() => appendSci("1")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>1</button>
                  <button type="button" onClick={() => appendSci("2")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>2</button>
                  <button type="button" onClick={() => appendSci("3")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>3</button>
                  <button type="button" onClick={() => appendSci("-")} className={`rounded-xl bg-sky-950/50 [.light_&]:bg-sky-100 border border-sky-800/50 [.light_&]:border-sky-300 text-sky-400 [.light_&]:text-sky-700 font-bold cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>-</button>
                  <button type="button" onClick={() => appendSci("!")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] cursor-pointer flex items-center justify-center ${isExpanded ? "text-base font-semibold" : "p-3 text-xs"}`}>n!</button>

                  {/* Row 6: 0 . % + = */}
                  <button type="button" onClick={() => appendSci("0")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>0</button>
                  <button type="button" onClick={() => appendSci(".")} className={`rounded-xl bg-zinc-900/80 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#c3c2b7] font-semibold text-zinc-100 [.light_&]:text-[#141413] hover:border-sky-500 cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>.</button>
                  <button type="button" onClick={() => appendSci("%")} className={`rounded-xl bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413] cursor-pointer flex items-center justify-center ${isExpanded ? "text-base font-semibold" : "p-3 text-xs"}`}>%</button>
                  <button type="button" onClick={() => appendSci("+")} className={`rounded-xl bg-sky-950/50 [.light_&]:bg-sky-100 border border-sky-800/50 [.light_&]:border-sky-300 text-sky-400 [.light_&]:text-sky-700 font-bold cursor-pointer flex items-center justify-center ${isExpanded ? "text-lg" : "p-3 text-xs"}`}>+</button>
                  <button type="button" onClick={evaluateSci} className={`rounded-xl bg-sky-600 hover:bg-sky-700 font-bold text-white shadow-md cursor-pointer flex items-center justify-center ${isExpanded ? "text-xl font-extrabold" : "p-3 text-xs"}`}>=</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
