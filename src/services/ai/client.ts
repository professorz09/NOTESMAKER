import { GoogleGenAI } from "@google/genai";

export const createAIClient = () => {
  let apiKey = "";
  if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env) {
    apiKey = (window as any).process.env.API_KEY;
  }
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }
  if (!apiKey) {
    throw new Error("API Key not found. Please select an API key or check your configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const cleanHtmlOutput = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/^\s*```html\s*/i, '')
    .replace(/^\s*```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
};

export const buildContents = (prompt: string, images?: { base64: string; mimeType: string }[]) => {
  if (!images || images.length === 0) return prompt;
  return {
    parts: [
      ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
      { text: prompt },
    ]
  };
};
