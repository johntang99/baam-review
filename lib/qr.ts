import "server-only";
import QRCode from "qrcode";

/**
 * Generate a PNG buffer for the given URL.
 * Error-correction level 'M' (~15%) survives reasonable damage on a printed sheet.
 * Margin = 1 keeps the quiet zone tight so the QR fills the printed cell.
 */
export async function generateQrPng(
  url: string,
  size = 1024,
): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: {
      dark: "#0F1F1A",
      light: "#FFFFFFFF",
    },
  });
}

/**
 * Same as above but as a base64 data URL — used for in-browser preview where
 * we don't want to round-trip through a separate endpoint.
 */
export async function generateQrDataUrl(url: string, size = 512): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#0F1F1A", light: "#FFFFFFFF" },
  });
}
