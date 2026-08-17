"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renders `value` as a CODE128 barcode — encodes arbitrary text, not just digits. */
export function PatientBarcode({ value, className }: { value: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      height: 56,
      width: 1.6,
      margin: 0,
    });
  }, [value]);

  return <svg ref={ref} className={className} />;
}
