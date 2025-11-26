import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Ebook, Chapter, EnhanceOptions } from './types';
import { generateOutline, generateChapterContent, generateCoverImage, selectTopReferences, structureText, enhanceChapterContent } from './services/geminiService';
import { extractTextFromFile } from './services/fileService';
import { generatePdf } from './services/pdfService';
import { EbookPreview } from './components/EbookPreview';
import { TopicForm } from './components/TopicForm';
import { EnhanceForm } from './components/EnhanceForm';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [tempKey, setTempKey] = useState('');
    const [ebook, setEbook] = useState<Ebook | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'create' | 'enhance'>('create');
    const [isDiagrammed, setIsDiagrammed] = useState<boolean>(true);
    const ebookPreviewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) setApiKey(storedKey);
    }, []);

    const handleSaveKey = () => {
        if (tempKey.trim()) {
            localStorage.setItem('gemini_api_key', tempKey);
            setApiKey(tempKey);
        }
    };

    const handleGenerateEbook = useCallback(async (currentTopic: string, minPageCount: number, maxPageCount: number, language: string, includeImages: boolean, observations: string) => {
        setIsLoading(true);
        setError(null);
        setEbook(null);
        setIsDiagrammed(true);

        try {
            setStatusMessage('Elaborando o plano...');
            const outline = await generateOutline(apiKey, currentTopic, minPageCount, maxPageCount, language, observations);

            setStatusMessage('Criando capa...');
            const coverImage = await generateCoverImage(apiKey, outline.title, currentTopic);

            const generatedEbook: Ebook = {
                title: outline.title,
                topic: currentTopic,
                chapters: [],
                references: new Set<string>(),
                coverImage: coverImage,
            };
            
            setEbook({ ...generatedEbook });

            const chapterTitles = ['Introdução', ...outline.chapters, 'Conclusão'];

            for (let i = 0; i < chapterTitles.length; i++) {
                const chapterTitle = chapterTitles[i];
                setStatusMessage(`Escrevendo: ${chapterTitle}`);
                
                const result = await generateChapterContent(apiKey, outline.title, chapterTitle, language, includeImages, observations);
                
                if (result) {
                    generatedEbook.chapters.push({ title: chapterTitle, content: result.content, image: result.image });
                    result.sources.forEach((source: string) => generatedEbook.references.add(source));
                    setEbook({ ...generatedEbook });
                }
            }

            setStatusMessage('Finalizando...');
            const topRefs = await selectTopReferences(apiKey, generatedEbook.references, generatedEbook.topic, language);
            generatedEbook.references = topRefs;
            setEbook({ ...generatedEbook });
            setStatusMessage('Sucesso!');

        } catch (err) {
            console.error(err);
            setError('Erro ao gerar. Verifique sua chave API.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);
    
    const handleEnhanceEbook = useCallback(async (file: File, options: EnhanceOptions) => {
        setIsLoading(true);
        setError(null);
        setEbook(null);
        setIsDiagrammed(options.diagramming);

        try {
            setStatusMessage('Lendo arquivo...');
            const text = await extractTextFromFile(file);

            setStatusMessage('Estruturando...');
            const structuredDoc = await structureText(apiKey, text);
            
            let coverImage: string | undefined = undefined;
            if (options.diagramming) {
                setStatusMessage('Criando capa...');
                coverImage = await generateCoverImage(apiKey, structuredDoc.title, structuredDoc.title);
            }

            const generatedEbook: Ebook = {
                title: structuredDoc.title,
                topic: file.name,
                chapters: [],
                references: new Set<string>(),
                coverImage: coverImage,
            };
            setEbook({ ...generatedEbook });

            for (let i = 0; i < structuredDoc.chapters.length; i++) {
                const chapter = structuredDoc.chapters[i];
                setStatusMessage(`Aprimorando: ${chapter.title}`);
                const result = await enhanceChapterContent(apiKey, chapter.title, chapter.content, options);
                if (result) {
                    generatedEbook.chapters.push({ title: chapter.title, content: result.content, image: result.image });
                    result.sources.forEach((source: string) => generatedEbook.references.add(source));
                    setEbook({ ...generatedEbook });
                }
            }
            setStatusMessage('Sucesso!');
        } catch (err) {
            setError('Erro ao processar arquivo.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);

    const handleUpdateChapter = useCallback((index: number, newContent: string) => {
        setEbook(prev => {
            if (!prev) return null;
            const updatedChapters = [...prev.chapters];
            updatedChapters[index] = { ...updatedChapters[index], content: newContent };
            return { ...prev, chapters: updatedChapters };
        });
    }, []);

    const handleDownloadPdf = useCallback(async () => {
        if (!ebookPreviewRef.current || !ebook) return;
        setStatusMessage('Gerando PDF...');
        setIsLoading(true);
        try {
            await generatePdf(ebookPreviewRef.current, ebook.title);
        } catch(err) {
            setError("Erro ao salvar PDF.");
        } finally {
            setIsLoading(false);
        }
    }, [ebook]);

    const handleDownloadTxt = useCallback(() => {
        if (!ebook) return;
        let textContent = `# ${ebook.title}\n\n`;
        ebook.chapters.forEach(chapter => {
            textContent += `## ${chapter.title}\n\n${chapter.content}\n\n`;
        });
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ebook.title.replace(/ /g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [ebook]);

    if (!apiKey) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-900 text-white">
                <Header />
                <div className="flex-grow flex items-center justify-center p-4">
                    <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
                        <h2 className="text-2xl font-bold mb-4 text-cyan-400 text-center">Login</h2>
                        <input 
                            type="password" 
                            value={tempKey} 
                            onChange={(e) => setTempKey(e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 mb-4 text-white"
                            placeholder="Cole sua Chave API do Google..."
                        />
                        <button onClick={handleSaveKey} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg">Entrar</button>
                         <p className="text-xs text-center text-slate-500 mt-4">
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-cyan-400 underline">Gerar chave grátis</a>
                        </p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center">
                <div className="w-full max-w-xl mb-6 flex border-b border-slate-700">
                    <button onClick={() => setMode('create')} disabled={isLoading} className={`flex-1 py-2 ${mode === 'create' ? 'border-b-2 border-cyan-400 text-white' : 'text-slate-400'}`}>Criar do Zero</button>
                    <button onClick={() => setMode('enhance')} disabled={isLoading} className={`flex-1 py-2 ${mode === 'enhance' ? 'border-b-2 border-cyan-400 text-white' : 'text-slate-400'}`}>Aprimorar</button>
                </div>

                {mode === 'create' ? <TopicForm onSubmit={handleGenerateEbook} isLoading={isLoading} /> : <EnhanceForm onSubmit={handleEnhanceEbook} isLoading={isLoading} />}

                {error && <p className="text-red-400 mt-4 bg-red-900/50 p-3 rounded-md">{error}</p>}
                {isLoading && !ebook && <Loader message={statusMessage} />}

                {ebook && (
                    <div className="w-full max-w-4xl mt-12">
                         <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                            <h3 className="text-2xl font-bold text-white">Resultado</h3>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <button onClick={() => { setApiKey(''); localStorage.removeItem('gemini_api_key'); }} className="text-sm text-slate-400 underline px-3">Sair</button>
                                <button onClick={handleDownloadTxt} disabled={isLoading} className="px-4 py-2 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition">
                                    Baixar Texto (.txt)
                                </button>
                                <button onClick={handleDownloadPdf} disabled={isLoading} className="px-6 py-2 bg-cyan-500 text-slate-900 font-bold rounded-lg hover:bg-cyan-600 transition shadow-lg shadow-cyan-500/20">
                                    {isLoading ? 'Gerando...' : 'Baixar PDF'}
                                </button>
                            </div>
                        </div>
                        <EbookPreview 
                            ref={ebookPreviewRef} 
                            ebook={ebook} 
                            diagramming={isDiagrammed} 
                            onUpdateChapter={handleUpdateChapter}
                        />
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default App;