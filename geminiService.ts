import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Outline, EnhanceOptions } from '../types';

// Helper para criar a instância da IA com a chave fornecida pelo usuário na hora
const getAi = (apiKey: string) => new GoogleGenAI({ apiKey });
const IMAGE_PROMPT_MARKER = "IMAGE_PROMPT:";

const generateImage = async (ai: GoogleGenAI, prompt: string): Promise<string | undefined> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) return part.inlineData.data;
            }
        }
        return undefined;
    } catch (error) {
        console.error("Error generating image:", error);
        return undefined;
    }
};

export const generateCoverImage = async (apiKey: string, title: string, topic: string): Promise<string | undefined> => {
    const ai = getAi(apiKey);
    try {
        const promptResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Create a single, concise, and visually rich prompt (in English) for an AI image generator to create a stunning and professional e-book cover.
            E-book Title: "${title}"
            Main Topic: "${topic}"
            The cover design should be high-quality, visually striking, and directly and clearly represent the e-book's main topic. It needs to make the subject matter instantly recognizable. Avoid including any text in the image itself.
            Example prompt for 'The History of the Inca Empire': A majestic, photorealistic view of Machu Picchu at sunrise, with golden light illuminating the ancient stone structures and dramatic mountain peaks in the background.
            Just return the prompt text, nothing else.`
        });

        const imagePrompt = promptResponse.text ? promptResponse.text.trim() : "";
        if (imagePrompt) return await generateImage(ai, imagePrompt);
        return undefined;
    } catch(error) {
        return undefined;
    }
};

export const generateOutline = async (apiKey: string, topic: string, minPageCount: number, maxPageCount: number, language: string, observations: string): Promise<Outline> => {
    const ai = getAi(apiKey);
    const numChapters = Math.max(3, Math.ceil((minPageCount + maxPageCount) / 2 / 2));
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Create an e-book outline on '${topic}' with ${numChapters} chapters in ${language}. ${observations} Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    chapters: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "chapters"],
            }
        }
    });
    const text = response.text || "{}";
    return JSON.parse(text.trim()) as Outline;
};

export const generateChapterContent = async (apiKey: string, ebookTitle: string, chapterTitle: string, language: string, includeImages: boolean, observations: string) => {
    const ai = getAi(apiKey);
    let prompt = `Write a chapter '${chapterTitle}' for e-book '${ebookTitle}' in ${language}. Approx 800 words. ${observations}`;
    if (includeImages) prompt += `\nAfter content, add '${IMAGE_PROMPT_MARKER}' followed by an image prompt.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
    });

    let content = response.text || "";
    let image: string | undefined = undefined;
    if (includeImages && content.includes(IMAGE_PROMPT_MARKER)) {
        const parts = content.split(IMAGE_PROMPT_MARKER);
        content = parts[0].trim();
        if (parts[1]?.trim()) image = await generateImage(ai, parts[1].trim());
    }
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(u => !!u) || [];
    return { content, sources: sources as string[], image };
};

export const selectTopReferences = async (apiKey: string, references: Set<string>, topic: string, language: string): Promise<Set<string>> => {
    if (references.size <= 3) return references;
    const ai = getAi(apiKey);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Select top 3 sources from list for topic '${topic}': ${[...references].join('\n')}. JSON output.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { top_sources: { type: Type.ARRAY, items: { type: Type.STRING } } }
            }
        }
    });
    const text = response.text || "{}";
    const res = JSON.parse(text.trim()) as { top_sources?: string[] };
    const sources = res.top_sources || [...references].slice(0,3);
    return new Set<string>(sources);
};

export const structureText = async (apiKey: string, fullText: string) => {
    const ai = getAi(apiKey);
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Structure text into e-book JSON: ${fullText}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    chapters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } }
                }
            }
        }
    });
    const text = response.text || "{}";
    return JSON.parse(text.trim());
};

export const enhanceChapterContent = async (apiKey: string, title: string, content: string, options: EnhanceOptions) => {
    const ai = getAi(apiKey);
    let prompt = `Enhance chapter '${title}'. Style: ${options.style}. Language: ${options.language}. Content: ${content}`;
    if (options.includeImages) prompt += `\nAdd '${IMAGE_PROMPT_MARKER}' image prompt at end.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });

    let newContent = response.text || "";
    let image: string | undefined = undefined;
    if (options.includeImages && newContent.includes(IMAGE_PROMPT_MARKER)) {
        const parts = newContent.split(IMAGE_PROMPT_MARKER);
        newContent = parts[0].trim();
        if (parts[1]?.trim()) image = await generateImage(ai, parts[1].trim());
    }
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(u => !!u) || [];
    return { content: newContent, sources: sources as string[], image };
};
