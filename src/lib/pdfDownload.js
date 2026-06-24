import { base44 } from "@/api/base44Client";

/**
 * Faz upload do PDF para o storage e retorna uma URL compartilhável.
 * Se o upload falhar, faz fallback para blob local (download direto).
 */
export async function uploadAndOpenPDF(pdfBytes, filename) {
  try {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const file = new File([blob], filename, { type: "application/pdf" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    window.open(file_url, "_blank");
    return file_url;
  } catch (_) {
    // fallback: download local
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return null;
  }
}