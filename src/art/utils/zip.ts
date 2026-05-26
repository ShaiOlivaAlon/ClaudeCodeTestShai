import JSZip from 'jszip';

export async function downloadZip(
  filename: string,
  entries: { path: string; blob: Blob }[]
): Promise<void> {
  if (entries.length === 0) return;
  const zip = new JSZip();
  for (const { path, blob } of entries) {
    zip.file(path, blob);
  }
  const out = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(out);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
