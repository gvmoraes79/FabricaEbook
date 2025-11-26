
declare const jspdf: any;

export const generatePdf = async (element: HTMLElement, fileName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof jspdf === 'undefined') {
            return reject(new Error('Bibliotecas PDF não carregadas.'));
        }

        const { jsPDF } = jspdf;
        // Cria PDF A4 (595.28 x 841.89 pt)
        const doc = new jsPDF('p', 'pt', 'a4');

        // Margens [Topo, Direita, Base, Esquerda]
        // Aumentei a base para 60pt para evitar cortes no rodapé e adicionei 40pt nas laterais
        const pdfMargins = [40, 40, 60, 40]; 

        // Largura útil da página (Largura total - Margem Esquerda - Margem Direita)
        const contentWidth = 595.28 - pdfMargins[1] - pdfMargins[3];

        doc.html(element, {
            callback: function (pdf) {
                pdf.save(`${fileName.replace(/ /g, '_')}.pdf`);
                resolve();
            },
            x: pdfMargins[3], // Começa na margem esquerda (40pt)
            y: pdfMargins[0], // Começa na margem superior (40pt)
            margin: pdfMargins,
            autoPaging: 'text', // Tenta evitar cortar linhas de texto
            width: contentWidth, // Força o conteúdo a caber na área útil
            windowWidth: element.scrollWidth, // Usa a largura original do elemento para renderização
            html2canvas: {
                scale: 0.8, // Leve redução de escala para garantir que o conteúdo caiba confortavelmente
                useCORS: true,
                logging: false,
                letterRendering: true // Melhora a renderização de fontes
            }
        });
    });
};