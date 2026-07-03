import React from 'react';
import { FileText, Upload, X, Youtube } from 'lucide-react';

interface SidebarInputSectionProps {
  mode: 'topic' | 'text' | 'file' | 'transcript';
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  topicInput: string;
  setTopicInput: (v: string) => void;
  textInput: string;
  setTextInput: (v: string) => void;
  tableInstruction: string;
  setTableInstruction: (v: string) => void;
  files: { name: string; mimeType: string; data: string }[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  handleGenerate: (e: React.FormEvent) => void;
  transcriptInput: string;
  setTranscriptInput: (v: string) => void;
  handleTranscriptFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  transcriptProgress: { current: number; total: number; step: 'fetch' | 'structure' | 'detail'; note?: string } | null;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
}

const LABELS: Record<string, string> = {
  topic: 'Your Topic',
  text: 'Text / Files',
  file: 'Text / Files',
  transcript: 'Class Transcript',
};

export const SidebarInputSection: React.FC<SidebarInputSectionProps> = ({
  mode, outputStyle,
  topicInput, setTopicInput,
  textInput, setTextInput,
  tableInstruction, setTableInstruction,
  files, handleFileUpload, removeFile,
  handleGenerate,
  transcriptInput, setTranscriptInput,
  handleTranscriptFileUpload, transcriptProgress,
  youtubeUrl, setYoutubeUrl,
}) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
      {LABELS[mode]}
    </label>
    <form onSubmit={handleGenerate} id="main-form">
      {mode === 'topic' ? (
        outputStyle === 'upsc' ? (
          <textarea
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Discuss the impact of climate change on Indian agriculture..."
            rows={4}
            className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
          />
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. History of Mughal Empire..."
              className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all"
            />
            {outputStyle === 'table' && (
              <input
                type="text"
                value={tableInstruction}
                onChange={(e) => setTableInstruction(e.target.value)}
                placeholder="e.g. Compare Articles 12-35 of Indian Constitution..."
                className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/6 transition-all"
              />
            )}
          </div>
        )
      ) : mode === 'text' || mode === 'file' ? (
        <div className="space-y-3">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste your rough notes or content here..."
            rows={5}
            className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
          />

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[9px] text-slate-600 uppercase tracking-widest">and / or</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          <label className="block relative cursor-pointer">
            <input type="file" multiple accept=".pdf,.txt,image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center gap-2 py-6 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/4 transition-all">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Upload className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Drop files or click to upload</p>
                <p className="text-xs text-slate-600 mt-1">PDF, TXT, Images supported</p>
              </div>
            </div>
          </label>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/4 rounded-xl px-3 py-2.5 border border-white/6">
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* YouTube / video link */}
          <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2 focus-within:border-red-500/50 transition-all">
            <Youtube className="w-4 h-4 text-red-400/90 flex-shrink-0" />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube video link paste करें…"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none min-w-0"
            />
            {youtubeUrl.trim() && (
              <button type="button" onClick={() => setYoutubeUrl('')} className="text-slate-600 hover:text-red-400 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[9px] text-slate-600 uppercase tracking-widest">या transcript</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          <textarea
            value={transcriptInput}
            onChange={(e) => setTranscriptInput(e.target.value)}
            placeholder="यहाँ पूरी class transcript paste करें (3–4 घंटे तक)..."
            rows={6}
            className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
          />
          <label className="block relative cursor-pointer">
            <input type="file" accept=".txt,text/plain" onChange={handleTranscriptFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/25 hover:border-indigo-500/50 hover:bg-indigo-500/6 transition-all">
              <Upload className="w-3.5 h-3.5 text-indigo-400/80" />
              <p className="text-[11px] text-slate-400">या .txt transcript file upload करें</p>
            </div>
          </label>
          {transcriptInput.trim() && (
            <p className="text-[10px] text-slate-600 px-0.5">
              ~{(transcriptInput.trim().match(/\S+/g) || []).length.toLocaleString('en-IN')} words
            </p>
          )}
          {transcriptProgress && (
            <div className="space-y-1.5 pt-0.5">
              <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${transcriptProgress.step === 'fetch' ? 'animate-pulse' : ''}`}
                  style={{
                    width: `${transcriptProgress.step === 'fetch' ? 20 : transcriptProgress.step === 'structure' ? 6 : Math.round((transcriptProgress.current / transcriptProgress.total) * 100)}%`,
                    background: transcriptProgress.step === 'fetch'
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                  }}
                />
              </div>
              <p className="text-[10px] text-indigo-300/90">
                {transcriptProgress.step === 'fetch'
                  ? (transcriptProgress.note || 'YouTube से transcript लाई जा रही है…')
                  : transcriptProgress.step === 'structure'
                    ? 'Step 1/2 — structure बन रहा है…'
                    : `Step 2/2 — detailed notes (भाग ${transcriptProgress.current}/${transcriptProgress.total})`}
              </p>
            </div>
          )}
        </div>
      )}
    </form>
  </div>
);
