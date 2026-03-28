import { useState, type MutableRefObject } from 'react';
import {
  generateTopicContent,
  generateTopicComparisonTable,
  generateTopicDetailedTable,
  generateFormattedNotes,
  generateFileNotes,
  generateUPSCAnswer,
  generateResearchPaper,
} from '../services/ai';
import { GenerationStatus } from '../types';
import { STORAGE_KEY } from '../utils/editorUtils';

interface UseGenerationProps {
  pushToHistory: (content: string) => void;
  isResettingRef: MutableRefObject<boolean>;
  setGeneratedHtml: (html: string | null) => void;
  resetHistory: () => void;
  setIsEditing: (editing: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}

export function useGeneration({
  pushToHistory,
  isResettingRef,
  setGeneratedHtml,
  resetHistory,
  setIsEditing,
  setSidebarOpen,
}: UseGenerationProps) {
  const [mode, setMode] = useState<'topic' | 'text' | 'file'>('topic');
  const [outputStyle, setOutputStyle] = useState<'notes' | 'upsc' | 'research'>('notes');
  const [wordLimit, setWordLimit] = useState(250);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [language, setLanguage] = useState('Hindi');
  const [aiModel, setAiModel] = useState('gemini-2.5-pro-preview-05-06');
  const [topicInput, setTopicInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files as FileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        let mimeType = file.type || 'application/octet-stream';
        if (!file.type) {
          if (file.name.endsWith('.txt')) mimeType = 'text/plain';
          else if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        }
        setFiles(prev => [...prev, { name: file.name, mimeType, data: base64Data }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const finishGeneration = (result: string) => {
    if (isResettingRef.current) return;
    setGeneratedHtml(result);
    pushToHistory(result);
    localStorage.setItem(STORAGE_KEY, result);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'topic' && !topicInput.trim()) return;
    if (mode === 'text' && !textInput.trim()) return;
    if (mode === 'file' && files.length === 0) return;

    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      let result = '';
      if (mode === 'topic') {
        if (outputStyle === 'upsc') result = await generateUPSCAnswer(topicInput, language, aiModel, wordLimit);
        else if (outputStyle === 'research') result = await generateResearchPaper(topicInput, language, aiModel);
        else result = await generateTopicContent(topicInput, language, aiModel);
      } else if (mode === 'text') {
        result = await generateFormattedNotes(textInput, language, aiModel, outputStyle, wordLimit);
      } else {
        result = await generateFileNotes(files, language, aiModel, outputStyle, wordLimit);
      }
      finishGeneration(result);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        alert(`Error generating content: ${error.message || 'Unknown error'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleGenerateTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) { alert('Please enter a topic first.'); return; }
    setStatus(GenerationStatus.GENERATING_TABLE);
    try {
      const result = await generateTopicComparisonTable(topicInput, language, aiModel);
      finishGeneration(result);
    } catch (error) {
      if (!isResettingRef.current) { console.error(error); alert('Error generating table. Please try again.'); }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleGenerateDetailedTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) { alert('Please enter a topic first.'); return; }
    setStatus(GenerationStatus.GENERATING_DETAILED_TABLE);
    try {
      const result = await generateTopicDetailedTable(topicInput, language, aiModel);
      finishGeneration(result);
    } catch (error) {
      if (!isResettingRef.current) { console.error(error); alert('Error generating table. Please try again.'); }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleClearCanvas = (
    activeEditIdRef: MutableRefObject<string | null>,
    selectionRangeRef: MutableRefObject<Range | null>,
  ) => {
    if (!confirm('Are you sure you want to clear the editor?')) return;
    isResettingRef.current = true;
    setGeneratedHtml(null);
    resetHistory();
    setIsEditing(false);
    activeEditIdRef.current = null;
    selectionRangeRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => { isResettingRef.current = false; }, 100);
  };

  return {
    mode, setMode,
    outputStyle, setOutputStyle,
    wordLimit, setWordLimit,
    status,
    language, setLanguage,
    aiModel, setAiModel,
    topicInput, setTopicInput,
    textInput, setTextInput,
    files,
    handleFileUpload,
    removeFile,
    handleGenerate,
    handleGenerateTable,
    handleGenerateDetailedTable,
    handleClearCanvas,
  };
}
