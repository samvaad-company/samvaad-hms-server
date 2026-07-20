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
                className={`w-[20px] h-[20px] rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 transition-colors ${
                  isCompleted || isActive
                    ? "bg-[#009598] text-white"
                    : "bg-[#f0f0f0] text-[#57575f]"
                }`}
              >
                {isCompleted ? <Check size={11} strokeWidth={2.5} /> : num}
              </div>
              <span
                className={`text-[12px] whitespace-nowrap truncate ${
                  isActive
                    ? "text-[#11111c] font-medium"
                    : isCompleted
                      ? "text-[#009598] font-normal"
                      : "text-[#57575f] font-normal"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 transition-colors ${
                  isCompleted ? "bg-[#009598]" : "bg-[#dedee1]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
