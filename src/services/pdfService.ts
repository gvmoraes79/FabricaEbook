
declare const jspdf: any;

export const generatePdf = async (element: HTMLElement, fileName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof jspdf === 'undefined') {
            return reject(new Error('Bibliotecas PDF não carregadas.'));
        }

        const { jsPDF } = jspdf;
        // Cria PDF A4, unidade pontos (pt)
        const doc = new jsPDF('p', 'pt', 'a4');

        // Configuração de margens para garantir que o conteúdo não encoste nas bordas
        // A lógica doc.html já tenta quebrar páginas, mas as margens [Topo, Direita, Base, Esquerda] ajudam.
        const pdfMargins = [30, 0, 40, 0]; // 30pt Topo, 40pt Base (para não cortar rodapé)

        doc.html(element, {
            callback: function (pdf) {
                pdf.save(`${fileName.replace(/ /g, '_')}.pdf`);
                resolve();
            },
            x: 0,
            y: 0,
            margin: pdfMargins,
            autoPaging: 'text', // Importante para não cortar linhas de texto ao meio
            width: 595.28, // Largura A4 padrão
            windowWidth: element.scrollWidth, // Captura resolução correta
            html2canvas: {
                scale: 1,
                useCORS: true,
                logging: false
            }
        });
    });
};