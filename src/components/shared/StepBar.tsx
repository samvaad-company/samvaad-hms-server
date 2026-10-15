import { Check } from "lucide-react";

interface StepBarProps {
  steps: string[];
  currentStep: number;
}

/**
 * Compact inline stepper: small numbered dots with labels beside them on a
 * single row, joined by thin connectors.
 */
export function StepBar({ steps, currentStep }: StepBarProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((label, i) => {
        const num = i + 1;
        const isCompleted = num < currentStep;
        const isActive = num === currentStep;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex items-center gap-[6px] min-w-0">
              <div
                className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 transition-colors ${
                  isCompleted || isActive
                    ? "bg-[color:var(--brand)] text-white"
                    : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"
                }`}
              >
                {isCompleted ? <Check size={11} strokeWidth={2.5} /> : num}
              </div>
              <span
                className={`text-[11.5px] whitespace-nowrap truncate ${
                  isActive
                    ? "text-[color:var(--ink)] font-medium"
                    : isCompleted
                      ? "text-[color:var(--brand)] font-normal"
                      : "text-[color:var(--ink-soft)] font-normal"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 transition-colors ${
                  isCompleted ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
