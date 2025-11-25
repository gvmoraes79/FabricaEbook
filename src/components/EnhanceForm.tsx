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
    const [fileName, setFileName] = useState('Nenhum arquivo selecionado');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setFileName(e.target.files[0].name);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (file) onSubmit(file, { style, language, includeImages, diagramming, observations });
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col items-center gap-4 bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Arquivo (.pdf, .docx)</label>
                <label htmlFor="file-upload" className="w-full flex items-center justify-between bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-600 transition">
                    <span className="truncate pr-2 text-slate-300">{fileName}</span>
                    <span className="text-cyan-400 font-semibold">Selecionar</span>
                </label>
                <input id="file-upload" type="file" onChange={handleFileChange} className="hidden" accept=".pdf,.docx" disabled={isLoading} />
            </div>
             <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Estilo</label>
                <select value={style} onChange={(e) => setStyle(e.target.value as any)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" disabled={isLoading}>
                    <option value="AsIs">Manter original (Corrigir)</option>
                    <option value="MoreFormal">Mais Formal</option>
                    <option value="MoreCasual">Mais Casual</option>
                    <option value="MoreDidactic">Mais Didático</option>
                </select>
            </div>
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Idioma de Saída</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" disabled={isLoading}>
                    <option value="Português">Português</option>
                    <option value="English">English</option>
                    <option value="Español">Español</option>
                    <option value="Français">Français</option>
                    <option value="Italiano">Italiano</option>
                    <option value="Mandarim">Mandarim</option>
                </select>
            </div>
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Observações</label>
                <textarea 
                    value={observations} 
                    onChange={(e) => setObservations(e.target.value)} 
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg h-24 focus:ring-2 focus:ring-cyan-500 outline-none" 
                    placeholder="Instruções extras..." 
                    disabled={isLoading} 
                />
            </div>
            <div className="w-full space-y-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} className="h-4 w-4 text-cyan-500 rounded" disabled={isLoading} /> 
                    Incrementar com imagens IA
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={diagramming} onChange={(e) => setDiagramming(e.target.checked)} className="h-4 w-4 text-cyan-500 rounded" disabled={isLoading} /> 
                    Aplicar diagramação (Capa/Índice)
                </label>
            </div>
            <button type="submit" disabled={isLoading || !file} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg disabled:opacity-50 transition-colors">
                {isLoading ? 'Processando...' : 'Aprimorar Documento'}
            </button>
        </form>
    );
};