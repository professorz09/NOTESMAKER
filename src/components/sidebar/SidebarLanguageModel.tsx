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
  { id: 'gemini-3.7-flash',       label: 'Flash 3.7', isFlash: true },
  { id: 'gemini-3.1-flash-lite',  label: 'Flash Lite', isFlash: true  },
];

// The "Hinglish" option's stored value is the actual instruction sent to
// every generation prompt (all of them just interpolate `Language: ${language}`
// as free text) — English by default, with Hindi added in only where it
// genuinely helps understanding, e.g. explaining a grammar rule while writing
// English-grammar notes. Kept as one exported constant so the exact-match
// comparisons elsewhere in the app (language === 'Hindi') can deliberately
// treat this as "not Hindi" and fall back to their English-oriented branch,
// which is the right behaviour for UI copy and transcript-fetch language.
export const HINGLISH_LANGUAGE = 'English by default — but wherever a grammar rule, tricky word, or concept is genuinely easier to understand in Hindi, add a short Hindi (Devanagari) explanation alongside it. Keep everything else in English; do not translate content that does not need it.';

const LANGUAGES = [
  { label: 'Hindi', value: 'Hindi' },
  { label: 'English', value: 'English' },
  { label: 'Hinglish', value: HINGLISH_LANGUAGE },
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
        {LANGUAGES.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setLanguage(value)}
            title={label === 'Hinglish' ? 'English notes, with Hindi explanations added only where they genuinely help (e.g. grammar rules)' : undefined}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              language === value
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'
            }`}
          >
            {label}
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
