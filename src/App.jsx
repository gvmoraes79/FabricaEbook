import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Wand2, Upload, CheckCircle2, FileText, 
  Languages, Loader2, Settings2, Image as ImageIcon, 
  Download, Key, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Regex para encontrar a primeira sugestão de imagem no texto e capturar a descrição
const IMAGE_SUGGESTION_REGEX = /\[SUGESTÃO DE IMAGEM: (.*?)]/i;

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultReady, setResultReady] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false); // Novo estado para exibir/ocultar API Key

  // Estados para a geração de imagem
  const [generatedImageURL, setGeneratedImageURL] = useState(null);
  const [imagePrompt, setImagePrompt] = useState(''); 
  
  const [formData, setFormData] = useState({
    theme: '',
    minPages: 5, 
    maxPages: 10,
    language: 'portugues',
    includeImages: false,
    notes: '', // Este campo agora é usado como prompt manual para a imagem, se for o caso.
    revisionType: 'correcao',
    tone: 'manter',
    file: null,
    textContent: '' 
  });

  // --- Funções de Inicialização e Handlers ---

  // Carrega a biblioteca de PDF automaticamente via CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    script.onload = () => {
      console.log("Biblioteca PDF carregada");
      setPdfLibraryLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, file: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, textContent: e.target.result }));
      };
      reader.readAsText(file);
    }
  };

  // --- Lógica de Geração de Imagem com Reintentos (Exponential Backoff) ---
  const generateImage = useCallback(async (promptForImage) => {
    setIsImageGenerating(true);
    
    // Atualiza o status na tela de resultados
    setStatusMessage('Conteúdo pronto. Iniciando geração da imagem de Capa (Imagen). Por favor, aguarde...');
    
    const maxRetries = 5;
    let currentRetry = 0;

    const runGeneration = async () => {
      try {
        const payload = { 
          instances: [{ prompt: promptForImage }], 
          parameters: { "sampleCount": 1 } 
        };
        // A API key será injetada automaticamente, mas o código precisa do parâmetro.
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`API retornou status ${response.status}: ${errorBody.error?.message || response.statusText}`);
        }

        const result = await response.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;

        if (base64Data) {
          const imageUrl = `data:image/png;base64,${base64Data}`;
          return imageUrl;
        } else {
          throw new Error('Nenhum dado de imagem encontrado na resposta da API.');
        }

      } catch (error) {
        console.error("Erro na geração de imagem:", error);
        if (currentRetry < maxRetries) {
          currentRetry++;
          const delay = Math.pow(2, currentRetry) * 1000;
          setStatusMessage(`Erro temporário na imagem. Tentando novamente em ${delay / 1000}s... (Tentativa ${currentRetry}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return runGeneration(); 
        } else {
          // A falha na imagem não bloqueia o resultado, mas atualiza o status
          setStatusMessage(`Falha na geração da imagem após ${maxRetries} tentativas. Prosseguindo com capa textual.`);
          return null; 
        }
      } 
    };
    
    const imageUrl = await runGeneration();
    setIsImageGenerating(false);
    
    // Se o statusMessage não foi atualizado por um erro, atualiza para sucesso
    if (imageUrl && !statusMessage.startsWith('Falha')) {
        setStatusMessage('Conteúdo e imagem de capa gerados com sucesso!');
    }
    
    return imageUrl;
  }, [apiKey, statusMessage]);


  // --- Lógica de Geração de PDF ---
  const drawTextBlock = (doc, text, margin, pageHeight, usableWidth, lineHeight, paragraphSpacing, cursorRef) => {
    const blocks = text.split('\n');

    blocks.forEach(block => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return;

      let currentLineHeight = lineHeight;
      let currentSpacing = paragraphSpacing;
      let isTitle = trimmedBlock.startsWith('##') || trimmedBlock.startsWith('#');
      
      if (isTitle) {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          currentLineHeight = 9;
          currentSpacing = paragraphSpacing * 2;
      } else {
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
      }
      
      const lines = doc.splitTextToSize(trimmedBlock.replace(/^#+/, ''), usableWidth);

      if (cursorRef.current > margin) {
        cursorRef.current += currentSpacing; 
      }

      lines.forEach(line => {
        if (cursorRef.current > pageHeight - margin) { 
          doc.addPage();
          cursorRef.current = margin; 
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
        }
        
        doc.text(line, margin, cursorRef.current);
        cursorRef.current += currentLineHeight;
      });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
    });
  };

  const generatePDF = (text, title, imageUrl, imagePrompt) => {
    if (!window.jspdf || !title) return; // Garante que o título existe para o nome do arquivo

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 30; 
    const pageWidth = 210;
    const pageHeight = 297;
    const usableWidth = pageWidth - (margin * 2);
    const lineHeight = 7; 
    const paragraphSpacing = 3; 
    const cursorY = { current: margin }; 
    const imagePlaceholderText = "Para uma capa profissional, gere uma imagem e insira-a aqui."; 

    // --- Capa (Primeira Página) ---
    doc.setFont("helvetica", "bold"); doc.setFontSize(36); 
    doc.setTextColor(50, 50, 50); 
    
    // Título Principal
    doc.text(title, pageWidth / 2, pageHeight / 2 - 60, { align: 'center' }); 
    
    // Subtítulo/Autor
    doc.setFont("helvetica", "italic"); doc.setFontSize(16);
    doc.text("Por: Escritor Artificial", pageWidth / 2, pageHeight / 2 - 45, { align: 'center' }); 

    // Imagem na Capa, se existir
    if (imageUrl) {
        const coverImageWidth = usableWidth;
        const coverImageHeight = coverImageWidth * 0.7; 
        const coverImageX = margin;
        const coverImageY = pageHeight / 2 - 30; 

        try {
            doc.addImage(imageUrl, 'PNG', coverImageX, coverImageY, coverImageWidth, coverImageHeight);
            
            // Créditos da imagem
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100);
            doc.text(`Ilustração Gerada por IA: ${imagePrompt || 'Capa do Documento'}`, pageWidth / 2, coverImageY + coverImageHeight + 5, { align: 'center' });

        } catch (e) {
            console.error("Erro ao adicionar imagem à capa:", e);
        }
    } else {
        // Placeholder se não houver imagem
        doc.setTextColor(150);
        doc.setFontSize(14);
        doc.setFont("helvetica", "italic");
        doc.text(imagePlaceholderText, pageWidth / 2, pageHeight / 2, { align: 'center' });
    }
    
    // Créditos da Ferramenta no rodapé da Capa
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Gerado por Google Gemini", pageWidth / 2, pageHeight - 40, { align: 'center' }); 
    
    doc.addPage();
    cursorY.current = margin; 

    // --- Processamento do Conteúdo (Limpeza da Tag de Imagem) ---
    // Remove a tag de sugestão de imagem do corpo do texto.
    let textToDraw = text; 
    textToDraw = textToDraw.replace(IMAGE_SUGGESTION_REGEX, ''); 

    // Desenha o corpo do texto 
    drawTextBlock(doc, textToDraw, margin, pageHeight, usableWidth, lineHeight, paragraphSpacing, cursorY);

    // Header e Footer (Numeração)
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      if (i > 1) { // Não numera a Capa
        doc.text(title, margin, 15); 
        doc.text(`Página ${i - 1} de ${pageCount - 1}`, pageWidth - margin, pageHeight - 15, { align: 'right' }); // Ajusta numeração
      }
      doc.text(`AI eBook Studio`, margin, pageHeight - 15);
    }

    // Usar o título para o nome do arquivo
    doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_ebook.pdf`);
  };


  // --- Lógica Principal: Envio e Chaining de Chamadas ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey) {
      alert('Por favor, insira sua chave de API do Google Studio.');
      return;
    }
    
    if (!formData.theme) {
       alert('Por favor, insira um Tema / Título para começar.');
       return;
    }

    setIsProcessing(true);
    setResultReady(false);
    setGeneratedImageURL(null); 
    setImagePrompt(''); 
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Usando gemini-2.5-flash para melhor velocidade e capacidade de seguir instruções
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // 1. Geração do Prompt
      let prompt = "";
      let imagePromptForGenerator = null;
      let notesText = formData.notes.trim();

      // Determine a estratégia de imagem
      if (formData.includeImages) {
          if (notesText) {
              // Estratégia A: Usuário forneceu Observações. Usamos as Observações como prompt da imagem.
              imagePromptForGenerator = notesText;
              setImagePrompt(imagePromptForGenerator); 
              
              const notesInstruction = `O usuário forneceu observações: "${notesText}". Use-as para guiar o texto (público, tom, estilo). **NÃO** inclua o tag [SUGESTÃO DE IMAGEM: ...]. A imagem de capa será gerada separadamente usando estas observações.`;
              
              if (activeTab === 'create') {
                prompt = `Atue como um escritor profissional. Escreva um ebook completo sobre o tema: "${formData.theme}".
                    **MANDATÓRIO: Comece o seu texto com um índice detalhado dos capítulos e subcapítulos.**
                    **MANDATÓRIO: Ao final do documento, inclua uma seção chamada "Referências Sugeridas" com 3 referências bibliográficas relevantes, utilizando um formato de lista.**
                    Idioma: ${formData.language}.
                    O ebook deve ser detalhado, ter uma introdução, vários capítulos bem desenvolvidos e uma conclusão.
                    Tamanho estimado de conteúdo: equivalente a entre ${formData.minPages} e ${formData.maxPages} páginas de leitura.
                    Use formatação clara com Títulos (use ## para títulos principais) e Parágrafos.
                    ${notesInstruction}`;
              } else {
                 const contentToRevise = formData.textContent || "O usuário não carregou um texto legível, por favor crie um exemplo de revisão sobre: " + formData.theme;
                 prompt = `Atue como um editor chefe. Revise o seguinte texto.
                    Objetivo: ${formData.revisionType}.
                    Tom de voz desejado: ${formData.tone}.
                    Idioma de saída: ${formData.language}.
                    ${notesInstruction}
                    Texto original para trabalhar: "${contentToRevise.substring(0, 10000)}"`;
              }


          } else {
              // Estratégia B: Observações vazias. Pedimos à IA para gerar a tag de sugestão de imagem no texto.
              const imageInstruction = "INSTRUÇÃO OBLIGATÓRIA: O usuário deseja a imagem. Inclua UMA ÚNICA sugestão visual detalhada no texto, exatamente no parágrafo onde ela deve aparecer, marcada exatamente assim: [SUGESTÃO DE IMAGEM: descrição da cena].";
              
              if (activeTab === 'create') {
                prompt = `Atue como um escritor profissional. Escreva um ebook completo sobre o tema: "${formData.theme}".
                    **MANDATÓRIO: Comece o seu texto com um índice detalhado dos capítulos e subcapítulos.**
                    **MANDATÓRIO: Ao final do documento, inclua uma seção chamada "Referências Sugeridas" com 3 referências bibliográficas relevantes, utilizando um formato de lista.**
                    Idioma: ${formData.language}.
                    O ebook deve ser detalhado, ter uma introdução, vários capítulos bem desenvolvidos e uma conclusão.
                    Tamanho estimado de conteúdo: equivalente a entre ${formData.minPages} e ${formData.maxPages} páginas de leitura.
                    Use formatação clara com Títulos (use ## para títulos principais) e Parágrafos.
                    ${imageInstruction}`;
              } else {
                 const contentToRevise = formData.textContent || "O usuário não carregou um texto legível, por favor crie um exemplo de revisão sobre: " + formData.theme;
                 prompt = `Atue como um editor chefe. Revise o seguinte texto.
                    Objetivo: ${formData.revisionType}.
                    Tom de voz desejado: ${formData.tone}.
                    Idioma de saída: ${formData.language}.
                    ${imageInstruction}
                    Texto original para trabalhar: "${contentToRevise.substring(0, 10000)}"`;
              }
          }
      } else {
          // Estratégia C: Nenhuma imagem solicitada. Prompt padrão.
          const notesPart = activeTab === 'create' ? `Público-alvo/Obs: ${formData.notes}.` : `Observações: ${formData.notes}.`;
          
          if (activeTab === 'create') {
            prompt = `Atue como um escritor profissional. Escreva um ebook completo sobre o tema: "${formData.theme}".
                **MANDATÓRIO: Comece o seu texto com um índice detalhado dos capítulos e subcapítulos.**
                **MANDATÓRIO: Ao final do documento, inclua uma seção chamada "Referências Sugeridas" com 3 referências bibliográficas relevantes, utilizando um formato de lista.**
                Idioma: ${formData.language}.
                ${notesPart}
                O ebook deve ser detalhado, ter uma introdução, vários capítulos bem desenvolvidos e uma conclusão.
                Tamanho estimado de conteúdo: equivalente a entre ${formData.minPages} e ${formData.maxPages} páginas de leitura.
                Use formatação clara com Títulos (use ## para títulos principais) e Parágrafos.
                Não inclua sugestões de imagens.`;
          } else {
             const contentToRevise = formData.textContent || "O usuário não carregou um texto legível, por favor crie um exemplo de revisão sobre: " + formData.theme;
             prompt = `Atue como um editor chefe. Revise o seguinte texto.
                Objetivo: ${formData.revisionType}.
                Tom de voz desejado: ${formData.tone}.
                Idioma de saída: ${formData.language}.
                Não inclua sugestões de imagens.
                Texto original para trabalhar: "${contentToRevise.substring(0, 10000)}"`;
          }
      }
      
      // 2. Chamada Gemini (Texto)
      setStatusMessage('Passo 1/2: Gerando o texto do documento...');
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      setGeneratedContent(text);
      setResultReady(true); // Prepara a transição para a tela de resultados
      
      // 3. Chamada Imagen (Imagem) - Execução
      if (formData.includeImages) {
          
          // Se imagePromptForGenerator ainda não está setado (Estratégia B), tentamos extrair o tag da IA.
          if (!imagePromptForGenerator) {
              const match = text.match(IMAGE_SUGGESTION_REGEX);
              if (match && match[1]) {
                  imagePromptForGenerator = match[1].trim(); 
                  setImagePrompt(imagePromptForGenerator); 
              } 
          }

          // Se tivermos um prompt (seja das notas ou extraído do texto)
          if (imagePromptForGenerator) {
              // Já está na tela de resultados, o componente irá exibir o Loader2
              const imageUrl = await generateImage(imagePromptForGenerator); 
              
              if (imageUrl) {
                  setGeneratedImageURL(imageUrl);
              } 
              // Se falhar, o statusMessage já foi atualizado dentro de generateImage

          } else {
               setStatusMessage('Conteúdo pronto. Nenhuma sugestão de imagem foi encontrada no texto ou nas observações.');
          }
      } else {
        setStatusMessage('Conteúdo pronto. Prossiga para a tela de download.');
      }
      
      // 4. Conclusão
      setIsProcessing(false);

    } catch (error) {
      console.error(error);
      const errorMsg = error.message.includes('API key') ? 
        'Erro de autenticação. Verifique sua Chave API.' : 
        'Erro desconhecido. O erro pode ser de conteúdo ou na comunicação da API. Verifique o console do navegador para detalhes.';
        
      setStatusMessage(`Erro: ${errorMsg}`);
      setIsProcessing(false);
      alert(`Erro: ${errorMsg}`);
    }
  };

  // --- UI para Resultados (Tela 2) ---
  if (resultReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl p-8 text-center mt-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Documento Finalizado!</h2>
          {/* Exibe o status atualizado, seja de sucesso ou da geração de imagem */}
          <p className="text-slate-600 mb-6 font-semibold">{statusMessage}</p> 
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Bloco de Imagem */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" /> Imagem de Capa
              </h3>
              
              {imagePrompt && (
                <div className="text-sm text-slate-600 mb-3 border-l-4 border-indigo-400 pl-2">
                  <p className="font-semibold">Prompt Utilizado para a Imagem:</p>
                  <span className="font-mono text-xs block mt-1 bg-white p-2 rounded break-words">{imagePrompt}</span>
                </div>
              )}
              
              {isImageGenerating ? (
                <div className="h-48 flex items-center justify-center bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="text-center">
                     <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                     <p className="text-sm text-slate-700">Aguardando a conclusão da geração da imagem...</p>
                     <p className="text-xs text-slate-500 mt-1">O texto já está pronto, mas a imagem pode levar mais alguns segundos.</p>
                  </div>
                </div>
              ) : generatedImageURL ? (
                <img 
                  src={generatedImageURL} 
                  alt="Imagem gerada por IA" 
                  className="w-full h-auto rounded-lg shadow-lg border border-slate-300" 
                />
              ) : (
                <div className="h-48 flex items-center justify-center bg-red-50 rounded-lg border border-red-200">
                  <div className="text-center text-red-700">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-semibold">Capa Textual.</p>
                      <p className="text-xs mt-1">Nenhuma imagem gerada (falha na IA ou não solicitada).</p>
                  </div>
                </div>
              )}
            </div>


            {/* Bloco de Conteúdo e PDF */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-indigo-600" /> Conteúdo Final
              </h3>
              <div className="bg-white p-4 rounded mb-4 h-48 overflow-y-auto text-left text-xs font-mono border border-slate-300 shadow-inner">
                {generatedContent}
              </div>

              <button 
                onClick={() => generatePDF(generatedContent, formData.theme, generatedImageURL, imagePrompt)}
                disabled={!pdfLibraryLoaded}
                className={`px-8 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 w-full transition-colors shadow-lg ${pdfLibraryLoaded ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-wait'} ${generatedImageURL ? 'border-2 border-green-300' : ''} text-white`}
              >
                <Download className="w-5 h-5" /> 
                Baixar PDF {generatedImageURL ? 'COM CAPA ILUSTRADA' : '(Capa Textual)'}
              </button>
              
              <button onClick={() => setResultReady(false)} className="mt-4 text-indigo-600 hover:underline w-full">
                Voltar e Fazer Outra Criação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- UI para Criação (Tela 1) ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 font-sans pb-12">
      <header className="bg-white shadow-sm border-b border-indigo-100">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg"><BookOpen className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold text-slate-800">AI eBook Studio <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded ml-2">Conectado ao Google Gemini</span></h1>
          </div>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {isProcessing && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white p-8 rounded-xl shadow-2xl text-center border-t-4 border-indigo-600">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">Processando Documento...</h3>
              <p className="text-slate-600 font-medium">{statusMessage}</p>
              <p className="text-sm text-slate-500 mt-2">Por favor, não feche esta janela.</p>
            </div>
          </div>
        )}
        
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex mb-8">
            <button onClick={() => setActiveTab('create')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Wand2 className="w-4 h-4" /> Criar do Zero
            </button>
            <button onClick={() => setActiveTab('enhance')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'enhance' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Upload className="w-4 h-4" /> Revisar Texto
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {activeTab === 'enhance' && (
                <div className="mb-6 p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center">
                  <p className="text-sm text-slate-500 mb-2">Selecione um arquivo de texto (.txt) ou cole o conteúdo abaixo</p>
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="mb-4" />
                  <textarea 
                    className="w-full p-3 text-sm border rounded" 
                    rows="4" 
                    placeholder="Ou cole o texto aqui..."
                    value={formData.textContent}
                    onChange={(e) => setFormData({...formData, textContent: e.target.value})}
                  ></textarea>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tema / Título</label>
                <input type="text" name="theme" required value={formData.theme} onChange={handleInputChange} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Sobre o que é o livro?" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Idioma</label>
                  <select name="language" value={formData.language} onChange={handleInputChange} className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white">
                    <option value="portugues">Português</option>
                    <option value="ingles">Inglês</option>
                    <option value="espanhol">Espanhol</option>
                    <option value="frances">Francês</option>
                    <option value="italiano">Italiano</option>
                    <option value="mandarim">Mandarim</option>
                  </select>
                </div>
                {activeTab === 'create' && (
                   <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-2">Mín. Páginas</label>
                        <input type="number" name="minPages" value={formData.minPages} onChange={handleInputChange} className="w-full px-3 py-3 rounded-lg border border-slate-300" />
                     </div>
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-2">Máx. Páginas</label>
                        <input type="number" name="maxPages" value={formData.maxPages} onChange={handleInputChange} className="w-full px-3 py-3 rounded-lg border border-slate-300" />
                     </div>
                   </div>
                )}
              </div>
              
              {/* Checkbox de Imagens */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-center gap-3">
                <div className="bg-white p-2 rounded-md shadow-sm">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <label htmlFor="ai-images" className="font-medium text-slate-800 cursor-pointer select-none">
                    Incluir Imagem de Capa Gerada por IA?
                  </label>
                  <p className="text-xs text-slate-500">Se marcada, a IA criará uma imagem para a capa (baseada nas Observações ou em uma sugestão do texto).</p>
                </div>
                <input 
                  type="checkbox" 
                  id="ai-images"
                  name="includeImages"
                  checked={formData.includeImages}
                  onChange={handleInputChange}
                  className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Observações para a IA <span className="text-xs text-red-500 font-normal">(Se você marcou 'Incluir Imagem', este texto será o prompt da capa)</span></label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Usar linguagem simples, focar em exemplos. Descreva a imagem de capa aqui se for usá-la."></textarea>
              </div>

              <button 
                type="submit" 
                disabled={!apiKey || !formData.theme} 
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 
                  ${(apiKey && formData.theme) ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-not-allowed'}`}
              >
                <Wand2 className="w-5 h-5" /> {activeTab === 'create' ? 'Gerar com IA' : 'Revisar com IA'}
              </button>
            </form>
          </div>
      </main>
      
      {/* Container Fixo para a Chave API (Canto Inferior Direito) */}
      <div className="fixed bottom-0 right-0 m-4 p-2 bg-white shadow-2xl rounded-xl border border-slate-200 z-[100] w-full max-w-xs transition-opacity hover:opacity-100 opacity-90">
          <div className="flex items-center gap-2">
            
            <input 
              type={showApiKey ? "text" : "password"} 
              placeholder="Chave API Google (Cole Aqui)" 
              className="bg-transparent flex-1 outline-none text-xs text-slate-700 placeholder-slate-400"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-slate-500 hover:text-indigo-600 p-1 rounded transition-colors"
              title={showApiKey ? "Ocultar Chave" : "Exibir Chave"}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
      </div>
    </div>
  );
}