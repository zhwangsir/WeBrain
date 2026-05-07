import { api } from "./client";

export interface UploadResult {
  ok: boolean;
  url?: string;
  name?: string;
  size?: number;
  type?: string;
  error?: string;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // DataURL format: data:[type];base64,[data]
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const uploadApi = {
  upload: async (file: File): Promise<UploadResult> => {
    const data = await readFileAsBase64(file);
    return api.post<UploadResult>("/api/upload", {
      filename: file.name,
      data,
      type: file.type,
    });
  },
};
