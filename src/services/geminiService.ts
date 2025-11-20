import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Outline, EnhanceOptions } from '../types';

// Helper para criar a instância da IA com a chave fornecida pelo usuário na hora
const getAi = (apiKey: string) => new GoogleGenAI({ apiKey });
const IMAGE_PROMPT_MARKER = "IMAGE_PROMPT:";

// Função auxiliar para gerar imagem usando a instância autenticada
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
        // Passo 1: Criar um prompt descritivo para a imagem
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
        
        // Passo 2: Gerar a imagem com o prompt criado
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
    const numChapters = Math.max(3, Math.ceil((averagePageCount * 400) / 800));
    const observationsPrompt = observations ? `\n\nAdditional instructions from the user: "${observations}"` : "";
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Your task is to create a detailed outline for an e-book on the topic: '${topic}'.
The target audience is the general public.
To achieve a length between ${minPageCount} and ${maxPageCount} pages, generate exactly ${numChapters} thematic chapter titles. 
Do not include 'Introduction' or 'Conclusion' in this list.
The entire response must be in ${language}.${observationsPrompt}
You must respond with a JSON object.`,
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
        console.error("Error generating outline:", error);
        throw new Error("Falha ao gerar o esboço do e-book.");
    }
};

export const generateChapterContent = async (apiKey: string, ebookTitle: string, chapterTitle: string, language: string, includeImages: boolean, observations: string) => {
    const ai = getAi(apiKey);
    const observationsPrompt = observations ? `\n\nAdditional instructions: "${observations}"` : "";

    let prompt = `Write a chapter '${chapterTitle}' for e-book '${ebookTitle}' in ${language}. Approx 800-1000 words. ${observationsPrompt}`;
    
    if (includeImages) {
        prompt += `\n\nAfter the content, on a new line, add the text "${IMAGE_PROMPT_MARKER}" followed by a concise, descriptive, and visually rich prompt (in English) for an AI image generator that captures the essence of this chapter.`;
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
        console.error(`Error generating chapter ${chapterTitle}:`, error);
        return { content: `Erro ao gerar capítulo. Tente novamente.`, sources: [], image: undefined };
    }
};

export const selectTopReferences = async (apiKey: string, references: Set<string>, topic: string, language: string): Promise<Set<string>> => {
    if (references.size <= 3) return references;
    const ai = getAi(apiKey);
    try {
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
    } catch (e) {
        return new Set([...references].slice(0, 3));
    }
};

export const structureText = async (apiKey: string, fullText: string) => {
    const ai = getAi(apiKey);
    try {
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
    } catch (error) {
        throw new Error("Falha ao estruturar o texto.");
    }
};

export const enhanceChapterContent = async (apiKey: string, title: string, content: string, options: EnhanceOptions) => {
    const ai = getAi(apiKey);
    let styleInstruction = "";
    switch (options.style) {
        case 'MoreFormal': styleInstruction = "Rewrite in a formal tone."; break;
        case 'MoreCasual': styleInstruction = "Rewrite in a casual tone."; break;
        case 'MoreDidactic': styleInstruction = "Rewrite in a didactic tone."; break;
        default: styleInstruction = "Correct grammar and improve clarity.";
    }

    let prompt = `Enhance chapter '${title}'. ${styleInstruction} Translate to ${options.language}. Content: ${content}`;
    
    if (options.includeImages) {
        prompt += `\nAdd '${IMAGE_PROMPT_MARKER}' image prompt at end.`;
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