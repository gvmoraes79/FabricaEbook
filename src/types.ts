export interface Outline {
    title: string;
    chapters: string[];
}

export interface Chapter {
    title: string;
    content: string;
    image?: string;
}

export interface Ebook {
    title: string;
    topic: string;
    chapters: Chapter[];
    references: Set<string>;
    coverImage?: string;
}

export interface EnhanceOptions {
    style: 'AsIs' | 'MoreFormal' | 'MoreCasual' | 'MoreDidactic';
    language: string;
    includeImages: boolean;
    diagramming: boolean;
    observations?: string;
}