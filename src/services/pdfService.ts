
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
        // Aumentei a base para 60pt para forçar quebra antes da borda
        const pdfMargins = [40, 40, 60, 40]; 

        // Largura útil da página
        const contentWidth = 595.28 - pdfMargins[1] - pdfMargins[3];

        doc.html(element, {
            callback: function (pdf) {
                pdf.save(`${fileName.replace(/ /g, '_')}.pdf`);
                resolve();
            },
            x: pdfMargins[3],
            y: pdfMargins[0],
            margin: pdfMargins,
            autoPaging: 'text', // Modo inteligente de quebra de texto
            width: contentWidth,
            windowWidth: element.scrollWidth, 
            html2canvas: {
                scale: 0.75, // Reduz levemente a escala para garantir que cabe nas margens
                useCORS: true,
                logging: false,
                letterRendering: true
            }
        });
    });
};