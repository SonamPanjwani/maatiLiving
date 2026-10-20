import { FileText } from "lucide-react";
import { billFileUrl } from "@/src/lib/books/purchases";

// Read-only list of a purchase's private bill files. Links go through the admin-only /api/books/bill route.
export default function BillFiles({ files }) {
  if (!files?.length) return null;
  return <ul className="bill-files">
    {files.map((file, index) => {
      const label = file.name || `File ${index + 1}`;
      return <li key={`${file.publicId}-${index}`}>
        <a href={billFileUrl(file)} target="_blank" rel="noreferrer" className="bill-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-only signed redirect */}
          <img src={billFileUrl(file, { size: "thumb" })} alt="" loading="lazy" />
          <span>{file.format === "pdf" && <FileText size={13} aria-hidden="true" />}{label}</span>
        </a>
        {file.format === "pdf" && <small className="bill-pages">
          {file.pages > 1 && <>Pages: {Array.from({ length: Math.min(file.pages, 20) }, (_, i) => <a key={i} href={billFileUrl(file, { page: i + 1 })} target="_blank" rel="noreferrer" aria-label={`${label}, page ${i + 1}`}>{i + 1}</a>)} · </>}
          <a href={billFileUrl(file, { size: "original" })} target="_blank" rel="noreferrer">Original PDF</a>
        </small>}
      </li>;
    })}
  </ul>;
}
