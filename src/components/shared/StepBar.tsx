import { Check } from "lucide-react";

interface StepBarProps {
  steps: string[];
  currentStep: number;
}

export function StepBar({ steps, currentStep }: StepBarProps) {
  return (
    <div className="flex items-start w-full">
      {steps.map((label, i) => {
        const num = i + 1;
        const isCompleted = num < currentStep;
        const isActive = num === currentStep;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-[8px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium transition-colors ${
                  isCompleted
                    ? "bg-[#009598] text-white"
                    : isActive
                    ? "bg-[#009598] text-white"
                    : "bg-[#f0f0f0] text-[#57575f]"
                }`}
              >
                {isCompleted ? <Check size={14} strokeWidth={2.5} /> : num}
              </div>
              <span
                className={`text-[11px] font-normal whitespace-nowrap ${
                  isActive || isCompleted ? "text-[#009598]" : "text-[#57575f]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mt-[-16px] transition-colors ${
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
