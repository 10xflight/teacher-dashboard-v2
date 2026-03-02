/**
 * Print the material document preview by rendering it in a hidden iframe.
 * This completely isolates the printed content from the app's modal/flex layout,
 * so page breaks, margins, and pagination all work correctly.
 */
export function printMaterialPreview() {
  const previewEl = document.querySelector('.document-preview');
  if (!previewEl) return;

  // Gather all stylesheets from the page (Tailwind, etc.)
  const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML)
    .join('\n');

  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print Material</title>
  ${styleSheets}
  <style>
    @page {
      size: letter;
      margin: 0.5in 0.75in;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
    }
    .no-print {
      display: none !important;
    }
    .document-preview {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* Avoid breaking inside questions/items */
    .mb-3, .mb-4 {
      break-inside: avoid;
    }
  </style>
</head>
<body>
  ${previewEl.outerHTML}
</body>
</html>`);
  doc.close();

  // Wait for styles to load, then print
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Clean up after a brief delay to let the print dialog finish
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}
