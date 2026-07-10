"use client";

import React from "react";
import { Mail, Calendar, Clock, ExternalLink, Image as ImageIcon, Download, User, ArrowRight } from "lucide-react";

// ----------------------------------------------------
// 1. Canva Design Preview Widget
// ----------------------------------------------------
interface CanvaPreviewWidgetProps {
  designId?: string;
  name?: string;
  embedUrl?: string;
}

export function CanvaPreviewWidget({ designId = "mock-canva-1", name = "Untitled Design", embedUrl = "" }: CanvaPreviewWidgetProps) {
  return (
    <div className="my-3 border border-zinc-850 bg-[#121216]/60 rounded-xl overflow-hidden max-w-md shadow-lg font-sans">
      {/* Canva Branding Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#00C4CC]/10 border-b border-zinc-850">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#00C4CC] flex items-center justify-center text-[10px] font-bold text-white font-sans">C</div>
          <span className="text-[12px] font-semibold text-zinc-200">Canva Workspace</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded border border-zinc-850">Ready</span>
      </div>

      {/* Mock Design Image/View Area */}
      <div className="relative aspect-[16/10] bg-zinc-950 flex items-center justify-center group overflow-hidden">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={name}
            className="w-full h-full border-none"
            allowFullScreen
          />
        ) : (
          <>
            {/* Elegant Placeholder Mockup representation */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-zinc-900 to-teal-950/20 flex flex-col items-center justify-center p-6 text-center">
              <ImageIcon className="w-12 h-12 text-[#00C4CC] opacity-60 mb-2.5 animate-pulse" />
              <span className="text-[13px] font-medium text-zinc-300">{name}</span>
              <span className="text-[11px] text-zinc-500 mt-1">Design ID: {designId}</span>
            </div>
            
            {/* Quick action buttons on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <a
                href={`https://canva.com/design/${designId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#00C4CC] hover:bg-[#00b0b8] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Edit in Canva</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-300 transition-all cursor-pointer"
                title="Download PNG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. Gmail Inbox Listing Widget
// ----------------------------------------------------
export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

interface GmailInboxWidgetProps {
  emails?: GmailMessage[];
}

export function GmailInboxWidget({ emails = [] }: GmailInboxWidgetProps) {
  const dummyEmails: GmailMessage[] = [
    {
      id: "m1",
      from: "Canva Teams <teams@canva.com>",
      subject: "Collaboration invite on Project Poster Design",
      snippet: "Hey Ayush! Shin invited you to collaborate on the main poster design for VoxKage's new deployment features...",
      date: "10:30 AM",
    },
    {
      id: "m2",
      from: "GitHub Actions <noreply@github.com>",
      subject: "[GitHub] Build status: voxkage-web deployment success",
      snippet: "Workflow run 'Deploy Sandbox UI' completed successfully. All check runs passed and build artifacts are updated...",
      date: "Yesterday",
    },
  ];

  const list = emails.length > 0 ? emails : dummyEmails;

  return (
    <div className="my-3 border border-zinc-850 bg-[#121216]/60 rounded-xl overflow-hidden max-w-md shadow-lg font-sans">
      {/* Gmail Branding Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-500/10 border-b border-zinc-850">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-red-500" />
          <span className="text-[12px] font-semibold text-zinc-200">Gmail Inbox Digest</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded border border-zinc-850">
          {list.length} message{list.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* List items */}
      <div className="divide-y divide-zinc-850/60 max-h-72 overflow-y-auto custom-chat-scrollbar">
        {list.map((email) => (
          <div key={email.id} className="p-3.5 hover:bg-zinc-850/40 transition-colors flex flex-col gap-1.5 cursor-pointer">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[12.5px] font-semibold text-zinc-300 truncate max-w-[70%]">{email.from}</span>
              <span className="text-[11px] text-zinc-550 flex-shrink-0">{email.date}</span>
            </div>
            <h4 className="text-[12px] font-medium text-zinc-205 truncate">{email.subject}</h4>
            <p className="text-[11.5px] text-zinc-500 line-clamp-2 leading-relaxed mt-0.5">{email.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. Google Calendar Schedules Widget
// ----------------------------------------------------
export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  location?: string;
}

interface GoogleCalendarWidgetProps {
  events?: CalendarEvent[];
}

export function GoogleCalendarWidget({ events = [] }: GoogleCalendarWidgetProps) {
  const dummyEvents: CalendarEvent[] = [
    {
      id: "e1",
      title: "VoxKage Pair Programming Session",
      time: "4:00 PM - 5:30 PM",
      location: "Google Meet",
    },
    {
      id: "e2",
      title: "Integration Gateway Audit",
      time: "Tomorrow, 11:00 AM - 12:00 PM",
      location: "HQ Boardroom",
    },
  ];

  const list = events.length > 0 ? events : dummyEvents;

  return (
    <div className="my-3 border border-zinc-850 bg-[#121216]/60 rounded-xl overflow-hidden max-w-md shadow-lg font-sans">
      {/* Calendar Branding Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/10 border-b border-zinc-850">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="text-[12px] font-semibold text-zinc-200">Upcoming Schedule</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded border border-zinc-850">Calendar</span>
      </div>

      {/* List items */}
      <div className="p-4 flex flex-col gap-4">
        {list.map((event, idx) => (
          <div key={event.id} className="flex gap-3.5 relative items-start">
            {/* Sidebar timeline link line */}
            {idx < list.length - 1 && (
              <div className="absolute left-2.5 top-6 bottom-[-16px] w-[1px] bg-zinc-800" />
            )}

            {/* Event Dot Icon */}
            <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center relative z-10 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </div>

            {/* Event Details */}
            <div className="flex-grow flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-semibold text-zinc-200 truncate">{event.title}</span>
              <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{event.time}</span>
                {event.location && (
                  <>
                    <span className="text-zinc-700 select-none">•</span>
                    <span className="truncate max-w-[120px]">{event.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
