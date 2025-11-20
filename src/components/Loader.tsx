import React from 'react';

interface LoaderProps {
    message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 mt-12 bg-slate-800 rounded-lg w-full max-w-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mb-4"></div>
            <p className="text-slate-300 font-medium text-center">{message}</p>
        </div>
    );
};