import { studentRequest } from "./student";
export function learningRequest<T>(
  path: string,
  options: Parameters<typeof studentRequest>[1] = {},
) {
  return studentRequest<T>(path, { ...options, prefix: "/api/v1/learning" });
}

export async function downloadLessonPdf(path: string, filename: string) {
  const file = await learningRequest<Blob>(path, { raw: true });
  if (file.type !== "application/pdf") throw new Error("The server did not return a PDF.");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
