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

CRITICAL INSTRUCTION FOR LANGUAGE:
- Do NOT translate the text written in the document. 
- If the document is written in English, extract it in English.
- If it is written in Korean, extract it in Korean.
- The "summary" and "tags" should be in ${locale === 'ko' ? 'Korean' : locale === 'jp' ? 'Japanese' : 'English'}.
- However, the "title" and "time" values in the "events" array MUST strictly be in the original language exactly as written in the image.

Follow this JSON structure exactly:
{
  "summary": "A clear, concice single-sentence title or summary of what this document is (e.g., 'Republic of Korea Passport', 'Starbucks Coffee Receipt', 'Handwritten meeting notes')",
  "events": [
    {"time": "Field Name 1", "title": "Original Value exactly as written (e.g. Name, Date, Amount)", "date": "YYYY-MM-DD (Parse out the strict date ONLY if a specific real date is implicitly/explicitly mentioned or meant. Otherwise omit or null)"},
    {"time": "Field Name 2", "title": "Original Value 2", "date": "..."}
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
