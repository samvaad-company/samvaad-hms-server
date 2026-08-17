"use client";

import { useRef } from "react";
import { Printer, Download } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { PatientBarcode } from "@/components/shared/PatientBarcode";
import { useHospital } from "@/components/shared/DocumentLetterhead";
import { printElement, downloadElement } from "@/lib/print";
import { formatDate } from "@/lib/dates";
import type { LabTestDTO } from "@/types/api";

/**
 * A small specimen label — meant to be printed and stuck straight onto the
 * sample container. The order number is the primary trackable code (what a
 * lab actually labels a tube with); the barcode also carries the patient's
 * name, age, and test name so a scan at any bench identifies the sample
 * without a lookup.
 */
export function SampleBarcodeModal({
  test,
  onClose,
}: {
  test: LabTestDTO;
  onClose: () => void;
}) {
  const hospital = useHospital();
  const labelRef = useRef<HTMLDivElement>(null);
  const barcodeValue = [test.orderNumber, test.patientName, String(test.patientAge), test.testName, hospital.name || "Hospital"].join("|");

  return (
    <Modal
      open
      onClose={onClose}
      title="Sample Barcode"
      width={380}
      footer={
        <>
          <button
            onClick={() => downloadElement(labelRef.current, `Sample Label - ${test.orderNumber}`)}
            className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={() => printElement(labelRef.current, `Sample Label - ${test.orderNumber}`)}
            className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </>
      }
    >
      <p className="text-[12px] font-light text-[#57575f] mb-4">
        Print and paste this label directly onto the sample container.
      </p>
      <div ref={labelRef} className="border border-[#dedee1] rounded-[10px] overflow-hidden bg-white mx-auto" style={{ width: 300 }}>
        <div className="px-4 pt-3 pb-2 border-b border-dashed border-[#dedee1]">
          <p className="text-[11px] font-medium text-[#009598] truncate">{hospital.name || "Hospital"}</p>
          <p className="text-[15px] font-medium text-[#11111c] leading-tight mt-1">{test.orderNumber}</p>
        </div>
        <div className="px-4 py-3 flex flex-col gap-[2px]">
          <p className="text-[13px] font-medium text-[#11111c] truncate">{test.patientName} · {test.patientAge} yrs</p>
          <p className="text-[12px] font-normal text-[#57575f] truncate">{test.testName}</p>
          {test.doctor && <p className="text-[11px] font-light text-[#57575f]">Ref: {test.doctor}</p>}
          <p className="text-[11px] font-light text-[#57575f]">{formatDate(test.date)}</p>
        </div>
        <div className="px-4 pb-3 flex flex-col items-center gap-1">
          <PatientBarcode value={barcodeValue} className="w-full" />
          <p className="text-[10px] font-normal text-[#11111c] tracking-wider">{test.orderNumber}</p>
        </div>
      </div>
    </Modal>
  );
}
