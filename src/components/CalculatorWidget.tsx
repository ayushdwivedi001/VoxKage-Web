import React, { useState, useMemo } from "react";
import { DollarSign, Percent, CalendarRange, Calculator } from "lucide-react";

interface CalculatorWidgetProps {
  type: "loan" | "compound" | "tax";
  title: string;
}

export default function CalculatorWidget({ type, title }: CalculatorWidgetProps) {
  // 1. Loan Parameters
  const [principal, setPrincipal] = useState(250000);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);

  // 2. Compound Parameters
  const [principalComp, setPrincipalComp] = useState(10000);
  const [rateComp, setRateComp] = useState(8.0);
  const [yearsComp, setYearsComp] = useState(15);
  const [monthlyContribution, setMonthlyContribution] = useState(200);

  // 3. Tax Parameters
  const [income, setIncome] = useState(90000);

  // Loan Calculation
  const loanResults = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    if (r === 0) {
      const p = principal / n;
      return { monthly: p, totalInterest: 0, totalPay: principal };
    }
    const monthlyPayment = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPay = monthlyPayment * n;
    const totalInterest = totalPay - principal;
    return {
      monthly: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      totalPay: isNaN(totalPay) ? 0 : totalPay
    };
  }, [principal, rate, years]);

  // Compound Calculation
  const compoundResults = useMemo(() => {
    const p = principalComp;
    const r = rateComp / 100 / 12;
    const n = yearsComp * 12;
    let balance = p;
    let totalInvested = p;

    for (let i = 0; i < n; i++) {
      balance = balance * (1 + r) + monthlyContribution;
      totalInvested += monthlyContribution;
    }
    const totalInterest = balance - totalInvested;
    return {
      accruedValue: isNaN(balance) ? 0 : balance,
      totalInvested: isNaN(totalInvested) ? 0 : totalInvested,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest
    };
  }, [principalComp, rateComp, yearsComp, monthlyContribution]);

  // Simple Income Tax Calculation (Curated standard US 2026 progressive bracket logic)
  const taxResults = useMemo(() => {
    const brackets = [
      { cap: 11600, rate: 0.10 },
      { cap: 47150, rate: 0.12 },
      { cap: 100525, rate: 0.22 },
      { cap: 191950, rate: 0.24 },
      { cap: 243725, rate: 0.32 },
      { cap: 609350, rate: 0.35 },
      { cap: Infinity, rate: 0.37 }
    ];
    let remaining = income;
    let tax = 0;
    let prev = 0;

    for (const b of brackets) {
      const range = b.cap - prev;
      if (remaining > range) {
        tax += range * b.rate;
        remaining -= range;
        prev = b.cap;
      } else {
        tax += remaining * b.rate;
        break;
      }
    }
    const net = income - tax;
    const effRate = income > 0 ? (tax / income) * 100 : 0;
    return { tax, net, effRate };
  }, [income]);

  return (
    <div className="w-full max-w-[500px] bg-[#0c0c0e]/95 border border-zinc-850/60 rounded-2xl p-4.5 flex flex-col gap-4.5 shadow-2xl mx-auto my-3 select-none">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
        <Calculator className="w-4 h-4 text-emerald-400" />
        <span className="text-[13.5px] font-semibold text-zinc-300 font-sans tracking-wide">
          {title}
        </span>
      </div>

      {/* --- Loan Amortization Mode --- */}
      {type === "loan" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5">
            {/* Principal Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Principal</span>
                <span className="font-semibold text-zinc-250">${principal.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="5000"
                value={principal}
                onChange={e => setPrincipal(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Rate Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Interest Rate</span>
                <span className="font-semibold text-zinc-250">{rate.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.1"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Tenure Years Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" /> Duration</span>
                <span className="font-semibold text-zinc-250">{years} Years</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={years}
                onChange={e => setYears(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <span className="text-[11px] font-mono text-zinc-550">Monthly Repayment</span>
              <span className="text-[17px] font-bold text-emerald-400 font-mono">${Math.round(loanResults.monthly).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-zinc-500">
              <div className="flex flex-col">
                <span>Total Interest</span>
                <span className="text-[12px] font-semibold text-zinc-300">${Math.round(loanResults.totalInterest).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span>Total Payback</span>
                <span className="text-[12px] font-semibold text-zinc-300">${Math.round(loanResults.totalPay).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Compound Interest Mode --- */}
      {type === "compound" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5">
            {/* Principal Comp Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Initial Deposit</span>
                <span className="font-semibold text-zinc-250">${principalComp.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="250000"
                step="1000"
                value={principalComp}
                onChange={e => setPrincipalComp(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Monthly Contribution Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Monthly Contribution</span>
                <span className="font-semibold text-zinc-250">${monthlyContribution.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={monthlyContribution}
                onChange={e => setMonthlyContribution(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Rate Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Expected APY</span>
                <span className="font-semibold text-zinc-250">{rateComp.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={rateComp}
                onChange={e => setRateComp(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Years Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" /> Years Horizon</span>
                <span className="font-semibold text-zinc-250">{yearsComp} Years</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                step="1"
                value={yearsComp}
                onChange={e => setYearsComp(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <span className="text-[11px] font-mono text-zinc-550">Future Balance</span>
              <span className="text-[17px] font-bold text-emerald-400 font-mono">${Math.round(compoundResults.accruedValue).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-zinc-500">
              <div className="flex flex-col">
                <span>Principal Invested</span>
                <span className="text-[12px] font-semibold text-zinc-300">${Math.round(compoundResults.totalInvested).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span>Interest Gained</span>
                <span className="text-[12px] font-semibold text-zinc-300">${Math.round(compoundResults.totalInterest).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Simple Income Tax Mode --- */}
      {type === "tax" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5">
            {/* Income Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-450">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Gross Income</span>
                <span className="font-semibold text-zinc-250">${income.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="5000"
                max="500000"
                step="5000"
                value={income}
                onChange={e => setIncome(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <span className="text-[11px] font-mono text-zinc-550">Take Home Net</span>
              <span className="text-[17px] font-bold text-emerald-400 font-mono">${Math.round(taxResults.net).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-zinc-500">
              <div className="flex flex-col">
                <span>Income Tax Estimated</span>
                <span className="text-[12px] font-semibold text-zinc-300">${Math.round(taxResults.tax).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span>Effective Tax Rate</span>
                <span className="text-[12px] font-semibold text-zinc-300">{taxResults.effRate.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
