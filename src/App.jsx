import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Wand2, Upload, CheckCircle2, FileText, 
  Languages, Loader2, Settings2, Image as ImageIcon, 
  Download, Key, AlertCircle 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultReady, setResultReady] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);

  // Carrega a biblioteca de PDF automaticamente via CDN
  // É crucial para usar o jsPDF sem precisar de 'npm install'
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

  // --- Lógica de Geração de PDF Corrigida (Com Margens e Parágrafos Aprimorados) ---
  const generatePDF = (text, title) => {
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

    const margin = 30; // 3cm
    const pageWidth = 210;
    const pageHeight = 297;
    const usableWidth = pageWidth - (margin * 2);
    const lineHeight = 7; // Espaçamento entre linhas (mm)
    const paragraphSpacing = 3; // Espaço extra entre parágrafos (mm)
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    let cursorY = margin;

    // Capa (Cover Page) Aprimorada
    doc.setFontSize(28); 
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Seu eBook Gerado por Inteligência Artificial", pageWidth / 2, pageHeight / 2, { align: 'center' });
    doc.setFontSize(10);
    doc.text("AI eBook Studio", pageWidth / 2, pageHeight - 30, { align: 'center' });
    doc.addPage();
    cursorY = margin; // Reset cursor for new page

    // Conteúdo Principal
    // 1. Dividir o texto em blocos/parágrafos (usando uma quebra de linha simples '\n' para ser mais abrangente)
    const blocks = text.split('\n');

    blocks.forEach(block => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return; 

      // 2. Tenta identificar Títulos (usando heurística simples de Markdown como ## ou texto em maiúsculo)
      let currentLineHeight = lineHeight;
      let currentSpacing = paragraphSpacing;
      
      if (trimmedBlock.startsWith('##') || trimmedBlock.startsWith('#') || trimmedBlock.toUpperCase() === trimmedBlock && trimmedBlock.length < 50) {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          currentLineHeight = 9;
          currentSpacing = paragraphSpacing * 2;
      } else {
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
      }
      
      // 3. Quebra o bloco em linhas que cabem na largura utilizável
      const lines = doc.splitTextToSize(trimmedBlock.replace(/^#+/, ''), usableWidth);

      // 4. Adicionar espaçamento extra para parágrafo/bloco (exceto no início da página)
      if (cursorY > margin) {
        cursorY += currentSpacing; 
      }

      // 5. Desenhar as linhas
      lines.forEach(line => {
        if (cursorY > pageHeight - margin) { 
          doc.addPage();
          cursorY = margin; 
          doc.setFontSize(12); // Reset size on new page
          doc.setFont("helvetica", "normal");
        }
        
        doc.text(line, margin, cursorY);
        cursorY += currentLineHeight;
      });
      
      // 6. Redefinir para o normal
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
    });

    // Header e Footer (Lógica de numeração de página)
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(title, margin, 15); 
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: 'right' });
      doc.text(`AI eBook Studio`, margin, pageHeight - 15);
    }

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Lógica da IA (Prompt Alterado para Forçar o Índice no Início) ---
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
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // O modelo já está corrigido para gemini-2.5-flash
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
          ${formData.includeImages ? "INSTRUÇÃO IMPORTANTE: O usuário solicitou imagens. Inclua sugestões visuais detalhadas no texto marcadas exatamente assim: [SUGESTÃO DE IMAGEM: descrição da cena]." : "Não inclua sugestões de imagens."}
        `;
      } else {
        setStatusMessage('Lendo documento e revisando...');
        const contentToRevise = formData.textContent || "O usuário não carregou um texto legível, por favor crie um exemplo de revisão sobre: " + formData.theme;
        
        prompt = `
          Atue como um editor chefe. Revise o seguinte texto.
          Objetivo: ${formData.revisionType} (Correção/Diagramação/Tradução).
          Tom de voz desejado: ${formData.tone}.
          Idioma de saída: ${formData.language}.
          ${formData.includeImages ? "Inclua sugestões de onde imagens ilustrativas poderiam enriquecer o texto." : ""}
          Texto original para trabalhar:
          "${contentToRevise.substring(0, 10000)}" 
        `;
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setGeneratedContent(text);
      setStatusMessage('Formatando PDF com margens de 3cm...');
      
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Sucesso!</h2>
          <p className="text-slate-600 mb-8">A Inteligência Artificial finalizou seu documento.</p>
          
          <div className="bg-slate-50 p-4 rounded mb-6 h-48 overflow-y-auto text-left text-sm font-mono border">
            {generatedContent}
          </div>

          <button 
            onClick={() => generatePDF(generatedContent, formData.theme)}
            disabled={!pdfLibraryLoaded}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 w-full transition-colors shadow-lg ${pdfLibraryLoaded ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-400 text-slate-200 cursor-wait'}`}
          >
            <Download className="w-5 h-5" /> {pdfLibraryLoaded ? 'Baixar PDF (Margens 3cm)' : 'Carregando gerador...'}
          </button>
          
          <button onClick={() => setResultReady(false)} className="mt-4 text-indigo-600 hover:underline">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

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
                  <p className="text-xs text-slate-500">A IA irá gerar ou sugerir imagens para o seu conteúdo.</p>
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