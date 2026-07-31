"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText, CheckCircle2 } from "lucide-react";

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
            Last Updated: July 31, 2026. This Privacy Policy details how VoxKage AI ("VoxKage", "we", "our") collects, uses, protects, and handles your personal information and Google User Data.
          </p>
        </div>

        {/* Highlighted Google Limited Use Disclosure Box */}
        <section className={`p-6 rounded-2xl border mb-12 transition-all ${
          isLightMode
            ? "bg-[#efe9de] border-[#c3c2b7] text-[#141413]"
            : "bg-gradient-to-br from-blue-950/30 to-indigo-950/20 border-blue-500/30 text-zinc-100"
        }`}>
          <div className="flex items-start gap-3.5 mb-3">
            <Lock className="w-5 h-5 text-[#3A91EE] flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-base font-bold font-serif mb-1">
                Google API Services User Data Policy & Limited Use Disclosure
              </h2>
              <p className={`text-sm leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
                VoxKage's use and transfer to any other app of information received from Google APIs will strictly adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3A91EE] underline hover:opacity-80"
                >
                  Google API Services User Data Policy
                </a>
                , including the <strong>Limited Use requirements</strong>.
              </p>
            </div>
          </div>
          <ul className={`mt-4 space-y-2 text-xs sm:text-sm border-t pt-4 ${isLightMode ? "border-[#c3c2b7]/60 text-[#3d3d3a]" : "border-white/10 text-zinc-300"}`}>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>We do <strong>NOT</strong> use Google user data to train generalized AI/ML models.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>We do <strong>NOT</strong> transfer or sell Google user data to third parties or ad brokers.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Google API access is strictly limited to user-requested actions (e.g. Gmail drafting, Drive search, Calendar coordination).</span>
            </li>
          </ul>
        </section>

        {/* Policy Content Sections */}
        <div className="space-y-10">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#3A91EE]" />
              <span>1. Information We Collect</span>
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              When you sign up for and use VoxKage, we collect the following types of information:
            </p>
            <ul className={`list-disc pl-6 space-y-2 text-sm leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
              <li><strong>Account Profile Data:</strong> Email address, display name, and avatar image (provided during signup or Google Sign-In).</li>
              <li><strong>Google OAuth Authorization Data:</strong> Encrypted access tokens and refresh tokens granted when you explicitly connect Google MCP Servers (Gmail, Google Drive, Google Calendar).</li>
              <li><strong>Session Content:</strong> Prompts, attached files, and assistant conversations necessary to fulfill your coding and agentic tasks.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#3A91EE]" />
              <span>2. How We Use Google User Data</span>
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              VoxKage uses Google OAuth permissions solely to provide user-directed features:
            </p>
            <ul className={`list-disc pl-6 space-y-2 text-sm leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
              <li><strong>Gmail MCP (`gmail.readonly`, `gmail.compose`, `gmail.modify`):</strong> Used to search email threads, read message bodies for user context, and create email drafts requested directly by you.</li>
              <li><strong>Google Drive MCP (`drive.readonly`, `drive.file`):</strong> Used to search documents, read file contents, and save created documents to your Google Drive when commanded.</li>
              <li><strong>Google Calendar MCP (`calendar.readonly`, `calendar.events`):</strong> Used to query availability, list events, and schedule meetings on your calendar.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              3. Data Security & Storage
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              Your data security is paramount. OAuth refresh tokens are encrypted at rest using industry-standard AES-256 encryption. All web traffic between your browser, VoxKage servers, and Google API endpoints is transmitted securely over TLS 1.3/HTTPS.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              4. User Rights & Data Deletion
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              You retain full ownership and control of your data at all times:
            </p>
            <ul className={`list-disc pl-6 space-y-2 text-sm leading-relaxed ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`}>
              <li><strong>Disconnecting Integrations:</strong> You can disconnect Google MCP servers at any time in VoxKage Settings, which instantly deletes cached OAuth tokens.</li>
              <li><strong>Revoking Access:</strong> You can revoke VoxKage's access at any time via{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#3A91EE] underline">
                  Google Account Permissions
                </a>.
              </li>
              <li><strong>Account Deletion:</strong> You can request complete deletion of your account and all associated data by contacting our developer team.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 border-t pt-8">
            <h2 className="text-xl sm:text-2xl font-serif font-medium">
              5. Developer Contact Information
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLightMode ? "text-[#3d3d3a]" : "text-zinc-300"}`}>
              For privacy inquiries, security concerns, or data deletion requests, please contact:
            </p>
            <div className={`p-4 rounded-xl text-sm font-mono border ${isLightMode ? "bg-white border-[#ebe6df]" : "bg-zinc-900 border-white/10"}`}>
              <p>Application Developer: Ayush Dwivedi</p>
              <p>Email: ayushdwivedi2049@gmail.com</p>
              <p>App Website: https://voxkage-ai.vercel.app</p>
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
