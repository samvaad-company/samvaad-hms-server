"use client";

/**
 * AI: for super admins and admins. What the staff have used, token analytics, and the controls to
 * set limits, pause someone, or give them more tokens.
 */
import { Zap } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { AiUsageView } from "@/components/admin/AiUsageView";

export default function AiPage() {
  const { user, loading } = useAuth();
  const allowed = user?.role === "Super Admin" || user?.role === "IT Admin";

  return (
    <>
      <div className={`${tw.gutterX} pt-[16px] mb-5`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[color:var(--subtle-2)] rounded-[10px] flex items-center justify-center shrink-0">
            <Zap size={18} className="text-[color:var(--ink-soft)]" />
          </div>
          <div>
            <h1 className="text-[26px] font-medium text-[color:var(--ink)] leading-8">AI</h1>
            <p className="text-[14px] font-light text-[color:var(--ink-soft)]">Staff token use, analytics, and who may use the AI assistant.</p>
          </div>
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        {loading ? null : allowed ? (
          <AiUsageView />
        ) : (
          <div className={`${tw.surface.card} ${tw.radius.card} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>Only a super admin or admin can see this page.</div>
        )}
      </div>
    </>
  );
}
