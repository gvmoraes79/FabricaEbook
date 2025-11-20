
declare const jspdf: any;

export const generatePdf = async (element: HTMLElement, fileName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof jspdf === 'undefined') {
            return reject(new Error('Bibliotecas PDF não carregadas.'));
        }

        const { jsPDF } = jspdf;
        // Cria o PDF em formato A4, unidade em pontos (pt) para alinhar com o CSS
        const doc = new jsPDF('p', 'pt', 'a4');

        // Configurações para transformar o HTML em PDF respeitando quebras de página
        doc.html(element, {
            callback: function (pdf) {
                pdf.save(`${fileName.replace(/ /g, '_')}.pdf`);
                resolve();
            },
            x: 0,
            y: 0,
            // Margens: [Topo, Direita, Base, Esquerda]
            // A margem inferior (40) é crucial para o texto não tocar a borda
            margin: [0, 0, 40, 0],
            autoPaging: 'text', // Tenta evitar cortar linhas de texto ao meio
            width: 595.28, // Largura padrão A4 em pontos
            windowWidth: element.scrollWidth, // Garante a resolução correta
            html2canvas: {
                scale: 1, // Mantém a escala original do elemento HTML (595pt)
                useCORS: true,
                logging: false
            }
        });
    });
};
