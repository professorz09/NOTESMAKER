import React from 'react';
import { FileText, Upload, X } from 'lucide-react';

interface SidebarInputSectionProps {
  mode: 'topic' | 'text' | 'file';
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
}

export const SidebarInputSection: React.FC<SidebarInputSectionProps> = ({
  mode, outputStyle,
  topicInput, setTopicInput,
  textInput, setTextInput,
  tableInstruction, setTableInstruction,
  files, handleFileUpload, removeFile,
  handleGenerate,
}) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
      {mode === 'topic' ? 'Your Topic' : mode === 'text' ? 'Paste Raw Notes' : 'Upload Files'}
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
      ) : mode === 'text' ? (
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Paste your rough notes or content here..."
          rows={5}
          className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
        />
      ) : (
        <div className="space-y-3">
          <label className="block relative cursor-pointer">
            <input type="file" multiple accept=".pdf,.txt,image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center gap-3 py-8 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/4 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-400" />
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
      )}
    </form>
  </div>
);
