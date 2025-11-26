import React, { forwardRef, useState } from 'react';
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
        .replace(/\n\n/g, '</p><p class="mb-4 break-inside-avoid text-lg leading-relaxed">')
        .replace(/\n/g, '<br />');
    return `<p class="mb-4 break-inside-avoid text-lg leading-relaxed">${html}</p>`;
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
        <div className="bg-slate-800 p-4 md:p-8 rounded-lg max-h-[85vh] overflow-y-auto border border-slate-700 flex flex-col items-center">
            
            {/* Toolbar de Ações Rápidas (Não sai no PDF) */}
            <div className="w-full max-w-[595pt] flex justify-end mb-4 gap-2 sticky top-0 z-10 bg-slate-800 py-2 border-b border-slate-700" data-html2canvas-ignore="true">
                 <span className="text-slate-400 text-sm self-center mr-auto">Modo de Visualização e Edição</span>
                 <button 
                    onClick={copyAllText}
                    className="text-sm bg-slate-700 hover:bg-slate-600 text-cyan-400 py-2 px-4 rounded border border-slate-600 transition font-semibold flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    {copied ? 'Copiado!' : 'Copiar Tudo'}
                </button>
            </div>

            <style>
                {`
                    .break-inside-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .pdf-container img {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        max-width: 100%;
                    }
                    /* Garante que cada capitulo comece em nova pagina se necessário, mas tenta evitar buracos */
                    .chapter-section {
                        margin-bottom: 2rem;
                    }
                `}
            </style>
            
            <div ref={ref} className="bg-white text-slate-900 font-serif shadow-2xl pdf-container" style={{ width: '595pt', minHeight: '842pt' }}>
                
                {/* CAPA */}
                {diagramming && ebook.coverImage && (
                    <div className="w-full flex flex-col items-center justify-center text-center p-0 break-inside-avoid relative" style={{ height: '842pt', pageBreakAfter: 'always' }}>
                         <div className="w-full h-3/5 relative bg-slate-100 overflow-hidden">
                             <img src={`data:image/png;base64,${ebook.coverImage}`} className="w-full h-full object-cover"/>
                        </div>
                        <div className="w-full h-2/5 flex flex-col justify-center p-16 bg-slate-50">
                            <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">{ebook.title}</h1>
                            <div className="w-24 h-1 bg-cyan-500 mx-auto mb-6"></div>
                            <p className="text-2xl text-slate-600">Um Guia Completo</p>
                        </div>
                    </div>
                )}
                
                {/* CONTEÚDO */}
                <div style={{ padding: '50pt 50pt' }}>
                    
                    {/* Índice */}
                    {diagramming && (
                        <div className="mb-16 break-inside-avoid" style={{ pageBreakAfter: 'always' }}>
                            <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2 border-slate-200">Índice</h2>
                            <ul className="space-y-4 text-lg">
                                {ebook.chapters.map((chapter, index) => (
                                    <li key={index} className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                        <span><span className="font-bold text-cyan-700 mr-3">{index + 1}.</span>{chapter.title}</span>
                                    </li>
                                ))}
                                {ebook.references.size > 0 && (
                                    <li className="flex justify-between border-b border-dotted border-slate-300 pb-1 mt-4">
                                        <span className="font-semibold text-slate-600">Referências Bibliográficas</span>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Capítulos */}
                    {ebook.chapters.map((chapter, index) => (
                        <div key={index} className="chapter-section pb-8">
                            
                            {/* Título e Botão de Editar */}
                            <div className="flex justify-between items-start mb-6 break-inside-avoid">
                                <h2 className="text-3xl font-bold text-cyan-900 border-l-4 border-cyan-500 pl-4">{chapter.title}</h2>
                                {onUpdateChapter && editingChapterIndex !== index && (
                                    <button 
                                        onClick={() => startEditing(index, chapter.content)}
                                        data-html2canvas-ignore="true"
                                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition font-medium border border-blue-200 shadow-sm"
                                    >
                                        Editar Texto
                                    </button>
                                )}
                            </div>
                            
                            {/* Imagem do Capítulo */}
                            {chapter.image && (
                                <div className="mb-8 flex justify-center break-inside-avoid">
                                    <img src={`data:image/png;base64,${chapter.image}`} className="max-w-full h-auto rounded shadow-md max-h-[300pt]" />
                                </div>
                            )}
                            
                            {/* Editor ou Texto */}
                            {editingChapterIndex === index ? (
                                <div className="mb-8 p-4 bg-slate-50 border rounded-lg" data-html2canvas-ignore="true">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-96 p-4 border border-slate-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="flex gap-3 mt-3 justify-end">
                                        <button onClick={cancelEditing} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">Cancelar</button>
                                        <button onClick={() => saveEditing(index)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm">Salvar Alterações</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-justify leading-loose text-lg text-slate-800 font-light" dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content) }} />
                            )}
                        </div>
                    ))}
                    
                    {/* Referências */}
                    {ebook.references.size > 0 && (
                        <div className="pt-12 border-t-2 border-slate-200 mt-8 break-inside-avoid" style={{ pageBreakBefore: 'always' }}>
                             <h2 className="text-2xl font-bold mb-6 text-slate-900">Referências e Fontes</h2>
                             <ul className="space-y-3">
                                {[...ebook.references].map((ref, i) => (
                                    <li key={i} className="text-sm text-slate-500 break-all bg-slate-50 p-2 rounded">
                                        {ref}
                                    </li>
                                ))}
                             </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});