"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Scale, FileCheck, CheckCircle2 } from "lucide-react";

export default function TermsOfServicePage() {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains("light");
      setIsLightMode(isL);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`fixed inset-0 overflow-y-auto w-full transition-colors duration-300 ${
      isLightMode ? "bg-[#FAF9F5] text-[#141413]" : "bg-[#05050a] text-zinc-100"
    }`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-30 w-full border-b backdrop-blur-md transition-colors ${
        isLightMode ? "bg-[#FAF9F5]/80 border-[#ebe6df]" : "bg-[#05050a]/80 border-white/10"
      }`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              isLightMode ? "text-[#6c6a64] hover:text-[#141413]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to VoxKage</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#3A91EE]" />
            <span className="font-serif text-lg font-semibold tracking-tight">VoxKage</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 font-sans">
        <div className="flex flex-col gap-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#3A91EE]/10 text-[#3A91EE] w-fit">
            <span>Official Policy & Verification</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight">
            Terms of Service
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
            Last Updated: July 31, 2026. Please read these Terms of Service ("Terms") carefully before using the VoxKage AI platform ("VoxKage", "Service").
          </p>
        </div>

        {/* Highlighted Terms Summary Box */}
        <section className={`p-6 rounded-2xl border mb-12 transition-all ${
          isLightMode
            ? "bg-[#efe9de] border-[#c3c2b7] text-[#141413]"
            : "bg-gradient-to-br from-blue-950/30 to-indigo-950/20 border-blue-500/30 text-zinc-100"
        }`}>
          <div className="flex items-start gap-3.5 mb-3">
            <Scale className="w-5 h-5 text-[#3A91EE] flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-base font-bold font-serif mb-1">
                Agreement to Terms
              </h2>
              <p className={`text-sm leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
                By accessing or using VoxKage, connecting Google MCP tools, or creating an account, you agree to be bound by these Terms and our{" "}
                <Link href="/privacy" className="text-[#3A91EE] underline hover:opacity-80">
                  Privacy Policy
                </Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Terms Content Sections */}
        <div className="space-y-10">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#3A91EE]" />
              <span>1. Description of Service</span>
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              VoxKage is an AI web platform designed to assist developers and users with code execution, automated workflows, document analysis, and integrated MCP tools (such as Gmail, Google Drive, and Google Calendar).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              2. User Responsibilities & Acceptable Use
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              When using VoxKage, you agree to:
            </p>
            <ul className={`list-disc pl-6 space-y-2 text-sm leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
              <li>Maintain the security of your account credentials and connected API keys.</li>
              <li>Not use the Service for illegal activities, malicious code generation, spam, or unauthorized access to third-party systems.</li>
              <li>Respect rate limits and API terms of third-party providers connected via MCP.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              3. Third-Party Services & Google Integrations
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              VoxKage integrates with third-party services (such as Google APIs) via OAuth. You authorize VoxKage to interact with connected third-party APIs strictly on your behalf as instructed during interactive chat sessions. VoxKage is not responsible for availability or policies of third-party APIs.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              4. Disclaimer of Warranties & Limitation of Liability
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. AI-generated responses and suggestions should be reviewed before deployment. VoxKage shall not be liable for indirect, incidental, or consequential damages resulting from the use of the Service.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 border-t pt-8">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              5. Contact Us
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              If you have any questions regarding these Terms of Service, please contact:
            </p>
            <div className={`p-4 rounded-xl text-sm font-mono border ${isLightMode ? "bg-white border-[#ebe6df]" : "bg-zinc-900 border-white/10"}`}>
              <p>Developer: Ayush Dwivedi</p>
              <p>Email: ayushdwivedi2049@gmail.com</p>
              <p>Website: https://voxkage-ai.vercel.app</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-8 transition-colors ${
        isLightMode ? "border-[#ebe6df] text-[#6c6a64]" : "border-white/10 text-zinc-500"
      }`}>
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© 2026 VoxKage AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>
            <Link href="/terms" className="underline hover:opacity-80">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
