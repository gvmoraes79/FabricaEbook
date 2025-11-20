import React, { useState } from 'react';

interface TopicFormProps {
    onSubmit: (topic: string, minPageCount: number, maxPageCount: number, language: string, includeImages: boolean, observations: string) => void;
    isLoading: boolean;
}

export const TopicForm: React.FC<TopicFormProps> = ({ onSubmit, isLoading }) => {
    const [topic, setTopic] = useState('');
    const [minPageCount, setMinPageCount] = useState(20);
    const [maxPageCount, setMaxPageCount] = useState(30);
    const [language, setLanguage] = useState('Português');
    const [includeImages, setIncludeImages] = useState(false);
    const [observations, setObservations] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(topic, minPageCount, maxPageCount, language, includeImages, observations);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col items-center gap-4 bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Tópico</label>
                <input 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" 
                    placeholder="Ex: História de Roma" 
                    disabled={isLoading} 
                    required 
                />
            </div>
            <div className="flex gap-4 w-full">
                <div className="w-1/2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Pág. Mínimas</label>
                    <input 
                        type="number" 
                        value={minPageCount} 
                        onChange={(e) => setMinPageCount(Number(e.target.value))} 
                        className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" 
                        disabled={isLoading} 
                    />
                </div>
                <div className="w-1/2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Pág. Máximas</label>
                    <input 
                        type="number" 
                        value={maxPageCount} 
                        onChange={(e) => setMaxPageCount(Number(e.target.value))} 
                        className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" 
                        disabled={isLoading} 
                    />
                </div>
            </div>
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Idioma</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" disabled={isLoading}>
                    <option value="Português">Português</option>
                    <option value="English">English</option>
                    <option value="Español">Español</option>
                    <option value="Français">Français</option>
                    <option value="Italiano">Italiano</option>
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
            <div className="w-full">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} className="h-4 w-4 text-cyan-500 rounded" disabled={isLoading} />
                    Incluir imagens geradas por IA?
                </label>
            </div>
            <button type="submit" disabled={isLoading || !topic.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg disabled:opacity-50 transition-colors">
                {isLoading ? 'Gerando...' : 'Gerar E-book'}
            </button>
        </form>
    );
};