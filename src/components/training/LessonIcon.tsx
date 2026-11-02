"use client";

import { BarChart3, BedDouble, Building2, CalendarCheck, CalendarDays, CalendarOff, ClipboardList, Compass, FileBarChart, FileText, FlaskConical, HeartPulse, Inbox, Layers, ListOrdered, Pill, Receipt, ScanLine, ScrollText, Settings, SprayCan, Sparkles, UserPlus, Users, BookOpen, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { BarChart3, BedDouble, Building2, CalendarCheck, CalendarDays, CalendarOff, ClipboardList, Compass, FileBarChart, FileText, FlaskConical, HeartPulse, Inbox, Layers, ListOrdered, Pill, Receipt, ScanLine, ScrollText, Settings, SprayCan, Sparkles, UserPlus, Users };

/** The icon a lesson is drawn with. */
export function LessonIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon size={size} className="shrink-0 text-[color:var(--ink-soft)]" />;
}
