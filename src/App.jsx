import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, BookOpen, Image, Loader2, Link, Zap, Search, Globe, FileText, Maximize2, MessageSquare } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Variáveis Globais MANDATÓRIAS (fornecidas pelo ambiente Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Configurações e URLs da API Gemini/Imagen
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const IMAGEN_MODEL = "imagen-4.0-generate-001";
const apiKey = ""; // Deixar vazio para ser fornecido pelo ambiente
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
const IMAGEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;

// --- Funções de Utilitário ---

// Função de pausa para o backoff exponencial
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função Polyfill para atob (necessária em alguns ambientes)
if (typeof atob === 'undefined') {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

/**
 * Função genérica para chamar a API com backoff exponencial.
 * @param {string} url URL da API.
 * @param {object} payload Dados a serem enviados.
 * @returns {object} Resultado da API.
 */
const apiCallWithBackoff = async (url, payload) => {
  let retries = 0;
  const maxRetries = 5;
  let delay = 1000;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 429) {
        retries++;
        if (retries < maxRetries) {
          await sleep(delay);
          delay *= 2;
          continue;
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro de API (${response.status}): ${response.statusText}. Detalhes: ${errorBody}`);
      }

      return await response.json();
    } catch (e) {
      console.error(`Erro na chamada da API (Tentativa ${retries + 1}):`, e.message);
      retries++;
      if (retries < maxRetries) {
        await sleep(delay);
        delay *= 2;
      } else {
        throw new Error(`Falha total ao conectar à API após ${maxRetries} tentativas.`);
      }
    }
  }
};


// --- Componente Principal ---

const App = () => {
  // --- Estados de Autenticação e Firebase ---
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  // --- Estados do Gerador de Ebook (Texto) - Campos do Formulário ---
  const [textPrompt, setTextPrompt] = useState('A história da inteligência artificial e seu impacto no mercado de trabalho.');
  const [idioma, setIdioma] = useState('Português (Brasil)');
  const [minPages, setMinPages] = useState(5);
  const [maxPages, setMaxPages] = useState(10);
  const [observacoes, setObservacoes] = useState('O tom deve ser profissional e otimista sobre o futuro da IA.');
  const [includeImages, setIncludeImages] = useState(true); // Novo estado para checkbox

  // --- Estados do Gerador de Ebook (Texto) - Resultado ---
  const [ebookText, setEbookText] = useState(null);
  const [textSources, setTextSources] = useState([]);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [textError, setTextError] = useState(null);

  // --- Estados do Gerador de Imagem ---
  const [imagePrompt, setImagePrompt] = useState('Uma capa de livro minimalista com o tema IA, cores neon, arte conceitual, 4k.');
  const [imageUrl, setImageUrl] = useState(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);

  // --- Configuração de Autenticação e Firebase ---
  useEffect(() => {
    try {
      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        console.log("Firebase config não encontrado. Prosseguindo sem autenticação.");
        setIsAuthReady(true);
        return;
      }
      
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app); 
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        }
        setUserId(auth.currentUser?.uid || crypto.randomUUID());
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Erro ao configurar o Firebase:", e);
      setAuthError("Erro ao configurar o sistema de autenticação.");
      setIsAuthReady(true);
    }
  }, []);

  // --- Lógica de Geração de Texto (Ebook) ---
  const generateEbookText = useCallback(async () => {
    if (!textPrompt.trim() || !isAuthReady || minPages <= 0 || maxPages <= 0 || minPages > maxPages) {
      setTextError("Verifique o prompt e as configurações de página. Min e Máx devem ser maiores que zero, e Min deve ser menor ou igual a Máx.");
      return;
    }

    setIsTextLoading(true);
    setTextError(null);
    setEbookText(null);
    setTextSources([]);

    // 1. CONSTRUÇÃO DO PROMPT DE SISTEMA DETALHADO
    const systemPrompt = `Você é um autor e editor de ebooks profissional. Seu objetivo é escrever um ebook completo no idioma "${idioma}". O conteúdo deve ter um tamanho aproximado que corresponda a entre ${minPages} e ${maxPages} páginas (considere 250 palavras por página).

Instruções Adicionais do Usuário:
- ${observacoes.trim() ? observacoes : "Nenhuma observação extra."}

Escreva o conteúdo solicitado de forma informativa, bem estruturada e envolvente. Sempre formate o resultado em blocos de parágrafos claros, **sem títulos ou subtítulos adicionais (apenas texto corrido)**. O tom deve ser baseado nas observações do usuário.`;
    
    const userQuery = `Gere o conteúdo para o tópico principal: "${textPrompt}"`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      tools: [{ "google_search": {} }], // Habilita a pesquisa na web (grounding)
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
    };

    try {
      const result = await apiCallWithBackoff(GEMINI_API_URL, payload);
      const candidate = result.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        const text = candidate.content.parts[0].text;
        setEbookText(text);

        // Extrai as fontes de pesquisa (citações)
        let sources = [];
        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title);
        }
        setTextSources(sources);

      } else {
        setTextError("A IA não conseguiu gerar o conteúdo do ebook. Tente reformular o prompt.");
      }
    } catch (e) {
      console.error(e);
      setTextError(e.message || "Erro desconhecido ao gerar o texto do ebook.");
    } finally {
      setIsTextLoading(false);
    }
  }, [textPrompt, isAuthReady, idioma, minPages, maxPages, observacoes]);

  // --- Lógica de Geração de Imagem ---
  const generateImage = useCallback(async () => {
    if (!imagePrompt.trim() || !isAuthReady) {
      setImageError("Por favor, digite um prompt para a imagem e aguarde a inicialização.");
      return;
    }

    setIsImageLoading(true);
    setImageError(null);
    setImageUrl(null);

    const payload = {
      instances: [{ prompt: imagePrompt }],
      parameters: {
        sampleCount: 1, 
        outputMimeType: "image/png",
        aspectRatio: "1:1", // Padrão para capa/ilustração
      }
    };

    try {
      const result = await apiCallWithBackoff(IMAGEN_API_URL, payload);

      if (result && result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        const base64Data = result.predictions[0].bytesBase64Encoded;
        const newImageUrl = `data:image/png;base64,${base64Data}`;
        setImageUrl(newImageUrl);
      } else {
        setImageError("A geração da imagem falhou ou o resultado estava vazio. Tente outro prompt.");
      }
    } catch (e) {
      console.error(e);
      setImageError(e.message || "Erro desconhecido ao gerar a imagem.");
    } finally {
      setIsImageLoading(false);
    }
  }, [imagePrompt, isAuthReady]);

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey && !isTextLoading) {
      generateEbookText();
    }
  };
  
  const handleImageKeyDown = (e) => {
    if (e.key === 'Enter' && !isImageLoading) {
      generateImage();
    }
  };

  const PageInput = ({ label, value, onChange }) => (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
        disabled={isTextLoading || !isAuthReady}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-7xl bg-white shadow-2xl rounded-3xl p-6 sm:p-10">
        
        {/* Título Principal */}
        <header className="text-center mb-10 border-b pb-4">
          <Sparkles className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Gerador Híbrido de Ebook 
          </h1>
          <p className="text-gray-500 mt-2">
            Seu assistente completo para conteúdo (Gemini) e visual (Imagen).
          </p>
          {authError && <p className="text-red-500 mt-2 text-sm">Autenticação: {authError}</p>}
        </header>

        {/* Layout de Duas Colunas (Texto e Imagem) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Coluna 1: Gerador de Conteúdo do Ebook (Texto) */}
          <section className="bg-indigo-50 p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center mb-6 border-b pb-3">
              <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
              1. Configuração e Conteúdo do Ebook
            </h2>
            
            <div className="space-y-6">
              {/* Tópico Principal (Prompt) */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1"/> Tópico Principal do Ebook
                </label>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none h-24"
                  placeholder="Ex: 'A história do café, da descoberta à cultura moderna'"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  disabled={isTextLoading || !isAuthReady}
                />
              </div>

              {/* Seletor de Idioma */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Globe className="w-4 h-4 mr-1"/> Idioma do Ebook
                </label>
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
                  disabled={isTextLoading || !isAuthReady}
                >
                  <option value="Português (Brasil)">Português (Brasil)</option>
                  <option value="Inglês (EUA)">Inglês (EUA)</option>
                  <option value="Espanhol">Espanhol</option>
                  <option value="Francês">Francês</option>
                  <option value="Alemão">Alemão</option>
                </select>
              </div>

              {/* Páginas Mínima e Máxima */}
              <div className="grid grid-cols-2 gap-4">
                <PageInput 
                  label="Páginas Mínimas (Estimado)"
                  value={minPages}
                  onChange={setMinPages}
                />
                <PageInput 
                  label="Páginas Máximas (Estimado)"
                  value={maxPages}
                  onChange={setMaxPages}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 italic">
                *A IA fará o possível para se aproximar desse intervalo de tamanho.
              </p>

              {/* Caixa de Observação */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1"/> Observações e Estilo (Opcional)
                </label>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none h-20"
                  placeholder="Ex: 'Usar vocabulário simples e didático', 'Focar na era medieval'"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={isTextLoading || !isAuthReady}
                />
              </div>

              {/* Checkbox para Imagens */}
              <div className="flex items-center pt-2">
                <input
                  id="includeImages"
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={isTextLoading || !isAuthReady}
                />
                <label htmlFor="includeImages" className="ml-2 block text-sm font-medium text-gray-700">
                  Incluir opção de geração de Capa/Ilustração por IA
                </label>
              </div>

              {/* Botão de Geração de Texto */}
              <button
                onClick={generateEbookText}
                disabled={isTextLoading || !isAuthReady}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition duration-200 shadow-lg 
                  ${isTextLoading || !isAuthReady ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'}`}
              >
                {isTextLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando Conteúdo do Ebook...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Gerar Conteúdo (Ctrl+Enter)
                  </>
                )}
              </button>
            </div>

            {/* Resultado do Texto */}
            <div className="mt-8 pt-4 border-t border-indigo-200">
              <h3 className="text-xl font-semibold text-gray-700 mb-3 flex items-center">
                <Maximize2 className="w-5 h-5 mr-1 text-indigo-600"/> Conteúdo Gerado
              </h3>
              <div className="min-h-[200px] bg-white p-4 rounded-xl shadow-inner border border-gray-200 whitespace-pre-wrap">
                {textError && (
                  <div className="p-3 text-red-700 bg-red-100 rounded-lg">
                    <p className="font-semibold">Erro na Geração de Texto:</p>
                    <p className="text-sm mt-1">{textError}</p>
                  </div>
                )}
                {isTextLoading && !textError && (
                  <div className="flex justify-center items-center h-full text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Aguardando resposta da IA (pode levar alguns segundos para conteúdo longo)...
                  </div>
                )}
                {ebookText && (
                  <>
                    <p className="text-gray-800 leading-relaxed">{ebookText}</p>
                    {textSources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-300">
                        <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                          <Zap className="w-4 h-4 mr-1 text-yellow-600" />
                          Fontes de Pesquisa (Grounding):
                        </p>
                        <ul className="list-disc pl-5 text-sm text-gray-500 space-y-1">
                          {textSources.map((source, index) => (
                            <li key={index}>
                              <a 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="hover:text-indigo-600 transition flex items-start"
                              >
                                <Link className="w-3 h-3 mt-1 mr-1 flex-shrink-0" />
                                <span className="underline">{source.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                {!isTextLoading && !ebookText && !textError && (
                  <p className="text-gray-500 italic">
                    Configure seu Ebook e clique em "Gerar Conteúdo".
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Coluna 2: Gerador de Imagem do Ebook */}
          <section className={`p-6 rounded-2xl shadow-lg transition-all duration-300 
            ${includeImages ? 'bg-green-50' : 'bg-gray-100 opacity-50 cursor-not-allowed'}`}>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center mb-6 border-b pb-3">
              <Image className="w-6 h-6 mr-2 text-green-600" />
              2. Capa/Ilustrações por IA
            </h2>

            {/* Input e Botão de Imagem */}
            <div className="space-y-4">
              <input
                type="text"
                className="w-full p-4 border border-gray-300 rounded-xl shadow-sm focus:ring-green-500 focus:border-green-500 transition"
                placeholder="Descreva a imagem que você deseja gerar (ex: capa minimalista, fantasia sombria, 4k)"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={handleImageKeyDown}
                disabled={isImageLoading || !isAuthReady || !includeImages}
              />
              <button
                onClick={generateImage}
                disabled={isImageLoading || !isAuthReady || !includeImages}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition duration-200 shadow-lg 
                  ${isImageLoading || !isAuthReady || !includeImages ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:bg-green-800'}`}
              >
                {isImageLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando Imagem...
                  </>
                ) : (
                  <>
                    <Image className="w-5 h-5" />
                    Gerar Capa/Ilustração (Enter)
                  </>
                )}
              </button>
              {!includeImages && (
                <p className="text-sm text-center text-gray-600 p-2 bg-gray-200 rounded-lg">
                    Seção desativada. Marque a opção "Incluir" no Gerador de Conteúdo para habilitar.
                </p>
              )}
            </div>

            {/* Resultado da Imagem */}
            <div className="mt-8 pt-4 border-t border-green-200">
              <h3 className="text-xl font-semibold text-gray-700 mb-3 flex items-center">
                <Image className="w-5 h-5 mr-1 text-green-600"/> Visual Gerado
              </h3>
              <div className="w-full aspect-square max-w-full bg-gray-200 rounded-xl shadow-inner flex items-center justify-center overflow-hidden border-4 border-dashed border-gray-300">
                {imageError && (
                  <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg max-w-xs mx-auto">
                    <p className="font-semibold">Erro na Geração de Imagem:</p>
                    <p className="text-sm mt-1">{imageError}</p>
                  </div>
                )}
                
                {!isImageLoading && !imageUrl && !imageError && includeImages && (
                  <div className="text-center text-gray-500 p-4">
                    <Image className="w-12 h-12 mx-auto mb-2" />
                    <p>Sua capa ou ilustração aparecerá aqui.</p>
                  </div>
                )}
                {!includeImages && (
                   <div className="text-center text-gray-400 p-4">
                    <Image className="w-12 h-12 mx-auto mb-2" />
                    <p>Função de imagem desativada.</p>
                  </div>
                )}


                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={imagePrompt || "Imagem gerada por IA"}
                    className="w-full h-full object-cover rounded-xl"
                  />
                )}
              </div>
            </div>
          </section>
          
        </div>

        {/* Informações da Aplicação */}
        <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Aplicação Híbrida de IA: Texto gerado com {GEMINI_MODEL} (com grounding do Google Search) e Imagem gerada com {IMAGEN_MODEL}.</p>
          {userId && <p className="mt-1">ID do Usuário: {userId}</p>}
        </footer>

      </div>
    </div>
  );
};

export default App;