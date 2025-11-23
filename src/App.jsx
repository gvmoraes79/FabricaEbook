import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Wand2, Upload, CheckCircle2, FileText, 
  Languages, Loader2, Settings2, Image as ImageIcon, 
  Download, Key, AlertCircle 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Regex para encontrar a primeira sugestão de imagem no texto e capturar a descrição
const IMAGE_SUGGESTION_REGEX = /\[SUGESTÃO DE IMAGEM: (.*?)]/i;

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultReady, setResultReady] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);

  // Novos estados para a geração de imagem
  const [generatedImageURL, setGeneratedImageURL] = useState(null);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [imagePrompt, setImagePrompt] = useState(''); // O prompt extraído

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

  // Efeito para extrair o prompt da imagem assim que o conteúdo for gerado
  useEffect(() => {
    if (generatedContent) {
      const match = generatedContent.match(IMAGE_SUGGESTION_REGEX);
      if (match && match[1]) {
        setImagePrompt(match[1].trim());
      } else {
        setImagePrompt('');
      }
    }
  }, [generatedContent]);


  const [formData, setFormData] = useState({
    theme: '',
    minPages: 5, 
    maxPages: 10,
    language: 'portugues',
    includeImages: false,
    notes: '',
    revisionType: 'correcao',
    tone: 'manter',
    file: null,
    textContent: '' 
  });

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

  /**
   * Função auxiliar para processar e desenhar um bloco de texto no PDF.
   * Ela lida com quebras de linha, paginação e estilos de título simples.
   */
  const drawTextBlock = (doc, text, margin, pageHeight, usableWidth, lineHeight, paragraphSpacing, cursorRef) => {
    const blocks = text.split('\n');

    blocks.forEach(block => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return;

      // Estilos de título simples (## ou texto em maiúsculo)
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
          doc.setFontSize(12); // Reset size on new page
          doc.setFont("helvetica", "normal");
        }
        
        doc.text(line, margin, cursorRef.current);
        cursorRef.current += currentLineHeight;
      });
      
      // Redefinir para o estilo de parágrafo após desenhar o bloco
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
    });
  };

  // --- Lógica de Geração de PDF (Incluindo Imagem Contextual) ---
  const generatePDF = (text, title, imageUrl, imagePrompt) => {
    if (!window.jspdf) {
      const notification = document.createElement('div');
      notification.textContent = "A ferramenta de PDF ainda está carregando. Tente novamente em alguns segundos.";
      notification.style.cssText = "position:fixed; top:20px; right:20px; background:red; color:white; padding:10px; border-radius:5px; z-index:9999;";
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 30; 
    const pageWidth = 210;
    const pageHeight = 297;
    const usableWidth = pageWidth - (margin * 2);
    const lineHeight = 7; 
    const paragraphSpacing = 3; 
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    // Ref para rastrear a posição Y do cursor no PDF
    const cursorY = { current: margin }; 

    // 1. Capa (Cover Page)
    doc.setFontSize(36); 
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' }); 

    doc.setFontSize(16);
    doc.setFont("helvetica", "italic");
    doc.text("Por: Escritor Artificial", pageWidth / 2, pageHeight / 2 + 5, { align: 'center' }); 

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Gerado por Google Gemini", pageWidth / 2, pageHeight - 40, { align: 'center' }); 
    
    doc.addPage();
    cursorY.current = margin; // Reset cursor for new page


    // 2. Processamento do Conteúdo Principal para Inserção Contextual
    let textToDraw = text.replace(IMAGE_SUGGESTION_REGEX, '[IMG_HERE]');
    const parts = textToDraw.split('[IMG_HERE]');
    
    const textBeforeImage = parts[0];
    const textAfterImage = parts.length > 1 ? parts.slice(1).join('\n') : '';

    // --- Parte A: Desenhar o Texto ANTES da Imagem ---
    drawTextBlock(doc, textBeforeImage, margin, pageHeight, usableWidth, lineHeight, paragraphSpacing, cursorY);
    
    // --- Parte B: Inserção Contextual da Imagem (se houver) ---
    if (imageUrl && parts.length > 1) {
        
        // Verifica se a imagem cabe na página atual (incluindo margem para legenda)
        const imageWidth = usableWidth * 0.9; 
        const imageHeight = imageWidth * 0.5625; 
        const totalImageSpace = imageHeight + 15; // Imagem + legenda + espaço

        if (cursorY.current + totalImageSpace > pageHeight - margin) {
            doc.addPage();
            cursorY.current = margin;
        }

        const imageX = margin + (usableWidth - imageWidth) / 2; // Centraliza a imagem
        const imageY = cursorY.current;

        try {
            // Desenha a Imagem
            doc.addImage(imageUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
            
            // Move o cursor Y para depois da imagem
            cursorY.current += imageHeight; 

            // Adiciona a Legenda
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            
            // Quebra a legenda se for muito longa
            const captionLines = doc.splitTextToSize(`Figura 1: Ilustração Gerada por IA com o tema: ${imagePrompt || title}`, imageWidth);
            
            // Desenha a legenda abaixo da imagem
            captionLines.forEach(line => {
                cursorY.current += 4; // Espaço para a linha da legenda
                doc.text(line, imageX, cursorY.current);
            });
            
            cursorY.current += 5; // Espaço final após a legenda
            
            // Redefinir fonte e tamanho para o corpo do texto
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");

        } catch (e) {
            console.error("Erro ao adicionar imagem ao PDF:", e);
            // Se falhar, move o cursor para evitar sobreposição, mas continua o texto
            cursorY.current += 10;
        }
    }

    // --- Parte C: Desenhar o Texto DEPOIS da Imagem ---
    if (textAfterImage) {
        drawTextBlock(doc, textAfterImage, margin, pageHeight, usableWidth, lineHeight, paragraphSpacing, cursorY);
    }
    

    // 3. Header e Footer (Lógica de numeração de página)
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      
      // Pula a Capa (Página 1)
      if (i > 1) {
        doc.text(title, margin, 15); 
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: 'right' });
      }
      doc.text(`AI eBook Studio`, margin, pageHeight - 15);
    }

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Lógica de Geração de Imagem com Reintentos (Exponential Backoff) ---
  const generateSampleImage = async () => {
    if (!imagePrompt || !apiKey) return;

    setIsImageGenerating(true);
    setGeneratedImageURL(null);
    setStatusMessage(`Gerando imagem com o prompt: "${imagePrompt}"...`);

    const maxRetries = 5;
    let currentRetry = 0;

    const runGeneration = async () => {
      try {
        const payload = { 
          instances: [{ prompt: imagePrompt }], 
          parameters: { "sampleCount": 1 } 
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        const result = await response.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;

        if (base64Data) {
          // Salva a URL Base64 para ser usada no PDF
          setGeneratedImageURL(`data:image/png;base64,${base64Data}`); 
          setStatusMessage('Imagem gerada com sucesso!');
        } else {
          throw new Error('No image data found in API response.');
        }

      } catch (error) {
        console.error("Erro na geração de imagem:", error);
        if (currentRetry < maxRetries) {
          currentRetry++;
          const delay = Math.pow(2, currentRetry) * 1000; // 2s, 4s, 8s...
          setStatusMessage(`Tentando novamente em ${delay / 1000}s... (Tentativa ${currentRetry}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return runGeneration(); // Tenta novamente
        } else {
          setStatusMessage('Erro final ao gerar imagem. Verifique o console.');
          const notification = document.createElement('div');
          notification.textContent = `Erro: Falha na geração da imagem após ${maxRetries} tentativas.`;
          notification.style.cssText = "position:fixed; top:20px; right:20px; background:red; color:white; padding:10px; border-radius:5px; z-index:9999;";
          document.body.appendChild(notification);
          setTimeout(() => document.body.removeChild(notification), 5000);
        }
      } finally {
        if (currentRetry === maxRetries || generatedImageURL) {
          setIsImageGenerating(false);
        }
      }
    };
    
    runGeneration();
  };


  // --- Lógica da IA para Texto ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey) {
      const notification = document.createElement('div');
      notification.textContent = "Por favor, insira sua chave de API do Google Studio no topo da página.";
      notification.style.cssText = "position:fixed; top:20px; right:20px; background:red; color:white; padding:10px; border-radius:5px; z-index:9999;";
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
      return;
    }

    setIsProcessing(true);
    setResultReady(false);
    setGeneratedImageURL(null); // Limpa imagem anterior e a URL
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let prompt = "";

      if (activeTab === 'create') {
        setStatusMessage('Planejando capítulos e escrevendo...');
        prompt = `
          Atue como um escritor profissional. Escreva um ebook completo sobre o tema: "${formData.theme}".
          **MANDATÓRIO: Comece o seu texto com um índice detalhado dos capítulos e subcapítulos.**
          Idioma: ${formData.language}.
          Público-alvo/Obs: ${formData.notes}.
          O ebook deve ser detalhado, ter uma introdução, vários capítulos bem desenvolvidos e uma conclusão.
          Tamanho estimado de conteúdo: equivalente a entre ${formData.minPages} e ${formData.maxPages} páginas de leitura.
          Use formatação clara com Títulos (use ## para títulos principais) e Parágrafos.
          ${formData.includeImages ? "INSTRUÇÃO IMPORTANTE: O usuário solicitou uma imagem para o e-book. Inclua UMA ÚNICA sugestão visual detalhada no texto, exatamente no parágrafo onde ela deve aparecer, marcada exatamente assim: [SUGESTÃO DE IMAGEM: descrição da cena]." : "Não inclua sugestões de imagens."}
        `;
      } else {
        setStatusMessage('Lendo documento e revisando...');
        const contentToRevise = formData.textContent || "O usuário não carregou um texto legível, por favor crie um exemplo de revisão sobre: " + formData.theme;
        
        prompt = `
          Atue como um editor chefe. Revise o seguinte texto.
          Objetivo: ${formData.revisionType} (Correção/Diagramação/Tradução).
          Tom de voz desejado: ${formData.tone}.
          Idioma de saída: ${formData.language}.
          ${formData.includeImages ? "Inclua UMA ÚNICA sugestão de onde uma imagem ilustrativa poderia enriquecer o texto, marcada como [SUGESTÃO DE IMAGEM: descrição da cena]." : ""}
          Texto original para trabalhar:
          "${contentToRevise.substring(0, 10000)}" 
        `;
      }
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setGeneratedContent(text);
      setStatusMessage('Conteúdo pronto. Você pode gerar a imagem e o PDF.');
      
      setTimeout(() => {
        setIsProcessing(false);
        setResultReady(true);
      }, 1000);

    } catch (error) {
      console.error(error);
      setStatusMessage('Erro: ' + error.message);
      
      const notification = document.createElement('div');
      notification.textContent = `Erro ao conectar com o Google. Verifique sua Chave API. Detalhe: ${error.message}`;
      notification.style.cssText = "position:fixed; top:20px; right:20px; background:red; color:white; padding:10px; border-radius:5px; z-index:9999;";
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 5000);
      
      setIsProcessing(false);
    }
  };

  if (resultReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl p-8 text-center mt-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Seu Documento Está Pronto!</h2>
          <p className="text-slate-600 mb-6">Use os botões abaixo. **A imagem será inserida automaticamente no ponto contextual que a IA sugeriu!**</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Bloco de Imagem */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" /> 1. Gerar Imagem Ilustrativa
              </h3>
              
              {imagePrompt && (
                <p className="text-sm text-slate-600 mb-3 border-l-4 border-indigo-400 pl-2">
                  Prompt da Sugestão: 
                  <span className="font-mono text-xs block mt-1 bg-white p-2 rounded">{imagePrompt}</span>
                </p>
              )}
              
              {generatedImageURL ? (
                <img 
                  src={generatedImageURL} 
                  alt="Imagem gerada por IA" 
                  className="w-full h-auto rounded-lg shadow-lg border border-slate-300" 
                />
              ) : (
                <div className="h-48 flex items-center justify-center bg-slate-200 rounded-lg text-slate-500">
                  {isImageGenerating ? (
                    <div className="text-center">
                       <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                       <p className="text-sm">{statusMessage}</p>
                    </div>
                  ) : (
                    <p className="text-sm">Clique no botão para criar a imagem com IA.</p>
                  )}
                </div>
              )}

              <button 
                onClick={generateSampleImage}
                disabled={isImageGenerating || !imagePrompt || !apiKey}
                className={`mt-4 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 w-full transition-colors shadow-md text-sm
                  ${(isImageGenerating || !imagePrompt || !apiKey) ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
              >
                {isImageGenerating ? 'Gerando...' : 'Gerar Imagem de Exemplo'}
              </button>
               {!imagePrompt && <p className="text-xs text-red-500 mt-2">O texto não incluiu uma sugestão de imagem. Habilite a opção na tela inicial.</p>}
            </div>


            {/* Bloco de Conteúdo e PDF */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-indigo-600" /> 2. Conteúdo e Download
              </h3>
              <div className="bg-white p-4 rounded mb-4 h-48 overflow-y-auto text-left text-xs font-mono border border-slate-300 shadow-inner">
                {generatedContent}
              </div>

              <button 
                // Passa a URL da imagem e o prompt para a função PDF
                onClick={() => generatePDF(generatedContent, formData.theme, generatedImageURL, imagePrompt)}
                disabled={!pdfLibraryLoaded}
                className={`px-8 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 w-full transition-colors shadow-lg ${pdfLibraryLoaded ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-wait'} ${generatedImageURL ? 'border-2 border-green-300' : ''} text-white`}
              >
                <Download className="w-5 h-5" /> 
                {generatedImageURL ? 'Baixar PDF COM IMAGEM CONTEXTUAL' : 'Baixar PDF (Somente Texto)'}
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

  // ... (Restante da função App para a tela de criação/revisão) ...
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 font-sans pb-12">
      <header className="bg-white shadow-sm border-b border-indigo-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2 rounded-lg"><BookOpen className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold text-slate-800">AI eBook Studio <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded ml-2">Conectado ao Google Gemini</span></h1>
          </div>
          
          <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-3 border border-slate-200">
            <Key className="w-5 h-5 text-slate-500" />
            <input 
              type="password" 
              placeholder="Cole sua Chave API do Google AI Studio aqui (Começa com AIza...)" 
              className="bg-transparent flex-1 outline-none text-sm text-slate-700"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          {!apiKey && <p className="text-xs text-red-500 mt-1 ml-1">* Obrigatório para funcionar</p>}
        </div>
      </header>

      {isProcessing ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="w-16 h-16 animate-spin mb-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Trabalhando...</h2>
          <p className="text-slate-500 animate-pulse">{statusMessage}</p>
        </div>
      ) : (
        <main className="max-w-3xl mx-auto px-4 py-8">
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

              {/* Checkbox de Imagens Adicionado Aqui */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-center gap-3">
                <div className="bg-white p-2 rounded-md shadow-sm">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <label htmlFor="ai-images" className="font-medium text-slate-800 cursor-pointer select-none">
                    Incluir Imagens Ilustrativas?
                  </label>
                  <p className="text-xs text-slate-500">A IA irá gerar **sugestões de descrição**. Na tela final, você poderá gerar a imagem real para inserção automática no PDF.</p>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Observações para a IA</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Usar linguagem simples, focar em exemplos..."></textarea>
              </div>

              <button type="submit" disabled={!apiKey} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${apiKey ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400 cursor-not-allowed'}`}>
                <Wand2 className="w-5 h-5" /> {activeTab === 'create' ? 'Gerar com IA' : 'Revisar com IA'}
              </button>
            </form>
          </div>
        </main>
      )}
    </div>
  );
}