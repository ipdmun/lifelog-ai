'use server';

import { GoogleGenAI } from '@google/genai';

export async function analyzeImageWithAI(base64Image: string, locale: string) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in the environment variables.");
        }

        const ai = new GoogleGenAI({ apiKey: apiKey });

        // Strip the data:image/jpeg;base64, prefix
        const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

        const prompt = `
You are an advanced document analysis AI. 
I am sending you an image of a document (handwritten notes, business docs, calendar).
Your task is to extract its key information, especially the PRIMARY DATE of the record.

CRITICAL INSTRUCTION FOR DATE DETECTION:
- Find the primary date the user is writing about (e.g., "12/1", "1/23", "Starting Date: 12/4").
- This date MUST be returned in the "logDate" field as "YYYY-MM-DD". Assume year 2026 if not specified.
- If multiple dates exist, "Starting Date" or the most prominent date at the top is the "logDate".
- "logDate" is mandatory for calendar synchronization. Never leave it null if any date is found.

Follow this JSON structure:
{
  "summary": "Short summary",
  "logDate": "YYYY-MM-DD (MANDATORY if date found)",
  "events": [
    {"time": "Field Label", "title": "Value", "date": "YYYY-MM-DD"}
  ],
  "sentiment": "Neutral",
  "tags": ["tag1"]
}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/jpeg"
                    }
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        if (response.text) {
            const parsed = JSON.parse(response.text);
            return { success: true, data: parsed };
        } else {
            throw new Error("Empty response from AI");
        }
    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        return { success: false, error: error?.message || "Analysis failed" };
    }
}
