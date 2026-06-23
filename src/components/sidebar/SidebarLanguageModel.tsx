import React from 'react';
import { Globe, Cpu, Zap } from 'lucide-react';

interface SidebarLanguageModelProps {
  language: string;
  setLanguage: (lang: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
}

const MODELS = [
  { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1', isFlash: false },
  { id: 'gemini-3.1-flash-lite',  label: 'Flash Lite', isFlash: true  },
];

export const SidebarLanguageModel: React.FC<SidebarLanguageModelProps> = ({
  language, setLanguage,
  aiModel, setAiModel,
}) => (
  <div className="grid grid-cols-2 gap-3">
    {/* Language */}
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <Globe className="w-3 h-3" /> Language
      </label>
      <div className="flex flex-col gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
        {['Hindi', 'English'].map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              language === lang
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>

    {/* AI Model */}
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <Cpu className="w-3 h-3" /> AI Model
      </label>
      <div className="flex flex-col gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setAiModel(m.id)}
            className={`py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              aiModel === m.id
                ? 'bg-violet-600 text-white shadow-md shadow-violet-900/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'
            }`}
          >
            {m.isFlash ? <Zap className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
            {m.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);
