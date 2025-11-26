import React, { forwardRef } from 'react';
import type { Ebook } from '../types';

interface EbookPreviewProps {
    ebook: Ebook;
    diagramming: boolean;
}

const markdownToHtml = (text: string): string => {
    let html = text
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-4 mb-2 break-inside-avoid">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 break-inside-avoid">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-8 mb-4 break-inside-avoid">$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p class="mb-4 break-inside-avoid">') // Adiciona classe para evitar quebra
        .replace(/\n/g, '<br />');
    return `<p class="mb-4 break-inside-avoid">${html}</p>`;
};

export const EbookPreview = forwardRef<HTMLDivElement, EbookPreviewProps>(({ ebook, diagramming }, ref) => {
    return (
        <div className="bg-slate-800 p-4 md:p-8 rounded-lg max-h-[70vh] overflow-y-auto border border-slate-700 flex justify-center">
            {/* Estilos inline para garantir que o html2canvas capture as regras de quebra de página */}
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
                    /* Força a primeira página a não quebrar antes */
                    .chapter-container:first-of-type {
                        page-break-before: auto;
                    }
                `}
            </style>
            
            <div ref={ref} className="bg-white text-slate-800 font-serif shadow-lg pdf-container" style={{ width: '595pt' }}>
                {diagramming && ebook.coverImage && (
                    <div className="w-full flex flex-col items-center justify-center text-center p-0 break-inside-avoid" style={{ height: '842pt', pageBreakAfter: 'always' }}>
                         <div className="w-full h-3/5 relative">
                             <img src={`data:image/png;base64,${ebook.coverImage}`} className="w-full h-full object-cover"/>
                        </div>
                        <div className="w-full h-2/5 flex flex-col justify-center p-12">
                            <h1 className="text-5xl font-bold text-slate-900 mb-4">{ebook.title}</h1>
                            <p className="text-2xl text-slate-600">Guia Completo</p>
                        </div>
                    </div>
                )}
                
                {/* Ajustei o padding visual, mas o pdfService cuidará das margens reais do documento */}
                <div style={{ padding: '40pt 50pt' }}>
                    {ebook.chapters.map((chapter, index) => (
                        <div key={index} className={`pt-8 ${index > 0 ? 'chapter-container' : ''}`}>
                            <h2 className="text-3xl font-bold text-slate-900 mb-6 break-inside-avoid">{chapter.title}</h2>
                            
                            {chapter.image && (
                                <div className="mb-6 flex justify-center break-inside-avoid">
                                    <img src={`data:image/png;base64,${chapter.image}`} className="max-w-md h-auto rounded-lg shadow-lg" />
                                </div>
                            )}
                            
                            <div className="text-justify leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: markdownToHtml(chapter.content) }} />
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