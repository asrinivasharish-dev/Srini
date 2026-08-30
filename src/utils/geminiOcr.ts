import { GeminiOcrResult } from '../types';

export async function extractTextFromImageWithGemini(
  imageDataUrl: string,
  mimeType: string = 'image/jpeg'
): Promise<GeminiOcrResult> {
  const response = await fetch('/api/gemini/extract-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: imageDataUrl,
      mimeType,
    }),
  });

  if (!response.ok) {
    let errMsg = 'Failed to extract text with Gemini';
    try {
      const errData = await response.json();
      if (errData.error) errMsg = errData.error;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Invalid response from Gemini OCR engine');
  }

  return result.data as GeminiOcrResult;
}
