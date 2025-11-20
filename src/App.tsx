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
    const [topic, setTopic] = useState<string>('');
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
        if (!currentTopic.trim()) {
            setError('Por favor, insira um tópico.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setEbook(null);
        setTopic(currentTopic);
        setIsDiagrammed(true);

        try {
            setStatusMessage('Elaborando o plano... (Gerando esboço)');
            const outline = await generateOutline(apiKey, currentTopic, minPageCount, maxPageCount, language, observations);

            setStatusMessage('Criando uma capa incrível...');
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
                let statusMsg = `Dando vida às ideias... (Escrevendo: ${chapterTitle})`;
                if (includeImages) {
                    statusMsg += ' e criando imagem';
                }
                setStatusMessage(statusMsg);

                const result = await generateChapterContent(apiKey, outline.title, chapterTitle, language, includeImages, observations);
                
                if (result) {
                    generatedEbook.chapters.push({ title: chapterTitle, content: result.content, image: result.image });
                    result.sources.forEach(source => generatedEbook.references.add(source));
                    setEbook({ ...generatedEbook });
                }
            }

            if (generatedEbook.references.size > 3) {
                setStatusMessage('Selecionando as fontes mais importantes...');
                const topReferences = await selectTopReferences(apiKey, generatedEbook.references, generatedEbook.topic, language);
                generatedEbook.references = topReferences;
                setEbook({ ...generatedEbook });
            }
            
            setStatusMessage('E-book gerado com sucesso!');

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao gerar o e-book. Verifique sua chave API e tente novamente.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);
    
    const handleEnhanceEbook = useCallback(async (file: File, options: EnhanceOptions) => {
        setIsLoading(true);
        setError(null);
        setEbook(null);
        setTopic(file.name);
        setIsDiagrammed(options.diagramming);

        try {
            setStatusMessage('Analisando seu documento...');
            const text = await extractTextFromFile(file);

            setStatusMessage('Identificando a estrutura do e-book...');
            const structuredDoc = await structureText(apiKey, text);
            
            let coverImage: string | undefined = undefined;
            if (options.diagramming) {
                setStatusMessage('Criando uma capa incrível...');
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
                let statusMsg = `Aprimorando capítulo: ${chapter.title}`;
                 if (options.includeImages) {
                    statusMsg += ' e criando imagem';
                }
                setStatusMessage(statusMsg);

                const result = await enhanceChapterContent(apiKey, chapter.title, chapter.content, options);

                if (result) {
                    const newChapter: Chapter = {
                        title: chapter.title,
                        content: result.content,
                        image: result.image,
                    };
                    generatedEbook.chapters.push(newChapter);
                    result.sources.forEach(source => generatedEbook.references.add(source));
                    setEbook({ ...generatedEbook });
                }
            }
            
            if (generatedEbook.references.size > 3) {
                setStatusMessage('Selecionando as fontes mais importantes...');
                const topReferences = await selectTopReferences(apiKey, generatedEbook.references, generatedEbook.topic, options.language);
                generatedEbook.references = topReferences;
                setEbook({ ...generatedEbook });
            }

            setStatusMessage('E-book aprimorado com sucesso!');

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
            setError(`Ocorreu um erro ao aprimorar o e-book. Detalhes: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);

    const handleDownloadPdf = useCallback(async () => {
        if (!ebookPreviewRef.current || !ebook) return;
        setStatusMessage('Preparando seu PDF...');
        setIsLoading(true);
        try {
            await generatePdf(ebookPreviewRef.current, ebook.title);
        } catch(err) {
            console.error("PDF generation failed:", err);
            setError("Não foi possível gerar o PDF. Por favor, tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }, [ebook]);

    if (!apiKey) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-900 text-white">
                <Header />
                <div className="flex-grow flex items-center justify-center p-4">
                    <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
                        <h2 className="text-2xl font-bold mb-4 text-cyan-400 text-center">Bem-vindo</h2>
                        <p className="text-slate-300 mb-6 text-center">
                            Para usar a Fábrica de E-books, insira sua chave API do Google Gemini. A chave será salva apenas no seu navegador.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Chave API (Gemini)</label>
                                <input 
                                    type="password" 
                                    value={tempKey} 
                                    onChange={(e) => setTempKey(e.target.value)} 
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    placeholder="Cole sua chave aqui..."
                                />
                            </div>
                            <button 
                                onClick={handleSaveKey} 
                                className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg transition duration-200"
                            >
                                Entrar
                            </button>
                            <p className="text-xs text-center text-slate-500 mt-4">
                                Não tem uma chave? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Gerar chave grátis no Google AI Studio</a>
                            </p>
                        </div>
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
                <div className="w-full max-w-4xl text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">Sua Fábrica de E-books com IA</h2>
                    <p className="text-slate-400 mb-8 text-lg">
                       Crie um e-book do zero ou aprimore um documento existente com correções, traduções e imagens.
                    </p>
                </div>
                
                <div className="w-full max-w-xl mb-6">
                    <div className="flex border-b border-slate-700">
                        <button onClick={() => setMode('create')} disabled={isLoading} className={`px-4 py-2 text-lg font-semibold transition-colors duration-300 disabled:opacity-50 ${mode === 'create' ? 'border-b-2 border-cyan-400 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Criar do Zero
                        </button>
                        <button onClick={() => setMode('enhance')} disabled={isLoading} className={`px-4 py-2 text-lg font-semibold transition-colors duration-300 disabled:opacity-50 ${mode === 'enhance' ? 'border-b-2 border-cyan-400 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Aprimorar Documento
                        </button>
                    </div>
                </div>

                {mode === 'create' ? (
                    <TopicForm onSubmit={handleGenerateEbook} isLoading={isLoading} />
                ) : (
                    <EnhanceForm onSubmit={handleEnhanceEbook} isLoading={isLoading} />
                )}

                {error && <p className="text-red-400 mt-4 bg-red-900/50 p-3 rounded-md">{error}</p>}
                
                {isLoading && !ebook && <Loader message={statusMessage} />}

                {ebook && (
                    <div className="w-full max-w-4xl mt-12">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-white">Seu E-book está Pronto</h3>
                            <div className="flex gap-3">
                                <button onClick={() => setApiKey('')} className="px-4 py-2 text-sm text-slate-400 hover:text-white underline">Trocar Chave API</button>
                                <button
                                    onClick={handleDownloadPdf}
                                    disabled={isLoading}
                                    className="px-6 py-2 bg-cyan-500 text-slate-900 font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition duration-300 ease-in-out disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
                                >
                                    {isLoading && statusMessage.includes('PDF') ? 'Gerando...' : 'Baixar como PDF'}
                                </button>
                            </div>
                        </div>
                        <EbookPreview ref={ebookPreviewRef} ebook={ebook} diagramming={isDiagrammed} />
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default App;