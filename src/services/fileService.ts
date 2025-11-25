declare const mammoth: any;
declare const pdfjsLib: any;

export const extractTextFromFile = async (file: File): Promise<string> => {
    try {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let textContent = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const text = await page.getTextContent();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                textContent += text.items.map((item: any) => item.str).join(' ');
                textContent += '\n\n';
            }
            return textContent;
        } else if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value;
        } else {
            throw new Error('Formato não suportado.');
        }
    } catch(error) {
         throw new Error("Erro ao ler arquivo.");
    }
};