"use client";

import React, { useState, useEffect } from "react";
import { Clock, Mail, Bell, AlertTriangle, Check, X, Calendar } from "lucide-react";
import { fetchSettingsProfile, getToken, BACKEND_URL } from "@/lib/api";

interface ScheduleSetupWidgetProps {
  timings: string;
  interval: number;
  cron: string;
  instruction: string;
  suggestedName: string;
  estimatedLoops: number;
  onCancel: () => void;
  onSuccess: (scheduleId: string, name: string) => void;
}

export default function ScheduleSetupWidget({
  timings,
  interval,
  cron,
  instruction,
  suggestedName,
  estimatedLoops,
  onCancel,
  onSuccess
}: ScheduleSetupWidgetProps) {
  const [name, setName] = useState(suggestedName);
  const [delivery, setDelivery] = useState("notification");
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz || "Asia/Kolkata");
    } catch {
      setTimezone("Asia/Kolkata");
    }

    const checkGmailConnection = async () => {
      try {
        const profile = await fetchSettingsProfile();
        const connections = profile.mcp_connections || {};
        if (connections.gmail) {
          setIsGmailConnected(true);
          setDelivery("gmail");
        }
      } catch (err) {
        console.error("Failed to check mcp connections:", err);
      }
    };
    checkGmailConnection();
  }, []);

  const handleScheduleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const apiBase = BACKEND_URL;
      
      const payload = {
        name,
        instruction,
        cron_expression: cron,
        interval_hours: interval,
        timezone,
        retrieval_method: delivery
      };

      const res = await fetch(`${apiBase}/schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to create schedule");
      }

      const data = await res.json();
      onSuccess(data.id || data.schedule_id, name);
    } catch (err: any) {
      setError(err.message || "An error occurred while scheduling the task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative my-4 w-full max-w-[640px] bg-[#252320] border border-[#e6dfd8]/15 rounded-lg p-6 font-sans text-[#efe9de] animate-fadeIn">
      <div className="flex items-center gap-3 border-b border-[#e6dfd8]/10 pb-4 mb-5">
        <Clock className="w-5 h-5 text-blue-500" />
        <h2 className="font-serif text-lg text-[#faf9f5] font-normal tracking-wide">
          Scheduling Task
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-800/40 rounded text-red-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11.5px] uppercase tracking-wider text-[#8e8b82] font-medium">
            Schedule Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning News Brief"
            className="w-full bg-[#181715] border border-[#e6dfd8]/15 rounded px-3 py-2 text-[13.5px] text-[#faf9f5] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] uppercase tracking-wider text-[#8e8b82] font-medium">
              Timings Query
            </label>
            <div className="flex items-center gap-2 bg-[#181715] border border-[#e6dfd8]/15 rounded px-3 py-2 text-[13px] text-[#efe9de]">
              <Calendar className="w-4 h-4 text-[#8e8b82]" />
              <span className="capitalize">{timings}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] uppercase tracking-wider text-[#8e8b82] font-medium">
              Interval (UTC)
            </label>
            <div className="flex items-center gap-2 bg-[#181715] border border-[#e6dfd8]/15 rounded px-3 py-2 text-[13px] text-[#efe9de] font-mono">
              <span>Cron: {cron}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11.5px] uppercase tracking-wider text-[#8e8b82] font-medium">
            Task Instruction
          </label>
          <div className="w-full bg-[#181715] border border-[#e6dfd8]/15 rounded px-3 py-2.5 text-[13px] text-[#efe9de] leading-relaxed max-h-[100px] overflow-y-auto font-mono">
            {instruction}
          </div>
        </div>

        <div className="text-[12px] text-[#8e8b82]">
          Estimated loops required to complete tasks: <span className="font-semibold text-[#efe9de]">{estimatedLoops} runs</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11.5px] uppercase tracking-wider text-[#8e8b82] font-medium">
            Report Retrieval Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setDelivery("notification")}
              className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                delivery === "notification"
                  ? "bg-blue-950/20 border-blue-500 text-zinc-100"
                  : "bg-[#181715] border-[#e6dfd8]/15 text-[#8e8b82] hover:border-[#e6dfd8]/30"
              }`}
            >
              <Bell className={`w-4 h-4 ${delivery === "notification" ? "text-blue-500" : "text-[#8e8b82]"}`} />
              <div className="flex flex-col">
                <span className="text-[13px] font-medium">In-app Notification</span>
                <span className="text-[11px] text-[#8e8b82]">Saved in SCHEDULE SESSIONS</span>
              </div>
            </div>

            {isGmailConnected ? (
              <div
                onClick={() => setDelivery("gmail")}
                className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                  delivery === "gmail"
                    ? "bg-blue-950/20 border-blue-500 text-zinc-100"
                    : "bg-[#181715] border-[#e6dfd8]/15 text-[#8e8b82] hover:border-[#e6dfd8]/30"
                }`}
              >
                <Mail className={`w-4 h-4 ${delivery === "gmail" ? "text-blue-500" : "text-[#8e8b82]"}`} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Email via Gmail</span>
                  <span className="text-[11px] text-[#8e8b82]">Direct email (no UI session created)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-[#181715]/40 border border-[#e6dfd8]/5 rounded text-[#6c6a64] cursor-not-allowed opacity-60">
                <Mail className="w-4 h-4 text-[#6c6a64]" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Email via Gmail (Locked)</span>
                  <span className="text-[11px] text-[#6c6a64]">Connect Gmail to enable</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 border-t border-[#e6dfd8]/10 pt-4">
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          disabled={loading}
          className="px-4 py-2 text-[13px] font-medium text-[#8e8b82] hover:text-[#efe9de] hover:bg-[#181715] rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleScheduleSubmit}
          disabled={loading || !name.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13.5px] font-medium rounded transition-colors disabled:opacity-50"
        >
          {loading ? "Scheduling..." : "Schedule Task"}
        </button>
      </div>

      {showCancelConfirm && (
        <div className="absolute inset-0 bg-[#181715]/90 rounded-lg flex items-center justify-center p-6 z-50 animate-fadeIn backdrop-blur-sm">
          <div className="w-full max-w-[360px] bg-[#252320] border border-[#e6dfd8]/15 rounded-lg p-5 text-center shadow-2xl">
            <AlertTriangle className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h3 className="font-serif text-[#faf9f5] text-base font-normal mb-1.5">
              Cancel Scheduling?
            </h3>
            <p className="text-xs text-[#8e8b82] leading-relaxed mb-5">
              Are you sure you want to cancel? Your schedule settings will be discarded.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-[12.5px] font-medium text-[#efe9de] bg-[#181715] hover:bg-[#181715]/75 border border-[#e6dfd8]/10 rounded transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-[12.5px] font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
