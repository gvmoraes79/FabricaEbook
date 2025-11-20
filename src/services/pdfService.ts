declare const jspdf: any;
declare const html2canvas: any;

export const generatePdf = async (element: HTMLElement, fileName: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            return reject(new Error('Bibliotecas PDF não carregadas.'));
        }

        const { jsPDF } = jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth(); 
        const pdfHeight = pdf.internal.pageSize.getHeight(); 

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                width: element.offsetWidth,
                height: element.scrollHeight, 
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pdfWidth / imgWidth;
            const scaledImgHeight = imgHeight * ratio;

            let heightLeft = scaledImgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`${fileName.replace(/ /g, '_')}.pdf`);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
};