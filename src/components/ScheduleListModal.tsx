"use client";

import React, { useState, useEffect } from "react";
import { X, Play, Pause, Trash2, Edit3, Check, Calendar, Mail, Bell, AlertTriangle } from "lucide-react";
import { getToken } from "@/lib/api";
interface Schedule {
  id: string;
  name: string;
  instruction: string;
  cron_expression: string;
  interval_hours: number;
  timezone: string;
  retrieval_method: string;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
}

interface ScheduleListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleListModal({ isOpen, onClose }: ScheduleListModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchSchedules = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/schedules`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch schedules list");
      const data = await res.json();
      setSchedules(data);
    } catch (err: any) {
      setError(err.message || "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
    }
  }, [isOpen]);

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiBase}/schedules/${schedule.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !schedule.is_active })
      });
      if (!res.ok) throw new Error("Failed to update schedule state");
      
      // Update local state
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, is_active: !s.is_active } : s))
      );
    } catch (err: any) {
      setError(err.message || "Failed to toggle schedule state.");
    }
  };

  const handleStartRename = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setEditName(schedule.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiBase}/schedules/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName })
      });
      if (!res.ok) throw new Error("Failed to rename schedule");
      
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: editName } : s))
      );
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || "Failed to save schedule name.");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiBase}/schedules/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to delete schedule");
      
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete schedule.");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-md cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative w-full sm:max-w-[680px] bg-[#181715] border border-[#e6dfd8]/15 rounded-none sm:rounded-lg p-4 sm:p-6 text-[#efe9de] flex flex-col max-h-screen sm:max-h-[85vh] shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8]/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h2 className="font-serif text-[#faf9f5] text-lg font-normal tracking-wide">
              Schedules Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-[#8e8b82] hover:text-[#faf9f5] hover:bg-[#252320] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/40 rounded text-red-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-[250px]">
          {loading && schedules.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#8e8b82] gap-2">
              <span className="w-4 h-4 border-2 border-t-blue-500 border-[#e6dfd8]/15 rounded-full animate-spin"></span>
              <span>Loading schedules...</span>
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="w-10 h-10 text-[#6c6a64] mb-3" />
              <p className="text-[13.5px] text-[#efe9de] font-medium mb-1">No Active Schedules</p>
              <p className="text-[11.5px] text-[#8e8b82] max-w-[320px]">
                Create automation workflows using the <span className="font-mono text-blue-400 bg-[#252320] px-1 py-0.5 rounded">/schedule</span> command in the chat feed.
              </p>
            </div>
          ) : (
            schedules.map((s) => (
              <div
                key={s.id}
                className="bg-[#252320] border border-[#e6dfd8]/10 rounded-lg p-3 sm:p-4 transition-all hover:border-[#e6dfd8]/20 flex flex-col gap-3"
              >
                {/* Top Row: Name, Status, Switch */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-1.5 w-full max-w-[320px]">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-[#181715] border border-blue-500/40 rounded px-2 py-1 text-xs text-[#faf9f5] w-full focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(s.id)}
                          className="p-1 hover:bg-[#181715] rounded text-emerald-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 hover:bg-[#181715] rounded text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <span className="font-serif text-[#faf9f5] text-[14.5px] font-normal leading-none">
                          {s.name}
                        </span>
                        <button
                          onClick={() => handleStartRename(s)}
                          className="opacity-0 group-hover/title:opacity-100 p-0.5 text-[#8e8b82] hover:text-[#efe9de] transition-opacity cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                        s.is_active
                          ? "bg-blue-950/20 border border-blue-500/30 text-blue-400"
                          : "bg-[#181715] border border-[#8e8b82]/35 text-[#8e8b82]"
                      }`}
                    >
                      {s.is_active ? "Running" : "Paused"}
                    </span>
                  </div>

                  {/* Actions Toggle & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle button */}
                    <button
                      onClick={() => handleToggleActive(s)}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        s.is_active
                          ? "bg-[#181715] border border-[#e6dfd8]/10 text-[#8e8b82] hover:text-[#efe9de] hover:border-[#e6dfd8]/25"
                          : "bg-blue-600 text-white hover:bg-blue-500"
                      }`}
                    >
                      {s.is_active ? (
                        <>
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Run</span>
                        </>
                      )}
                    </button>

                    {/* Delete button */}
                    {confirmDeleteId === s.id ? (
                      <div className="flex items-center gap-1 bg-[#181715] border border-red-900/50 rounded px-1.5 py-0.5 animate-fadeIn">
                        <span className="text-[10px] text-red-400 font-medium px-1">Sure?</span>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1 hover:bg-red-950/40 rounded text-red-400 cursor-pointer"
                          title="Confirm Delete"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 hover:bg-[#181715] rounded text-zinc-400 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="p-1.5 bg-[#181715] border border-[#e6dfd8]/10 hover:border-red-900/40 hover:text-red-400 rounded text-[#8e8b82] transition-colors cursor-pointer"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div className="bg-[#181715]/75 border border-[#e6dfd8]/5 rounded px-3 py-2 text-[12px] text-[#efe9de] space-y-1.5 font-mono">
                  <div className="flex flex-col xs:flex-row xs:justify-between gap-0.5">
                    <span className="text-[#8e8b82] shrink-0">Timing (Cron):</span>
                    <span className="break-all text-right">{s.cron_expression} ({s.timezone})</span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between gap-0.5">
                    <span className="text-[#8e8b82] shrink-0">Delivery:</span>
                    <span className="flex items-center gap-1">
                      {s.retrieval_method === "gmail" ? (
                        <>
                          <Mail className="w-3 h-3 text-blue-500" />
                          <span>Gmail Inbox</span>
                        </>
                      ) : (
                        <>
                          <Bell className="w-3 h-3 text-blue-500" />
                          <span>In-app Notification</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col xs:flex-row xs:justify-between gap-0.5">
                    <span className="text-[#8e8b82] shrink-0">Last Run:</span>
                    <span>
                      {s.last_run
                        ? new Date(s.last_run).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                        : "Never"}
                    </span>
                  </div>
                  <div className="border-t border-[#e6dfd8]/5 pt-1.5 mt-1">
                    <span className="text-[#8e8b82] block mb-0.5">Instruction:</span>
                    <p className="text-[#faf9f5] break-words whitespace-pre-wrap text-[11.5px] leading-relaxed">
                      {s.instruction}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
