import React, { useState, useCallback } from 'react';
import { Sparkles, Image, Loader2, ArrowRight } from 'lucide-react';

// Chave da API: Vazia para que o Canvas possa fornecê-la em tempo de execução
const apiKey = "";
// URL da API para o modelo de geração de imagem (preferencial)
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

/**
 * Função para converter a URL de uma imagem Base64 para um ArrayBuffer,
 * necessária para o Polyfill de `atob` em alguns ambientes.
 * @param {string} base64 O dado base64 puro (sem o prefixo mime type)
 * @returns {ArrayBuffer} O ArrayBuffer com os dados decodificados
 */
const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Polyfill básico para `atob` se não estiver disponível (importante para o ambiente)
if (typeof atob === 'undefined') {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

// Função de pausa para o backoff exponencial
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Componente principal do aplicativo
const App = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Função principal para chamar a API e gerar a imagem
  const generateImage = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Por favor, digite um prompt para gerar a imagem.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageUrl(null);

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1, // Gerar apenas 1 imagem
        outputMimeType: "image/png",
        aspectRatio: "1:1", // Aspecto quadrado
      }
    };

    let result = null;
    let success = false;
    let retries = 0;
    const maxRetries = 5;
    let delay = 1000; // 1 segundo de delay inicial

    // Loop de requisições com backoff exponencial para lidar com throttling
    while (retries < maxRetries && !success) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.status === 429) {
          // Excesso de requisições (throttling), tentar novamente
          retries++;
          if (retries < maxRetries) {
            await sleep(delay);
            delay *= 2; // Dobra o delay (backoff exponencial)
            continue;
          }
        }

        if (!response.ok) {
          throw new Error(`Erro de API: ${response.status} ${response.statusText}`);
        }

        result = await response.json();
        success = true;

      } catch (e) {
        console.error("Erro na geração de imagem:", e);
        setError(`Falha ao conectar ou erro interno. Tentativa ${retries + 1}/${maxRetries}.`);
        retries++;
        if (retries < maxRetries) {
          await sleep(delay);
          delay *= 2;
        }
      }
    }

    setIsLoading(false);

    if (success && result && result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
      const base64Data = result.predictions[0].bytesBase64Encoded;
      // Cria a URL de dados para exibir a imagem
      const newImageUrl = `data:image/png;base64,${base64Data}`;
      setImageUrl(newImageUrl);
    } else if (success) {
      setError("A geração da imagem falhou ou o resultado estava vazio.");
    } else {
      setError("Não foi possível gerar a imagem após várias tentativas. Tente novamente mais tarde.");
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      generateImage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 sm:p-8">
        
        {/* Título e Descrição */}
        <header className="text-center mb-8">
          <Sparkles className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Gerador de Imagens IA
          </h1>
          <p className="text-gray-500 mt-2">
            Descreva o que você deseja criar e veja a IA dar vida à sua imaginação.
          </p>
        </header>

        {/* Input e Botão */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            className="flex-grow p-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm"
            placeholder="Ex: Um gato astronauta surfando em Saturno, estilo aquarela, 4k"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            onClick={generateImage}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition duration-200 shadow-md 
              ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                Gerar Imagem <ArrowRight className="w-5 h-5 ml-1" />
              </>
            )}
          </button>
        </div>

        {/* Área de Visualização do Resultado */}
        <div className="flex justify-center w-full">
          <div className="w-full aspect-square max-w-md bg-gray-200 rounded-xl shadow-inner flex items-center justify-center overflow-hidden border-4 border-dashed border-gray-300">
            {error && (
              <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg max-w-xs mx-auto">
                <p className="font-semibold">Erro na Geração:</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {!isLoading && !imageUrl && !error && (
              <div className="text-center text-gray-500 p-4">
                <Image className="w-12 h-12 mx-auto mb-2" />
                <p>O resultado da sua imagem aparecerá aqui.</p>
                <p className="text-sm mt-1">Digite um prompt e clique em "Gerar Imagem".</p>
              </div>
            )}

            {imageUrl && (
              <img
                src={imageUrl}
                alt={prompt || "Imagem gerada por IA"}
                className="w-full h-full object-cover rounded-xl"
              />
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default App;