import { createAIClient } from './client';

export const generateDiagram = async (
  contextText: string,
  instruction: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<string> => {
  const ai = createAIClient();

  const prompt = `
    Role: Expert Information Designer & Data Visualizer.
    Task: Create a highly detailed, visually appealing SVG Diagram (Flowchart, Mindmap, Hierarchy, Timeline, etc.) based on the user's instruction and context.

    Context: "${contextText}"
    Instruction: "${instruction}"

    **SVG REQUIREMENTS:**
    1. **Format:** Return ONLY valid, raw <svg> code. Do NOT wrap it in markdown blocks.
    2. **Responsiveness:** Use a proper \`viewBox\` (e.g., \`viewBox="0 0 800 600"\`). Do NOT use fixed width/height attributes on the <svg> tag.
    3. **Styling:**
       - Background: Transparent or very light (e.g., #f8fafc).
       - Text: Must be readable, use standard fonts (font-family="sans-serif"), and appropriate sizes.
       - Colors: Use a professional palette (e.g., #3b82f6 for primary nodes, #1e293b for text, #cbd5e1 for lines).
    4. **Layout:** Ensure nodes are well-spaced. Paths/lines connecting nodes should be clear.
    5. **Content:** The diagram MUST accurately reflect the instruction.

    Output: ONLY the <svg>...</svg> code.
  `;

  const response = await ai.models.generateContent({ model: modelName, contents: prompt });

  const svgContent = response.text || "";
  const cleanedSvg = svgContent
    .replace(/```xml\n?/g, '').replace(/```svg\n?/g, '')
    .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

  return `<div class="flowchart-container my-8 w-full overflow-x-auto flex justify-center">${cleanedSvg}</div>`;
};

export const generateSectionImage = async (
  contextText: string,
  instruction: string
): Promise<string> => {
  const ai = createAIClient();

  const cleanContext = contextText
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\nHEAD: $1\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000);

  const prompt = `
    Create a high-quality, professional textbook illustration.

    Context: "${cleanContext}"
    Instruction: ${instruction || "Illustrate the key concept."}

    Style: Educational, Detailed, Textbook Diagram, High Definition.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { imageSize: '1K', aspectRatio: '16:9' } }
  });

  let imageUrl = "";
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl) throw new Error("No image generated");

  return `
    <figure>
        <img src="${imageUrl}" alt="Generated Illustration" />
        <figcaption>Figure: AI Generated Illustration</figcaption>
    </figure>
  `;
};
