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
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg" placeholder="Ex: História de Roma" disabled={isLoading} required />
            </div>
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Idioma</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg" disabled={isLoading}>
                    <option value="Português">Português</option>
                    <option value="English">English</option>
                    <option value="Español">Español</option>
                </select>
            </div>
             <div className="w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Observações</label>
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg h-24" placeholder="Instruções extras..." disabled={isLoading} />
            </div>
            <div className="w-full">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} className="h-4 w-4" disabled={isLoading} />
                    Incluir imagens?
                </label>
            </div>
            <button type="submit" disabled={isLoading || !topic.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 rounded-lg disabled:opacity-50">
                {isLoading ? 'Gerando...' : 'Gerar E-book'}
            </button>
        </form>
    );
};