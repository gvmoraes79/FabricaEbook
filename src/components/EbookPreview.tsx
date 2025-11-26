import React, { forwardRef, useState, useEffect } from 'react';
import type { Ebook } from '../types';

interface EbookPreviewProps {
    ebook: Ebook;
    diagramming: boolean;
    onUpdateChapter?: (index: number, newContent: string) => void;
}

const markdownToHtml = (text: string): string => {
    let html = text
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-4 mb-2 break-inside-avoid">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 break-inside-avoid">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-8 mb-4 break-inside-avoid">$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p class="mb-4 break-inside-avoid">')
        .replace(/\n/g, '<br />');
    return `<p class="mb-4 break-inside-avoid">${html}</p>`;
};

export const EbookPreview = forwardRef<HTMLDivElement, EbookPreviewProps>(({ ebook, diagramming, onUpdateChapter }, ref) => {
    const [editingChapterIndex, setEditingChapterIndex] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [copied, setCopied] = useState(false);

    const startEditing = (index: number, content: string) => {
        setEditingChapterIndex(index);
        setEditContent(content);
    };

    const saveEditing = (index: number) => {
        if (onUpdateChapter) {
            onUpdateChapter(index, editContent);
        }
        setEditingChapterIndex(null);
    };

    const cancelEditing = () => {
        setEditingChapterIndex(null);
        setEditContent('');
    };

    const copyAllText = () => {
        let fullText = `# ${ebook.title}\n\n`;
        ebook.chapters.forEach(c => {
            fullText += `## ${c.title}\n\n${c.content}\n\n`;
        });
        navigator.clipboard.writeText(fullText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="bg-slate-800 p-4 md:p-8 rounded-lg max-h-[70vh] overflow-y-auto border border-slate-700 flex flex-col items-center">
            
            {/* Toolbar de Ações Rápidas */}
            <div className="w-full max-w-[595pt] flex justify-end mb-4 gap-2">
                 <button 
                    onClick={copyAllText}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-cyan-400 py-1 px-3 rounded border border-slate-600 transition"
                >
                    {copied ? 'Copiado!' : 'Copiar Tudo (Markdown)'}
                </button>
            </div>

            <style>
                {`
                    .break-inside-avoid {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .pdf-container img {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        max-width: 100%;
                    }
                    .chapter-container {
                        page-break-before: always;
                    }
                    .chapter-container:first-of-type {
                        page-break-before: auto;
                    }
                `}
            </style>
            
            <div ref={ref} className="bg-white text-slate-800 font-serif shadow-lg pdf-container" style={{ width: '595pt' }}>
                {diagramming && ebook.coverImage && (
                    <div className="w-full flex flex-col items-center justify-center text-center p-0 break-inside-avoid relative group" style={{ height: '842pt', pageBreakAfter: 'always' }}>
                         <div className="w-full h-3/5 relative">
                             <img src={`data:image/png;base64,${ebook.coverImage}`} className="w-full h-full object-cover"/>
                        </div>
                        <div className="w-full h-2/5 flex flex-col justify-center p-12">
                            <h1 className="text-5xl font-bold text-slate-900 mb-4">{ebook.title}</h1>
                            <p className="text-2xl text-slate-600">Guia Completo</p>
                        </div>
                    </div>
                )}
                
                <div style={{ padding: '40pt 50pt' }}>
                    {ebook.chapters.map((chapter, index) => (
                        <div key={index} className={`pt-8 ${index > 0 ? 'chapter-container' : ''} group relative`}>
                            
                            {/* Header do Capítulo */}
                            <div className="flex justify-between items-center mb-6 break-inside-avoid">
                                <h2 className="text-3xl font-bold text-slate-900">{chapter.title}</h2>
                                {onUpdateChapter && editingChapterIndex !== index && (
                                    <button 
                                        onClick={() => startEditing(index, chapter.content)}
                                        data-html2canvas-ignore="true"
                                        className="opacity-0 group-hover:opacity-100 text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition"
                                    >
                                        Editar Texto
                                    </button>
                                )}
                            </div>
                            
                            {chapter.image && (
                                <div className="mb-6 flex justify-center break-inside-avoid">
                                    <img src={`data:image/png;base64,${chapter.image}`} className="max-w-md h-auto rounded-lg shadow-lg" />
                                </div>
                            )}
                            
                            {/* Área de Conteúdo ou Editor */}
                            {editingChapterIndex === index ? (
                                <div className="mb-8" data-html2canvas-ignore="true">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-96 p-4 border-2 border-blue-400 rounded-lg font-mono text-sm bg-slate-50 focus:outline-none"
                                    />
                                    <div className="flex gap-2 mt-2 justify-end">
                                        <button onClick={cancelEditing} className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded">Cancelar</button>
                                        <button onClick={() => saveEditing(index)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar Alterações</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-justify leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content) }} />
                            )}
                        </div>
                    ))}
                    
                    {ebook.references.size > 0 && (
                        <div className="pt-12 border-t mt-8 break-inside-avoid">
                             <h2 className="text-2xl font-bold mb-4">Referências</h2>
                             <ul className="list-disc pl-5">
                                {[...ebook.references].map((ref, i) => (
                                    <li key={i} className="text-sm text-blue-600 break-words mb-2">{ref}</li>
                                ))}
                             </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});