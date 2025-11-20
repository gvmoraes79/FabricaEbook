import React, { useState } from 'react';
import type { EnhanceOptions } from '../types';

interface EnhanceFormProps {
    onSubmit: (file: File, options: EnhanceOptions) => void;
    isLoading: boolean;
}

export const EnhanceForm: React.FC<EnhanceFormProps> = ({ onSubmit, isLoading }) => {
    const [file, setFile] = useState<File | null>(null);
    const [style, setStyle] = useState<EnhanceOptions['style']>('AsIs');
    const [language, setLanguage] = useState('Português');
    const [includeImages, setIncludeImages] = useState(false);
    const [diagramming, setDiagramming] = useState(true);
    const [observations, setObservations] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (file) onSubmit(file, { style, language, includeImages, diagramming, observations });
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col items-center gap-4 bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Arquivo (.pdf, .docx)</label>
                <input type="file" onChange={handleFileChange} className="w-full text-slate-300" accept=".pdf,.docx" disabled={isLoading} />
            </div>
             <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Estilo</label>
                <select value={style} onChange={(e) => setStyle(e.target.value as any)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg" disabled={isLoading}>
                    <option value="AsIs">Manter original</option>
                    <option value="MoreFormal">Mais Formal</option>
                    <option value="MoreCasual">Mais Casual</option>
                </select>
            </div>
            <div className="w-full">
                <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} disabled={isLoading} /> Imagens IA
                </label>
            </div>
            <button type="submit" disabled={isLoading || !file} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg disabled:opacity-50">
                {isLoading ? 'Processando...' : 'Aprimorar'}
            </button>
        </form>
    );
};