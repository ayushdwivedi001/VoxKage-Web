import React from "react";
import { FlaskConical, Weight, Info } from "lucide-react";

interface ChemistryWidgetProps {
  compound: string;
  formula: string;
  weight: string;
  smiles: string;
}

export default function ChemistryWidget({ compound, formula, weight, smiles }: ChemistryWidgetProps) {
  const isWater =
    compound.toLowerCase() === "water" ||
    compound.toLowerCase() === "h2o" ||
    formula.toLowerCase() === "h2o" ||
    smiles.toLowerCase() === "o";

  // PubChem transparent PNG structure URL
  const structureImgUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compound)}/PNG`;

  return (
    <div className="w-full max-w-[540px] bg-[#0c0c0e]/95 border border-zinc-850/60 rounded-2xl p-4.5 flex flex-col gap-4 shadow-2xl select-text mx-auto my-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-850/60 pb-3 select-none">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-zinc-200 uppercase tracking-wide">{compound}</span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Chemical Anatomy</span>
          </div>
        </div>
      </div>

      {/* Grid Specifications */}
      <div className="grid grid-cols-2 gap-3.5 select-none">
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[9px] font-mono text-zinc-550 uppercase tracking-wider">Formula</span>
          <span className="text-[13px] font-semibold text-zinc-300 font-sans">{formula}</span>
        </div>
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[9px] font-mono text-zinc-550 uppercase tracking-wider flex items-center gap-1">
            <Weight className="w-3 h-3 text-zinc-550" />
            Mol. Weight
          </span>
          <span className="text-[13px] font-semibold text-zinc-300 font-mono">
            {weight === "Unknown" ? "18.015" : weight} g/mol
          </span>
        </div>
      </div>

      {/* High-Fidelity SVG Render for H2O Molecule */}
      {isWater ? (
        <div className="w-full bg-[#0e0e11] border border-zinc-900 rounded-xl flex items-center justify-center p-3 overflow-hidden select-none">
          <svg viewBox="0 0 500 320" className="w-full h-auto max-w-[460px]">
            {/* Covalent Bonds */}
            <line x1="250" y1="140" x2="170" y2="200" stroke="#3f3f46" strokeWidth="5.5" strokeLinecap="round" />
            <line x1="250" y1="140" x2="330" y2="200" stroke="#3f3f46" strokeWidth="5.5" strokeLinecap="round" />

            {/* 104.5° Arc Marker */}
            <path d="M 218 164 A 40 40 0 0 0 282 164" fill="none" stroke="#52525b" strokeWidth="1" strokeDasharray="2 2" />
            <text x="250" y="185" fill="#a1a1aa" fontSize="10.5" fontFamily="monospace" textAnchor="middle">104.5°</text>

            {/* Lone Pairs (dots on top of oxygen) */}
            <circle cx="230" cy="98" r="2.5" fill="#f43f5e" />
            <circle cx="238" cy="93" r="2.5" fill="#f43f5e" />

            <circle cx="262" cy="93" r="2.5" fill="#f43f5e" />
            <circle cx="270" cy="98" r="2.5" fill="#f43f5e" />

            {/* Oxygen (O) Center Atom */}
            <circle cx="250" cy="140" r="32" fill="#7f1d1d" stroke="#b91c1c" strokeWidth="2" />
            <text x="250" y="141" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">O</text>
            <text x="250" y="157" fill="#fca5a5" fontSize="10" fontFamily="sans-serif" textAnchor="middle">δ-</text>

            {/* Hydrogen (H1 - Left) Atom */}
            <circle cx="170" cy="200" r="20" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
            <text x="170" y="201" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">H</text>
            <text x="170" y="213" fill="#93c5fd" fontSize="8.5" fontFamily="sans-serif" textAnchor="middle">δ+</text>

            {/* Hydrogen (H2 - Right) Atom */}
            <circle cx="330" cy="200" r="20" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
            <text x="330" y="201" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">H</text>
            <text x="330" y="213" fill="#93c5fd" fontSize="8.5" fontFamily="sans-serif" textAnchor="middle">δ+</text>

            {/* --- Label Lines and Labels --- */}
            
            {/* Lone Pairs Label */}
            <line x1="250" y1="88" x2="250" y2="52" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />
            <text x="250" y="44" fill="#a1a1aa" fontSize="11" textAnchor="middle">Two lone electron pairs on oxygen</text>

            {/* Left Hydrogen Label */}
            <line x1="170" y1="176" x2="130" y2="120" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />
            <text x="125" y="112" fill="#d4d4d8" fontSize="11.5" fontWeight="semibold" textAnchor="end">Hydrogen atom</text>
            <text x="125" y="125" fill="#71717a" fontSize="10.5" textAnchor="end">(1 proton, 1 electron)</text>

            {/* Right Hydrogen Label */}
            <line x1="330" y1="176" x2="370" y2="120" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />
            <text x="375" y="112" fill="#d4d4d8" fontSize="11.5" fontWeight="semibold" textAnchor="start">Hydrogen atom</text>
            <text x="375" y="125" fill="#71717a" fontSize="10.5" textAnchor="start">(1 proton, 1 electron)</text>

            {/* Oxygen Label */}
            <line x1="250" y1="176" x2="250" y2="245" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />
            <text x="250" y="258" fill="#d4d4d8" fontSize="11.5" fontWeight="semibold" textAnchor="middle">Oxygen atom</text>
            <text x="250" y="271" fill="#71717a" fontSize="10.5" textAnchor="middle">(8 protons, pulls electrons closer)</text>

            {/* Conclusion Footer Label */}
            <text x="250" y="306" fill="#cc785c" fontSize="11.5" fontFamily="monospace" fontWeight="medium" textAnchor="middle">
              Bent shape + uneven charge = a polar molecule
            </text>
          </svg>
        </div>
      ) : (
        /* Molecular Image Skeleton Canvas for Generic Compounds */
        <div className="w-full h-[180px] bg-[#0e0e11] border border-zinc-900 rounded-xl flex items-center justify-center p-3 relative overflow-hidden select-none">
          <img
            src={structureImgUrl}
            alt={`${compound} skeletal structure`}
            className="max-h-full max-w-full object-contain filter invert opacity-85 hover:opacity-100 transition-opacity duration-200"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* SMILES details */}
      {smiles && smiles !== "Unknown" && smiles !== "0" && (
        <div className="bg-zinc-950/60 border border-zinc-850/60 p-2.5 rounded-xl flex flex-col gap-1 font-mono text-[10px] text-zinc-550 break-all select-all">
          <span className="text-[9px] uppercase tracking-wider text-zinc-650 flex items-center gap-1 font-sans select-none">
            <Info className="w-3 h-3 text-zinc-600" />
            Canonical SMILES
          </span>
          {smiles}
        </div>
      )}
    </div>
  );
}
