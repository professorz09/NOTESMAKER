import React from 'react';
import { Globe, Cpu, Zap } from 'lucide-react';

interface SidebarLanguageModelProps {
  language: string;
  setLanguage: (lang: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
}

const MODELS = [
  { id: 'gemini-3.8-flash',       label: 'Flash 3.8', isFlash: true },
  { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1', isFlash: false },
  // Newest and most careful with facts; thinks longer, so slower and pricier
  { id: 'gemini-4-argon',         label: 'Argon 4', isFlash: false },
  { id: 'gemini-3.1-flash-lite',  label: 'Flash Lite', isFlash: true  },
];

// The "Mix" option's stored value is the actual instruction sent to every
// generation prompt (all of them just interpolate `Language: ${language}` as
// free text) — English by default, with Hindi added in only where it
// genuinely helps understanding, e.g. explaining a grammar rule while writing
// English-grammar notes. Deliberately NOT called "Hinglish" and explicitly
// rules out romanised Hindi, since that word means Hindi spelled out in
// English letters (texting-style) to most users — this is real Hindi in
// Devanagari script mixed in alongside English, not a transliteration.
// Kept as one exported constant so the exact-match comparisons elsewhere in
// the app (language === 'Hindi') can deliberately treat this as "not Hindi"
// and fall back to their English-oriented branch, which is the right
// behaviour for UI copy and transcript-fetch language.
export const MIX_LANGUAGE = 'English by default — but wherever a grammar rule, tricky word, or concept is genuinely easier to understand in Hindi, add a short Hindi explanation alongside it, written in proper Devanagari script (हिंदी) — never Hindi spelled out in English/Roman letters. Keep everything else in English; do not translate content that does not need it.';

const LANGUAGES = [
  { label: 'Hindi', value: 'Hindi' },
  { label: 'English', value: 'English' },
  { label: 'Mix', value: MIX_LANGUAGE },
];

export const SidebarLanguageModel: React.FC<SidebarLanguageModelProps> = ({
  language, setLanguage,
  aiModel, setAiModel,
}) => (
  <div className="space-y-4">
    {/* Language */}
    <div className="space-y-2">
      <label className="nm-label nms-title">
        <Globe /> Language
      </label>
      <div className="nm-seg nms-tight">
        {LANGUAGES.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setLanguage(value)}
            aria-pressed={language === value}
            title={label === 'Mix' ? 'English notes, with Hindi (Devanagari script) explanations added only where they genuinely help — e.g. grammar rules' : undefined}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* AI Model */}
    <div className="space-y-2">
      <label className="nm-label nms-title">
        <Cpu /> AI Model
      </label>
      <div className="nm-seg nms-tight">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setAiModel(m.id)}
            aria-pressed={aiModel === m.id}
          >
            {m.isFlash ? <Zap className="w-3 h-3 flex-shrink-0" /> : <Cpu className="w-3 h-3 flex-shrink-0" />}
            <span className="truncate">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);
