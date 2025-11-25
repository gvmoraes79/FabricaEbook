import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Outline, EnhanceOptions } from '../types';

// Helper para instanciar a IA com a chave fornecida dinamicamente pelo usuário
const getAi = (apiKey: string) => new GoogleGenAI({ apiKey });
const IMAGE_PROMPT_MARKER = "IMAGE_PROMPT:";

// Função auxiliar para gerar imagens
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
            contents: `Create a single, concise, and visually rich prompt (in English) for an AI image generator to create a stunning e-book cover.
            Title: "${title}"
            Topic: "${topic}"
            Style: Professional, high quality, minimal text.
            Return ONLY the prompt text.`
        });

        const imagePrompt = promptResponse.text ? promptResponse.text.trim() : "";
        
        if (imagePrompt) {
            return await generateImage(ai, imagePrompt);
        }
        return undefined;
    } catch(error) {
        console.error("Error generating cover:", error);
        return undefined;
    }
};

export const generateOutline = async (apiKey: string, topic: string, minPageCount: number, maxPageCount: number, language: string, observations: string): Promise<Outline> => {
    const ai = getAi(apiKey);
    const averagePageCount = Math.ceil((minPageCount + maxPageCount) / 2);
    // Estimativa de capítulos baseada no número de páginas (aprox 2-3 paginas por capitulo)
    const numChapters = Math.max(3, Math.ceil(averagePageCount / 3));
    const observationsPrompt = observations ? `\nInstructions: "${observations}"` : "";
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Create an e-book outline about '${topic}'.
Target length: ${minPageCount}-${maxPageCount} pages.
Generate exactly ${numChapters} chapter titles.
Language: ${language}.
${observationsPrompt}
Return JSON format.`,
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
    } catch (error) {
        console.error("Error outline:", error);
        throw new Error("Falha ao gerar o esboço.");
    }
};

export const generateChapterContent = async (apiKey: string, ebookTitle: string, chapterTitle: string, language: string, includeImages: boolean, observations: string) => {
    const ai = getAi(apiKey);
    const observationsPrompt = observations ? `\nInstructions: "${observations}"` : "";

    let prompt = `Write chapter '${chapterTitle}' for e-book '${ebookTitle}'.
Language: ${language}.
Length: Approx 800 words.
Tone: Engaging and informative.
${observationsPrompt}`;
    
    if (includeImages) {
        prompt += `\n\nAt the end, add "${IMAGE_PROMPT_MARKER}" followed by an image generation prompt (in English) describing a scene for this chapter.`;
    }

    try {
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
            const imagePrompt = parts[1]?.trim();
            if (imagePrompt) {
                image = await generateImage(ai, imagePrompt);
            }
        }
        
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(u => !!u) || [];
        return { content, sources: sources as string[], image };
    } catch (error) {
        console.error(`Error chapter ${chapterTitle}:`, error);
        return { content: "Erro ao gerar conteúdo deste capítulo.", sources: [], image: undefined };
    }
};

export const selectTopReferences = async (apiKey: string, references: Set<string>, topic: string, language: string): Promise<Set<string>> => {
    if (references.size <= 3) return references;
    const ai = getAi(apiKey);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Select top 3 most relevant sources for '${topic}' from this list: ${[...references].join('\n')}.
Return JSON with 'top_sources' array.`,
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
    } catch (e) {
        return new Set([...references].slice(0, 3));
    }
};

export const structureText = async (apiKey: string, fullText: string) => {
    const ai = getAi(apiKey);
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Structure this text into an e-book JSON format with title and chapters: ${fullText.substring(0, 30000)}`, // Limit input to avoid token limits
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
    } catch (error) {
        throw new Error("Falha ao estruturar o texto.");
    }
};

export const enhanceChapterContent = async (apiKey: string, title: string, content: string, options: EnhanceOptions) => {
    const ai = getAi(apiKey);
    let prompt = `Enhance chapter '${title}'.
Style: ${options.style}.
Language: ${options.language}.
Content: ${content}`;
    
    if (options.includeImages) {
        prompt += `\nAdd '${IMAGE_PROMPT_MARKER}' followed by an image prompt at the end.`;
    }
    
    try {
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
            const imagePrompt = parts[1]?.trim();
            if (imagePrompt) {
                image = await generateImage(ai, imagePrompt);
            }
        }
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(u => !!u) || [];
        return { content: newContent, sources: sources as string[], image };
    } catch (error) {
        throw new Error(`Falha ao aprimorar capítulo: ${title}`);
    }
};