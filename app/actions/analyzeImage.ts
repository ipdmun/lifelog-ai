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
I am sending you an image of a document (e.g., passport, receipt, business card, notebook).
Your task is to extract its key information, understand the context, and respond in JSON format.
Language preference for the output: ${locale === 'ko' ? 'Korean' : locale === 'jp' ? 'Japanese' : 'English'}.

Follow this JSON structure exactly:
{
  "summary": "A clear, concice single-sentence title or summary of what this document is (e.g., 'Republic of Korea Passport', 'Starbucks Coffee Receipt', 'Handwritten meeting notes')",
  "events": [
    {"time": "Field Name 1", "title": "Value 1 (e.g. Name, Date, Total Amount)"},
    {"time": "Field Name 2", "title": "Value 2"}
  ],
  "sentiment": "Neutral (or Positive/Negative if it's a mood diary)",
  "tags": ["Tag1", "Tag2"]
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
