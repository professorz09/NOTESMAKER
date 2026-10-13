import React from 'react';
import { FileText, Upload, X, Youtube, Wand2 } from 'lucide-react';

interface SidebarInputSectionProps {
  mode: 'topic' | 'text' | 'file' | 'transcript' | 'currentAffairs';
  outputStyle: 'notes' | 'upsc' | 'essay' | 'research' | 'table';
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
  transcriptProgress: { current: number; total: number; step: 'fetch' | 'restructure' | 'structure' | 'detail'; note?: string } | null;
  handleRestructureDraft: () => void;
  isRestructuringDraft: boolean;
  draftBackup: string | null;
  handleUndoRestructureDraft: () => void;
  isGenerating: boolean;
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
  handleRestructureDraft, isRestructuringDraft, draftBackup, handleUndoRestructureDraft, isGenerating,
  youtubeUrl, setYoutubeUrl,
}) => (
  <div className="space-y-2">
    <label className="nm-label block px-0.5">
      {LABELS[mode]}
    </label>
    <form onSubmit={handleGenerate} id="main-form">
      {mode === 'topic' ? (
        outputStyle === 'upsc' || outputStyle === 'essay' ? (
          <textarea
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder={outputStyle === 'essay' ? '"The roof needs mending most when the sun is shining" — write an essay on this...' : 'Discuss the impact of climate change on Indian agriculture...'}
            rows={4}
            className="nm-input resize-none leading-relaxed"
          />
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. History of Mughal Empire..."
              className="nm-input"
            />
            {outputStyle === 'table' && (
              <input
                type="text"
                value={tableInstruction}
                onChange={(e) => setTableInstruction(e.target.value)}
                placeholder="e.g. Compare Articles 12-35 of Indian Constitution..."
                className="nm-input"
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
            className="nm-input resize-none leading-relaxed"
          />

          <div className="nms-or nm-label !text-[10px]">and / or</div>

          <label className="nms-drop-wrap block relative cursor-pointer">
            <input type="file" multiple accept=".pdf,.txt,image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="nms-drop py-4 px-4">
              <Upload className="w-[18px] h-[18px] flex-shrink-0" />
              <div className="text-left">
                <p className="text-[13px] font-semibold nm-head">Drop files or click to upload</p>
                <p className="text-[11px] nm-muted mt-0.5">PDF, TXT, Images supported</p>
              </div>
            </div>
          </label>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="nms-file">
                  <FileText className="w-4 h-4 nm-accent-text flex-shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="nms-x" aria-label={`Remove ${file.name}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* YouTube / video link */}
          <div className="nm-input nms-field">
            <Youtube className="w-4 h-4" />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Paste YouTube video link…"
            />
            {youtubeUrl.trim() && (
              <button type="button" onClick={() => setYoutubeUrl('')} className="nms-x -mr-2" aria-label="Clear link">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="nms-or nm-label !text-[10px]">or transcript</div>

          <textarea
            value={transcriptInput}
            onChange={(e) => setTranscriptInput(e.target.value)}
            placeholder="Paste the full class transcript here (up to 3–4 hours)..."
            rows={6}
            className="nm-input resize-none leading-relaxed"
          />
          <label className="nms-drop-wrap block relative cursor-pointer">
            <input type="file" accept=".txt,text/plain" onChange={handleTranscriptFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="nms-drop min-h-[44px] px-3">
              <Upload className="w-4 h-4" />
              <p className="text-[12px] font-semibold">or upload a .txt transcript file</p>
            </div>
          </label>
          {transcriptInput.trim() && (
            <p className="nms-help">
              ~{(transcriptInput.trim().match(/\S+/g) || []).length.toLocaleString('en-IN')} words
            </p>
          )}
          {transcriptInput.trim() && !transcriptProgress && (
            <button
              type="button"
              onClick={handleRestructureDraft}
              disabled={isGenerating || isRestructuringDraft}
              className="nm-btn w-full min-h-[42px] text-[13px]"
            >
              <Wand2 className="w-4 h-4 nm-accent-text" />
              {isRestructuringDraft ? 'Restructuring draft…' : 'Restructure Draft'}
            </button>
          )}
          {transcriptInput.trim() && !transcriptProgress && (
            <div className="flex items-start justify-between gap-2 px-0.5">
              <p className="nms-help !px-0">
                Optional — cleans up broken sentences/paragraphing in the pasted or fetched transcript (nothing is summarised or dropped) before you press "Start Notes Making".
              </p>
              {draftBackup !== null && !isRestructuringDraft && (
                <button
                  type="button"
                  onClick={handleUndoRestructureDraft}
                  disabled={isGenerating}
                  className="text-[11px] font-bold nms-warn underline underline-offset-2 flex-shrink-0 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Undo restructure
                </button>
              )}
            </div>
          )}
          {transcriptProgress && (
            <div className="space-y-1.5 pt-0.5">
              <div className="nms-bar">
                <div
                  className={transcriptProgress.step === 'fetch' ? 'animate-pulse' : ''}
                  style={{
                    width: `${transcriptProgress.step === 'fetch' ? 20 : transcriptProgress.step === 'structure' ? 6 : Math.round((transcriptProgress.current / transcriptProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="nms-help">
                {transcriptProgress.step === 'fetch'
                  ? (transcriptProgress.note || 'Fetching transcript from YouTube…')
                  : transcriptProgress.step === 'restructure'
                    ? `Restructuring draft (part ${transcriptProgress.current}/${transcriptProgress.total})…`
                    : transcriptProgress.step === 'structure'
                      ? 'Step 1/2 — building structure…'
                      : `Step 2/2 — detailed notes (part ${transcriptProgress.current}/${transcriptProgress.total})`}
              </p>
            </div>
          )}
        </div>
      )}
    </form>
  </div>
);
