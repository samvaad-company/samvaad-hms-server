import { tw } from "@/lib/design-system";

interface StatusBadgeProps {
  status: string;
}

/**
 * The pill colours in the design system are bright (good for fills, weak for small text on a pastel
 * background), so the badge text uses a deeper shade of the same hue. The pastel backgrounds stay as
 * they are in light and dark mode, which keeps the darker text readable in both.
 */
const DEEPER: Record<string, string> = {
  "#00955c": "#0b7a47", // green
  "#007cff": "#0a5fc4", // blue
  "#ff9000": "#a85a00", // amber
  "#ff0004": "#c8001a", // red
  "#0066cc": "#0a5fa6", // admitted blue
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls = tw.statusBadge[status] ?? "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]";
  const hex = /text-\[(#[0-9a-fA-F]{6})\]/.exec(cls)?.[1]?.toLowerCase();
  const color = hex ? DEEPER[hex] : undefined;
  return (
    <span
      className={`inline-flex items-center justify-center gap-[5px] px-[8px] py-[2px] rounded-full text-[12px] font-medium leading-[16px] whitespace-nowrap ${cls}`}
      style={color ? { color } : undefined}
    >
      <span aria-hidden className="w-[6px] h-[6px] rounded-full bg-current shrink-0" />
      {status}
    </span>
  );
}
