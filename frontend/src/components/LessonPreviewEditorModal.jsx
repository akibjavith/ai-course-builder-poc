import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, ChevronDown, Edit3, Save, Trash2, X, Plus, Trash, 
  HelpCircle, FileCode, AlertTriangle, AlertCircle, FileText, Info, 
  BookOpen, ExternalLink, Lightbulb, CheckSquare, ListOrdered, List, Check,
  Paperclip, Upload, Loader2, Palette, Paintbrush
} from 'lucide-react';
import { uploadChapterMedia, listMediaFiles, getThemes, uploadTheme } from '../api';
import SecureDocViewer from './SecureDocViewer';
import ActionModal from './ActionModal';

// Generates a local short ID if uuid isn't available
const generateLocalId = () => Math.random().toString(36).substr(2, 9);

// Standard block icons and colors
const BLOCK_INFO = {
  heading: { label: 'Heading', icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
  paragraph: { label: 'Paragraph', icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  bullet_list: { label: 'Bullet List', icon: List, color: 'text-teal-500', bg: 'bg-teal-50' },
  numbered_list: { label: 'Numbered List', icon: ListOrdered, color: 'text-teal-500', bg: 'bg-teal-50' },
  image: { label: 'Image', icon: Info, color: 'text-amber-500', bg: 'bg-amber-50' },
  video: { label: 'Video', icon: Info, color: 'text-rose-500', bg: 'bg-rose-50' },
  table: { label: 'Table', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  callout: { label: 'Callout', icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  code: { label: 'Code Block', icon: FileCode, color: 'text-slate-500', bg: 'bg-slate-50' },
  example: { label: 'Example', icon: Lightbulb, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  quiz: { label: 'Quiz', icon: HelpCircle, color: 'text-purple-500', bg: 'bg-purple-50' },
  assignment: { label: 'Assignment', icon: CheckSquare, color: 'text-violet-500', bg: 'bg-violet-50' },
  knowledge_check: { label: 'Knowledge Check', icon: HelpCircle, color: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
  summary: { label: 'Summary', icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
  reference: { label: 'Reference', icon: ExternalLink, color: 'text-blue-500', bg: 'bg-blue-50' },
  attachment: { label: 'File Attachment', icon: Paperclip, color: 'text-orange-500', bg: 'bg-orange-50' },
};

// Fallback clipboard copying helper
function fallbackCopyText(text, callback) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful && callback) {
      callback();
    }
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
}

// Custom hook to automatically add copy buttons to <pre> tags with MutationObserver
function useCopyCode(containerRef, dependency) {
  useEffect(() => {
    if (!containerRef.current) return;
    const addCopyButtons = () => {
      const preBlocks = containerRef.current.querySelectorAll('pre');
      preBlocks.forEach((pre) => {
        if (pre.querySelector('.copy-code-btn') || pre.dataset.hasCopyBtn) return;
        pre.style.position = 'relative';
        pre.dataset.hasCopyBtn = 'true';
        const button = document.createElement('button');
        button.className = 'copy-code-btn absolute top-3 right-3 bg-gray-800/95 hover:bg-gray-700 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-gray-700/50 shadow-md flex items-center gap-1 active:scale-95 z-10';
        button.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copy Code</span>
        `;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const codeElement = pre.querySelector('code');
          const textToCopy = codeElement ? codeElement.innerText : pre.innerText.replace('Copy Code', '');
          
          const onSuccess = () => {
            button.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon text-green-400"><path d="M20 6 9 17l-5-5"/></svg>
              <span class="text-green-400">Copied!</span>
            `;
            setTimeout(() => {
              button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>Copy Code</span>
              `;
            }, 2000);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(onSuccess).catch(err => {
              fallbackCopyText(textToCopy, onSuccess);
            });
          } else {
            fallbackCopyText(textToCopy, onSuccess);
          }
        });
        pre.appendChild(button);
      });
    };

    addCopyButtons();
    const observer = new MutationObserver(addCopyButtons);
    observer.observe(containerRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, dependency]);
}

// Helper to parse markdown bold/italic in pure text
function formatRichText(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function flattenLessons(structure) {
  const lessons = [];
  (structure?.modules || []).forEach((mod, mIdx) => {
    (mod?.chapters || []).forEach((chap, cIdx) => {
      lessons.push({ mIdx, cIdx, chapter: chap, moduleTitle: mod?.title });
    });
  });
  return lessons;
}

function getChapter(structure, mIdx, cIdx) {
  return structure?.modules?.[mIdx]?.chapters?.[cIdx] || null;
}

function buildPreviewContent(chapter) {
  if (!chapter) return null;
  const validBlocks = (chapter?.contents || []).filter((b) => b?.completed && (b?.content || b?.blocks || b?.file_url));
  const legacy = chapter?.content?.completed ? [chapter.content] : [];
  const blocks = validBlocks.length > 0 ? validBlocks : legacy;

  const htmlBlocks = blocks.filter((b) => (b?.type === 'html' || b?.content_type === 'html') && b?.content);
  const html_content =
    htmlBlocks.length > 0
      ? htmlBlocks.map((b) => b.content).join('<hr class="my-8 border-slate-100" />')
      : null;

  const blockLesson = blocks.find((b) => b?.blocks);
  const lessonBlocks = blockLesson ? blockLesson.blocks : null;

  const files = blocks
    .filter((b) => b?.file_url)
    .map((b) => ({ url: b.file_url, name: b.file_name || b.file_url?.split('/').pop() }));

  const explanation = blocks.find((b) => b?.explanation)?.explanation || '';

  return { html_content, lessonBlocks, files, explanation };
}

// Interactive Quiz block renderer
function InteractiveQuiz({ block, editMode, onUpdateBlock }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset quiz selection if block changes
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [block.id]);

  if (editMode) {
    return (
      <div className="interactive-quiz-container">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-purple-500" />
          <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">Interactive Quiz Block</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Question</label>
            <input 
              type="text" 
              value={block.question || ''}
              onChange={(e) => onUpdateBlock({ question: e.target.value })}
              className="editor-text-input"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Options (One per line)</label>
            <textarea
              value={(block.options || []).join('\n')}
              onChange={(e) => onUpdateBlock({ options: e.target.value.split('\n') })}
              rows={4}
              className="editor-textarea-field resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Correct Answer</label>
              <select
                value={block.correctAnswer || ''}
                onChange={(e) => onUpdateBlock({ correctAnswer: e.target.value })}
                className="editor-select-field"
              >
                <option value="">Select Correct Option</option>
                {(block.options || []).map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Explanation</label>
              <input 
                type="text" 
                value={block.explanation || ''}
                onChange={(e) => onUpdateBlock({ explanation: e.target.value })}
                className="editor-text-input"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCorrect = selected === block.correctAnswer;

  return (
    <div className="interactive-quiz-container">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-purple-500" />
        <span className="text-xs font-black text-purple-600 uppercase tracking-widest">Knowledge Challenge</span>
      </div>
      <h3 className="quiz-question-title">{block.question}</h3>
      <div className="grid grid-cols-1 gap-3 my-4">
        {(block.options || []).map((opt, idx) => {
          let btnClass = "quiz-option-button";
          if (submitted) {
            if (opt === block.correctAnswer) {
              btnClass += " quiz-option-correct";
            } else if (selected === opt) {
              btnClass += " quiz-option-incorrect";
            } else {
              btnClass += " quiz-option-dimmed";
            }
          } else if (selected === opt) {
            btnClass += " quiz-option-active";
          }
          return (
            <button
              key={idx}
              disabled={submitted}
              onClick={() => setSelected(opt)}
              className={btnClass}
            >
              <span className="flex items-center justify-between w-full">
                <span>{opt}</span>
                {submitted && opt === block.correctAnswer && <Check className="w-4 h-4 text-green-600" />}
              </span>
            </button>
          );
        })}
      </div>
      {!submitted && selected && (
        <button
          onClick={() => setSubmitted(true)}
          className="quiz-submit-button"
        >
          Submit Answer
        </button>
      )}
      {submitted && (
        <div className={`quiz-explanation-box ${isCorrect ? 'quiz-option-correct' : 'quiz-option-incorrect'}`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            {isCorrect ? '✨ Correct!' : '❌ Incorrect'}
          </p>
          <p className="text-sm font-medium leading-relaxed">{block.explanation}</p>
        </div>
      )}
    </div>
  );
}

const DEFAULT_THEMES = [
  { id: "light", name: "Light Mode", variables: {} },
  { id: "dark", name: "Dark Midnight", variables: {} },
  { id: "sepia", name: "Sepia Cream", variables: {} }
];

// Main Dialog Component
export default function LessonPreviewEditorModal({
  courseData,
  updateCourseData,
  initialMIdx,
  initialCIdx,
  startInEdit = false,
  readOnly = false,
  onClose,
}) {
  const lessons = useMemo(() => flattenLessons(courseData?.structure), [courseData?.structure]);
  const [active, setActive] = useState({ mIdx: initialMIdx, cIdx: initialCIdx });
  const [editMode, setEditMode] = useState(!readOnly && !!startInEdit);
  const activeLessonIndex = lessons.findIndex((l) => l.mIdx === active.mIdx && l.cIdx === active.cIdx);
  const chapter = getChapter(courseData?.structure, active.mIdx, active.cIdx);
  const previewContent = useMemo(() => buildPreviewContent(chapter), [chapter]);

  // If blocks are loaded, use blocks. Otherwise use htmlDraft.
  const [blocksDraft, setBlocksDraft] = useState(previewContent?.lessonBlocks || null);
  const [htmlDraft, setHtmlDraft] = useState(previewContent?.html_content || chapter?.content?.html_content || '');
  const containerRef = useRef(null);
  // Track uploading state for attachment blocks
  const [uploadingBlockIdx, setUploadingBlockIdx] = useState(null);

  // Simple active insertion menu index
  const [activeInsertMenuIdx, setActiveInsertMenuIdx] = useState(null);

  // States for internal media library list picker
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [attachmentTabs, setAttachmentTabs] = useState({}); // { [blockIdx]: 'upload' | 'internal' }
  const [mediaSearch, setMediaSearch] = useState('');

  // State for secure document viewer
  const [secureViewerUrl, setSecureViewerUrl] = useState(null);

  // State for dynamic content theme switching
  const [theme, setTheme] = useState('light');
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const themeFileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);

  const fetchThemes = async () => {
    try {
      const data = await getThemes();
      if (data && Array.isArray(data) && data.length > 0) {
        setThemes(data);
      }
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    }
  };

  const handleThemeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const isCss = file.name.endsWith('.css');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let themeJson;
        if (isCss) {
          const cssText = e.target.result;
          const variables = {};
          const regex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
          let match;
          while ((match = regex.exec(cssText)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            variables[key] = value;
          }
          
          const allowedKeys = [
            "--bg-primary", "--bg-secondary", "--text-main", "--text-secondary", 
            "--text-muted", "--border-color", "--accent-color", "--accent-bg", 
            "--code-bg", "--code-text", "--theme-shadow",
            "--font-family", "--font-size-base", "--font-size-h1", "--font-size-h2",
            "--font-size-h3", "--line-height", "--block-spacing"
          ];
          
          const filteredVars = {};
          let hasVars = false;
          for (const key of allowedKeys) {
            if (variables[key]) {
              filteredVars[key] = variables[key];
              hasVars = true;
            }
          }
          
          if (!hasVars) {
            setModalConfig({
              title: "Invalid CSS Theme",
              message: "No valid theme CSS variables (e.g., --bg-primary) found in the file.",
              type: "warning",
              confirmText: "Got It"
            });
            return;
          }
          
          const themeId = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const themeName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
          
          themeJson = {
            id: themeId,
            name: themeName,
            variables: filteredVars
          };
        } else {
          themeJson = JSON.parse(e.target.result);
          if (!themeJson.id || !themeJson.name || !themeJson.variables) {
            setModalConfig({
              title: "Invalid Theme File",
              message: "Invalid theme JSON file. Must contain 'id', 'name', and 'variables'.",
              type: "warning",
              confirmText: "Got It"
            });
            return;
          }
        }
        
        const res = await uploadTheme(themeJson);
        if (res && res.status === 'success') {
          await fetchThemes();
          setTheme(themeJson.id);
          setModalConfig({
            title: "Theme Applied",
            message: `Theme "${themeJson.name}" has been uploaded and applied successfully!`,
            type: "success",
            confirmText: "Excellent"
          });
        }
      } catch (err) {
        console.error("Failed to parse theme file", err);
        setModalConfig({
          title: "Error Parsing Theme",
          message: "Failed to parse theme file: " + err.message,
          type: "warning",
          confirmText: "Got It"
        });
      }
    };
    reader.readAsText(file);
  };

  const activeThemeObj = useMemo(() => {
    return themes.find(t => t.id === theme) || themes[0] || DEFAULT_THEMES[0];
  }, [theme, themes]);

  useEffect(() => {
    fetchThemes();
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMedia = async () => {
    setLoadingMedia(true);
    try {
      const res = await listMediaFiles();
      if (res && res.status === 'success') {
        setMediaFiles(res.files || []);
      }
    } catch (err) {
      console.error('Failed to load media files:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  useCopyCode(containerRef, blocksDraft || htmlDraft);

  // Sync blocksDraft and htmlDraft when active lesson or courseData changes (e.g., on generation or save)
  useEffect(() => {
    const nextPreview = buildPreviewContent(getChapter(courseData?.structure, active.mIdx, active.cIdx));
    setBlocksDraft(nextPreview?.lessonBlocks || null);
    setHtmlDraft(nextPreview?.html_content || getChapter(courseData?.structure, active.mIdx, active.cIdx)?.content?.html_content || '');
  }, [active.mIdx, active.cIdx, courseData]);

  // Handle initialization of editMode only when active lesson changes (to support starting in edit mode from parent workspace actions)
  useEffect(() => {
    setEditMode(!readOnly && !!startInEdit);
    setActiveInsertMenuIdx(null);
  }, [active.mIdx, active.cIdx, readOnly, startInEdit]);

  const hasPrev = activeLessonIndex > 0;
  const hasNext = activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    const prev = lessons[activeLessonIndex - 1];
    setActive({ mIdx: prev.mIdx, cIdx: prev.cIdx });
  };
  const goNext = () => {
    if (!hasNext) return;
    const next = lessons[activeLessonIndex + 1];
    setActive({ mIdx: next.mIdx, cIdx: next.cIdx });
  };

  const handleUpdateBlock = (idx, fields) => {
    if (!blocksDraft) return;
    const updated = [...blocksDraft];
    updated[idx] = { ...updated[idx], ...fields };
    setBlocksDraft(updated);
  };

  const handleDeleteBlock = (idx) => {
    if (!blocksDraft) return;
    const updated = [...blocksDraft];
    updated.splice(idx, 1);
    setBlocksDraft(updated);
  };

  const handleInsertBlock = (idx, type) => {
    if (!blocksDraft) return;
    const newBlock = { id: generateLocalId(), type };
    // Set default fields based on type
    if (type === 'heading') { newBlock.level = 2; newBlock.text = 'New Heading'; }
    else if (type === 'paragraph') { newBlock.text = 'New paragraph explanation content...'; }
    else if (type === 'bullet_list' || type === 'numbered_list') { newBlock.items = ['List item 1', 'List item 2']; }
    else if (type === 'image' || type === 'video') { newBlock.url = ''; newBlock.caption = 'Describe this content'; }
    else if (type === 'table') { newBlock.headers = ['Header 1', 'Header 2']; newBlock.rows = [['Value 1', 'Value 2']]; }
    else if (type === 'callout') { newBlock.text = 'Note text'; newBlock.callout_type = 'info'; }
    else if (type === 'code') { newBlock.language = 'javascript'; newBlock.code = '// Code snippet'; newBlock.explanation = 'Explain the code'; }
    else if (type === 'example') { newBlock.scenario = 'Scenario title'; newBlock.detail = 'Example detailed description'; }
    else if (type === 'quiz') { newBlock.question = 'Question?'; newBlock.options = ['Option A', 'Option B']; newBlock.correctAnswer = 'Option A'; newBlock.explanation = 'Why Option A is correct'; }
    else if (type === 'assignment') { newBlock.task = 'Assignment task'; newBlock.instructions = 'Instructions'; newBlock.grading_criteria = ['Criterion 1']; }
    else if (type === 'knowledge_check') { newBlock.question = 'Question?'; newBlock.options = ['Option A', 'Option B']; newBlock.answer = 'Option A'; newBlock.explanation = 'Explanation'; }
    else if (type === 'summary') { newBlock.points = ['Point 1', 'Point 2']; }
    else if (type === 'reference') { newBlock.title = 'Resource Link'; newBlock.url = 'https://example.com'; }
    else if (type === 'attachment') { newBlock.title = 'Attached File'; newBlock.file_url = ''; newBlock.file_name = ''; }

    const updated = [...blocksDraft];
    updated.splice(idx + 1, 0, newBlock);
    setBlocksDraft(updated);
    setActiveInsertMenuIdx(null);
  };

  // Handle file upload for attachment blocks
  const handleAttachmentUpload = async (idx, file) => {
    if (!file) return;
    setUploadingBlockIdx(idx);
    try {
      const res = await uploadChapterMedia(file);
      handleUpdateBlock(idx, {
        file_url: res.url,
        file_name: file.name,
        title: file.name,
      });
    } catch (e) {
      setModalConfig({
        title: "Upload Failed",
        message: "File upload failed. Please try again.",
        type: "warning",
        confirmText: "OK"
      });
    } finally {
      setUploadingBlockIdx(null);
    }
  };

  const handleSaveDraft = () => {
    if (readOnly) return;
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== active.cIdx) return chap;
          if (blocksDraft) {
            const newContentBlock = {
              type: 'lesson-blocks',
              blocks: blocksDraft,
              source: 'ai',
              completed: true,
              timestamp: Date.now(),
            };
            return {
              ...chap,
              contents: [newContentBlock],
              content: {
                ...(chap.content || {}),
                content_type: 'lesson-blocks',
                html_content: '', // Reset legacy
                completed: true
              }
            };
          } else {
            // Legacy html draft save
            const newHtmlBlock = {
              type: 'html',
              content: htmlDraft,
              source: 'ai',
              completed: true,
              timestamp: Date.now(),
            };
            return {
              ...chap,
              contents: [newHtmlBlock],
              content: {
                ...(chap.content || {}),
                content_type: 'html',
                html_content: htmlDraft,
                completed: true,
              },
            };
          }
        }),
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
    setEditMode(false);
  };

  // Fix: deleteLesson now only clears lesson CONTENT (not the chapter itself)
  const deleteLesson = () => {
    if (readOnly) return;
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== active.cIdx) return chap;
          // Clear content only — keep the chapter (submodule) intact
          return {
            ...chap,
            contents: [],
            content: {
              ...(chap.content || {}),
              completed: false,
              html_content: '',
              content_type: '',
            },
          };
        }),
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
    // Reset local draft state so empty state is shown
    setBlocksDraft(null);
    setHtmlDraft('');
    setEditMode(false);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">

      {/* ── Custom Action Modal Popup ── */}
      <ActionModal
        isOpen={!!modalConfig}
        onClose={() => setModalConfig(null)}
        {...modalConfig}
      />

      {/* ── Secure Document Viewer Modal ── */}
      {secureViewerUrl && (
        <SecureDocViewer
          url={secureViewerUrl}
          onClose={() => setSecureViewerUrl(null)}
        />
      )}

      <div 
        className={`theme-container theme-${theme} animate-scale-in`} 
        style={!['light', 'dark', 'sepia', 'dark-theme', 'iron-man-theme', 'spider-man-theme', 'hulk-theme'].includes(theme) ? activeThemeObj.variables : {}}
      >
        
        {/* Header toolbar */}
        <div className="p-6 sm:px-10 flex items-center justify-between sticky top-0 z-20 border-b" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <div className="space-y-1 min-w-0 flex-shrink mr-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border flex-shrink-0" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent-color)', borderColor: 'var(--border-color)' }}>
                {editMode ? 'Edit Lesson' : 'Live Preview'}
              </span>
              <h2 className="text-xl font-bold tracking-tight truncate" style={{ color: 'var(--text-main)' }}>
                {chapter?.title || 'Lesson'}
              </h2>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--text-muted)' }}>
              {blocksDraft ? 'Block-based Interactive Lesson Outline' : 'HTML-based legacy content'}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Dynamic Premium Theme Switcher Selector */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 border hover:bg-slate-100/50 transition active:scale-95 shadow-sm"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {activeThemeObj?.name || 'Select Theme'}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-48 rounded-2xl shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      borderColor: 'var(--border-color)'
                    }}
                  >
                    <div className="py-1.5 max-h-60 overflow-y-auto">
                      {themes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTheme(t.id);
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors text-left"
                          style={{
                            color: theme === t.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                            backgroundColor: theme === t.id ? 'var(--accent-bg)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (theme !== t.id) {
                              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                              e.currentTarget.style.color = 'var(--text-main)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (theme !== t.id) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                          }}
                        >
                          <span>{t.name}</span>
                          {theme === t.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => themeFileInputRef.current?.click()}
                className="p-2.5 rounded-xl border hover:bg-slate-100/50 transition active:scale-95 flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
                title="Upload Custom Theme JSON/CSS"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">Upload Theme</span>
              </button>
              <input
                type="file"
                ref={themeFileInputRef}
                onChange={handleThemeUpload}
                accept=".json,.css"
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-1 border-r pr-3" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="p-2.5 rounded-xl transition-all disabled:opacity-30 active:scale-95"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                disabled={!hasNext}
                className="p-2.5 rounded-xl transition-all disabled:opacity-30 active:scale-95"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {!readOnly && !editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="p-3 rounded-2xl transition-all active:scale-95"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                title="Edit Content"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            ) : !readOnly && editMode ? (
              <button
                onClick={handleSaveDraft}
                className="p-3 bg-sky-600 text-white hover:bg-sky-700 rounded-2xl transition-all active:scale-95"
                title="Save Content"
              >
                <Save className="w-5 h-5" />
              </button>
            ) : null}

            {!readOnly && (
              <button
                onClick={deleteLesson}
                className="p-3 rounded-2xl transition-all active:scale-95"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                title="Delete lesson"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-3 rounded-2xl transition-all active:scale-95 border"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Viewer / Editor Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="lesson-paper-container">
            {/* Watermark Overlay behind content */}
            <div className="theme-watermark-overlay" aria-hidden="true">
              {theme === 'iron-man-theme' && (
                <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_60s_linear_infinite]">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 3" />
                  <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path d="M 50,2 L 50,15 M 50,85 L 50,98 M 2,50 L 15,50 M 85,50 L 98,50" stroke="currentColor" strokeWidth="2" />
                  <path d="M 16,16 L 25,25 M 75,75 L 84,84 M 16,84 L 25,75 M 75,16 L 84,25" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
              {theme === 'spider-man-theme' && (
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path d="M 50,0 L 50,100 M 0,50 L 100,50 M 15,15 L 85,85 M 15,85 L 85,15" stroke="currentColor" strokeWidth="0.75" />
                  <polygon points="50,15 75,25 85,50 75,75 50,85 25,75 15,50 25,25" fill="none" stroke="currentColor" strokeWidth="0.75" />
                  <polygon points="50,25 68,32 75,50 68,68 50,75 32,68 25,50 32,32" fill="none" stroke="currentColor" strokeWidth="0.75" />
                  <polygon points="50,35 61,40 65,50 61,60 50,65 39,60 35,50 39,40" fill="none" stroke="currentColor" strokeWidth="0.75" />
                  <ellipse cx="50" cy="50" rx="4" ry="6" fill="currentColor" />
                  <circle cx="50" cy="42" r="3" fill="currentColor" />
                  <path d="M 47,46 Q 40,42 35,46 M 47,49 Q 38,47 33,53 M 47,52 Q 38,53 35,62 M 47,55 Q 40,59 38,68" stroke="currentColor" strokeWidth="1.25" fill="none" />
                  <path d="M 53,46 Q 60,42 65,46 M 53,49 Q 62,47 67,53 M 53,52 Q 62,53 65,62 M 53,55 Q 60,59 62,68" stroke="currentColor" strokeWidth="1.25" fill="none" />
                </svg>
              )}
              {theme === 'hulk-theme' && (
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="8" fill="currentColor" />
                  <path d="M 50,50 L 50,20 A 30,30 0 0,1 76,35 Z" fill="currentColor" />
                  <path d="M 50,50 L 24,65 A 30,30 0 0,1 24,35 Z" fill="currentColor" transform="rotate(120 50 50)" />
                  <path d="M 50,50 L 24,65 A 30,30 0 0,1 24,35 Z" fill="currentColor" transform="rotate(240 50 50)" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" />
                </svg>
              )}
              {!['iron-man-theme', 'spider-man-theme', 'hulk-theme'].includes(theme) && (
                <div className="theme-watermark-text">
                  {activeThemeObj?.name || 'COURSE OUTLINE'}
                </div>
              )}
            </div>
            {blocksDraft ? (
              <div ref={containerRef} className="space-y-6">
                
                {blocksDraft.map((block, idx) => {
                  const isLastBlock = idx === blocksDraft.length - 1;
                  
                  return (
                    <div key={block.id || idx} className="block-wrapper-relative">
                      
                      {/* Top indicator & delete button inside edit mode */}
                      {editMode && (
                        <div className="block-hover-header">
                          <span>{block.type}</span>
                          <button 
                            onClick={() => handleDeleteBlock(idx)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete Block"
                          >
                            <Trash className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Render block types */}
                      <div className={`block-container ${editMode ? 'block-container-edit' : ''}`}>
                         {block.type === 'heading' && (
                          editMode ? (
                            <div className="flex gap-2 items-center">
                              <select 
                                value={block.level || 2}
                                onChange={(e) => handleUpdateBlock(idx, { level: parseInt(e.target.value) })}
                                className="editor-select-field !w-auto !p-2 !text-xs"
                              >
                                <option value={1}>H1</option>
                                <option value={2}>H2</option>
                                <option value={3}>H3</option>
                              </select>
                              <input 
                                type="text"
                                value={block.text || ''}
                                onChange={(e) => handleUpdateBlock(idx, { text: e.target.value })}
                                className="editor-text-input !p-2 !text-sm !font-semibold"
                              />
                            </div>
                          ) : (
                            block.level === 1 ? (
                              <h1 className="lesson-h1">{block.text}</h1>
                            ) : block.level === 3 ? (
                              <h3 className="lesson-h3">{block.text}</h3>
                            ) : (
                              <h2 className="lesson-h2">{block.text}</h2>
                            )
                          )
                        )}

                        {block.type === 'paragraph' && (
                          editMode ? (
                            <textarea
                              value={block.text || ''}
                              onChange={(e) => handleUpdateBlock(idx, { text: e.target.value })}
                              rows={5}
                              className="editor-textarea-field"
                              placeholder="Detailed paragraph content (150-250 words suggested)..."
                            />
                          ) : (
                            <p 
                              className="lesson-paragraph"
                              dangerouslySetInnerHTML={{ __html: formatRichText(block.text) }}
                            />
                          )
                        )}

                        {(block.type === 'bullet_list' || block.type === 'numbered_list') && (
                          editMode ? (
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{block.type === 'bullet_list' ? 'Bullet List' : 'Numbered List'}</span>
                              {(block.items || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex gap-2 items-center">
                                  <span className="text-xs font-bold text-slate-400">{block.type === 'bullet_list' ? '•' : `${itemIdx + 1}.`}</span>
                                  <input 
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const newItems = [...block.items];
                                      newItems[itemIdx] = e.target.value;
                                      handleUpdateBlock(idx, { items: newItems });
                                    }}
                                    className="editor-text-input !p-2 !text-xs"
                                  />
                                  <button
                                    onClick={() => {
                                      const newItems = [...block.items];
                                      newItems.splice(itemIdx, 1);
                                      handleUpdateBlock(idx, { items: newItems });
                                    }}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => handleUpdateBlock(idx, { items: [...(block.items || []), 'New list item'] })}
                                className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 flex items-center gap-1 active:scale-95"
                              >
                                <Plus className="w-3 h-3" /> Add Item
                              </button>
                            </div>
                          ) : (
                            block.type === 'bullet_list' ? (
                              <ul className="lesson-list lesson-list-bullet">
                                {(block.items || []).map((item, itemIdx) => (
                                  <li key={itemIdx} className="lesson-list-item" dangerouslySetInnerHTML={{ __html: formatRichText(item) }} />
                                ))}
                              </ul>
                            ) : (
                              <ol className="lesson-list lesson-list-number">
                                {(block.items || []).map((item, itemIdx) => (
                                  <li key={itemIdx} className="lesson-list-item" dangerouslySetInnerHTML={{ __html: formatRichText(item) }} />
                                ))}
                              </ol>
                            )
                          )
                        )}

                        {block.type === 'image' && (
                          editMode ? (
                            <div className="space-y-2 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Block</label>
                              <input 
                                type="text"
                                placeholder="Image URL (can be empty)"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />
                              <input 
                                type="text"
                                placeholder="Caption / Prompt Description"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />
                            </div>
                          ) : (
                            <div className="image-block-container">
                              {block.url ? (
                                <img src={block.url} alt={block.caption || ''} className="max-w-full max-h-[400px] object-contain rounded-xl mx-auto shadow-sm" />
                              ) : (
                                <div className="h-40 bg-slate-100 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                  [Visual Placeholder: {block.caption}]
                                </div>
                              )}
                              {block.caption && <p className="image-block-caption">{block.caption}</p>}
                            </div>
                          )
                        )}

                        {block.type === 'video' && (
                          editMode ? (
                            <div className="space-y-2 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Video Block</label>
                              <input 
                                type="text"
                                placeholder="Video URL"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />
                              <input 
                                type="text"
                                placeholder="Caption"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />
                            </div>
                          ) : (
                            <div className="video-block-container">
                              {block.url ? (
                                <video src={block.url} controls className="max-w-full rounded-xl mx-auto" />
                              ) : (
                                <div className="h-40 bg-slate-100 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                  [Video Segment: {block.caption}]
                                </div>
                              )}
                              {block.caption && <p className="video-block-caption">{block.caption}</p>}
                            </div>
                          )
                        )}

                        {block.type === 'table' && (
                          editMode ? (
                            <div className="space-y-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Table Columns</span>
                              <div className="flex gap-2">
                                {(block.headers || []).map((header, hIdx) => (
                                  <input 
                                    key={hIdx}
                                    type="text"
                                    value={header}
                                    onChange={(e) => {
                                      const newHeaders = [...block.headers];
                                      newHeaders[hIdx] = e.target.value;
                                      handleUpdateBlock(idx, { headers: newHeaders });
                                    }}
                                    className="table-edit-input"
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Table Rows</span>
                              {(block.rows || []).map((row, rIdx) => (
                                <div key={rIdx} className="flex gap-2 items-center">
                                  {row.map((cell, cIdx) => (
                                    <input 
                                      key={cIdx}
                                      type="text"
                                      value={cell}
                                      onChange={(e) => {
                                        const newRows = JSON.parse(JSON.stringify(block.rows));
                                        newRows[rIdx][cIdx] = e.target.value;
                                        handleUpdateBlock(idx, { rows: newRows });
                                      }}
                                      className="table-edit-input"
                                    />
                                  ))}
                                  <button
                                    onClick={() => {
                                      const newRows = [...block.rows];
                                      newRows.splice(rIdx, 1);
                                      handleUpdateBlock(idx, { rows: newRows });
                                    }}
                                    className="row-delete-button"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const newRow = Array(block.headers.length).fill('Cell data');
                                    handleUpdateBlock(idx, { rows: [...(block.rows || []), newRow] });
                                  }}
                                  className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 flex items-center gap-1 active:scale-95"
                                >
                                  <Plus className="w-3 h-3" /> Add Row
                                </button>
                                <button
                                  onClick={() => {
                                    const newHeaders = [...block.headers, 'New Col'];
                                    const newRows = (block.rows || []).map(r => [...r, '']);
                                    handleUpdateBlock(idx, { headers: newHeaders, rows: newRows });
                                  }}
                                  className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 flex items-center gap-1 active:scale-95"
                                >
                                  <Plus className="w-3 h-3" /> Add Column
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="table-block-wrapper">
                              <table className="lesson-table">
                                <thead>
                                  <tr>
                                    {(block.headers || []).map((header, hIdx) => (
                                      <th key={hIdx} scope="col">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(block.rows || []).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx}>
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        )}

                        {block.type === 'callout' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <div className="flex gap-2 items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Callout Type</label>
                                <select 
                                  value={block.callout_type || 'info'}
                                  onChange={(e) => handleUpdateBlock(idx, { callout_type: e.target.value })}
                                  className="editor-select-field !w-auto !p-1.5 !text-xs"
                                >
                                  <option value="info">Info</option>
                                  <option value="warning">Warning</option>
                                  <option value="tip">Tip</option>
                                  <option value="danger">Danger</option>
                                </select>
                              </div>
                              <textarea
                                value={block.text || ''}
                                onChange={(e) => handleUpdateBlock(idx, { text: e.target.value })}
                                rows={2}
                                className="editor-textarea-field"
                              />
                            </div>
                          ) : (
                            (() => {
                              let CalloutIcon = Info;
                              if (block.callout_type === 'warning') { CalloutIcon = AlertTriangle; }
                              else if (block.callout_type === 'tip') { CalloutIcon = Lightbulb; }
                              else if (block.callout_type === 'danger') { CalloutIcon = AlertCircle; }
                              
                              return (
                                <div className="callout-block-container">
                                  <CalloutIcon className="callout-icon-wrapper w-5 h-5" />
                                  <div className="callout-text" dangerouslySetInnerHTML={{ __html: formatRichText(block.text) }} />
                                </div>
                              );
                            })()
                          )
                        )}

                        {block.type === 'code' && (
                          editMode ? (
                            <div className="space-y-3 bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="Language"
                                  value={block.language || 'javascript'}
                                  onChange={(e) => handleUpdateBlock(idx, { language: e.target.value })}
                                  className="editor-text-input !p-2 !text-xs w-1/4"
                                />
                                <input 
                                  type="text"
                                  placeholder="Explanation"
                                  value={block.explanation || ''}
                                  onChange={(e) => handleUpdateBlock(idx, { explanation: e.target.value })}
                                  className="editor-text-input !p-2 !text-xs w-3/4"
                                />
                              </div>
                              <textarea
                                value={block.code || ''}
                                onChange={(e) => handleUpdateBlock(idx, { code: e.target.value })}
                                rows={6}
                                className="editor-textarea-field !font-mono !text-xs"
                              />
                            </div>
                          ) : (
                            <div className="my-6">
                              <div className="position-relative">
                                <pre className="code-block-pre">
                                  <code>{block.code}</code>
                                </pre>
                              </div>
                              {block.explanation && (
                                <div className="code-explanation-box">
                                  {block.explanation}
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {block.type === 'example' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <input 
                                type="text"
                                value={block.scenario || ''}
                                onChange={(e) => handleUpdateBlock(idx, { scenario: e.target.value })}
                                className="editor-text-input"
                                placeholder="Scenario Name"
                              />
                              <textarea 
                                value={block.detail || ''}
                                onChange={(e) => handleUpdateBlock(idx, { detail: e.target.value })}
                                className="editor-textarea-field"
                                placeholder="Detail content..."
                                rows={3}
                              />
                            </div>
                          ) : (
                            <div className="example-block-container">
                              <h4 className="example-block-title">
                                <Lightbulb className="w-4 h-4" /> Real-World Example: {block.scenario}
                              </h4>
                              <p className="example-block-text">{block.detail}</p>
                            </div>
                          )
                        )}

                        {(block.type === 'quiz' || block.type === 'knowledge_check') && (
                          <InteractiveQuiz 
                            block={block} 
                            editMode={editMode} 
                            onUpdateBlock={(fields) => handleUpdateBlock(idx, fields)} 
                          />
                        )}

                        {block.type === 'assignment' && (
                          editMode ? (
                            <div className="space-y-3 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest block">Assignment Block</span>
                              <input 
                                type="text"
                                value={block.task || ''}
                                onChange={(e) => handleUpdateBlock(idx, { task: e.target.value })}
                                className="editor-text-input"
                                placeholder="Task Name"
                              />
                              <textarea 
                                value={block.instructions || ''}
                                onChange={(e) => handleUpdateBlock(idx, { instructions: e.target.value })}
                                className="editor-textarea-field"
                                placeholder="Instructions"
                                rows={2}
                              />
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Grading Criteria</span>
                                {(block.grading_criteria || []).map((crit, cIdx) => (
                                  <div key={cIdx} className="flex gap-2 items-center mb-1">
                                    <input 
                                      type="text"
                                      value={crit}
                                      onChange={(e) => {
                                        const newCrit = [...block.grading_criteria];
                                        newCrit[cIdx] = e.target.value;
                                        handleUpdateBlock(idx, { grading_criteria: newCrit });
                                      }}
                                      className="editor-text-input !p-1.5 !text-xs"
                                    />
                                    <button
                                      onClick={() => {
                                        const newCrit = [...block.grading_criteria];
                                        newCrit.splice(cIdx, 1);
                                        handleUpdateBlock(idx, { grading_criteria: newCrit });
                                      }}
                                      className="row-delete-button"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => handleUpdateBlock(idx, { grading_criteria: [...(block.grading_criteria || []), 'New Criterion'] })}
                                  className="add-point-button"
                                >
                                  <Plus className="w-2.5 h-2.5" /> Add Criterion
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="summary-block-container">
                              <h4 className="summary-block-title">
                                <CheckSquare className="w-4 h-4" /> Practical Assignment: {block.task}
                              </h4>
                              <p className="summary-list-item">{block.instructions}</p>
                              {block.grading_criteria && block.grading_criteria.length > 0 && (
                                <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                  <span className="summary-block-title mt-4 block">Grading Checklist</span>
                                  <ul className="space-y-1.5 list-none pl-0">
                                    {block.grading_criteria.map((item, cIdx) => (
                                      <li key={cIdx} className="summary-list-item flex items-start gap-2 text-xs font-medium">
                                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {block.type === 'summary' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest block">Summary Takeaways</span>
                              {(block.points || []).map((point, ptIdx) => (
                                <div key={ptIdx} className="flex gap-2 items-center">
                                  <input 
                                    type="text"
                                    value={point}
                                    onChange={(e) => {
                                      const newPoints = [...block.points];
                                      newPoints[ptIdx] = e.target.value;
                                      handleUpdateBlock(idx, { points: newPoints });
                                    }}
                                    className="editor-text-input !p-1.5 !text-xs"
                                  />
                                  <button
                                    onClick={() => {
                                      const newPts = [...block.points];
                                      newPts.splice(ptIdx, 1);
                                      handleUpdateBlock(idx, { points: newPts });
                                    }}
                                    className="row-delete-button"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => handleUpdateBlock(idx, { points: [...(block.points || []), 'New Summary Point'] })}
                                className="add-point-button"
                              >
                                <Plus className="w-2.5 h-2.5" /> Add Point
                              </button>
                            </div>
                          ) : (
                            <div className="summary-block-container">
                              <h4 className="summary-block-title">
                                <BookOpen className="w-4 h-4" /> Lesson Summary
                              </h4>
                              <ul className="space-y-2 pl-4 list-disc text-sm font-medium">
                                {(block.points || []).map((pt, ptIdx) => (
                                  <li key={ptIdx} className="summary-list-item">{pt}</li>
                                ))}
                              </ul>
                            </div>
                          )
                        )}

                        {block.type === 'reference' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Reference Link</span>
                              <input 
                                type="text"
                                placeholder="Title"
                                value={block.title || ''}
                                onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                className="editor-text-input"
                              />
                              <input 
                                type="text"
                                placeholder="URL"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="editor-text-input"
                              />
                            </div>
                          ) : (
                            <div className="reference-block-container">
                              <div>
                                <h4 className="text-sm font-bold flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4" /> {block.title}
                                </h4>
                              </div>
                              <a 
                                href={block.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="visit-resource-button"
                              >
                                Visit Resource ↗
                              </a>
                            </div>
                          )
                        )}

                        {/* ─── ATTACHMENT BLOCK ─── */}
                        {block.type === 'attachment' && (
                          editMode ? (
                            <div className="space-y-3 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5" /> File Attachment Block
                              </span>
                              <input 
                                type="text"
                                placeholder="Display Title (auto-filled on upload)"
                                value={block.title || ''}
                                onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                className="editor-text-input"
                              />
                              {block.file_url ? (
                                <div className="flex items-center gap-3 p-3 bg-white border border-green-200 rounded-xl">
                                  <Paperclip className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  <span className="text-xs font-bold text-green-700 truncate flex-1">{block.file_name || block.file_url}</span>
                                  <button
                                    onClick={() => handleUpdateBlock(idx, { file_url: '', file_name: '' })}
                                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                                    title="Remove file"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex border-b border-slate-150 text-xs">
                                    <button
                                      type="button"
                                      className={`px-3 py-1.5 font-bold transition-all border-b-2 ${(!attachmentTabs[idx] || attachmentTabs[idx] === 'upload') ? 'border-sky-500 text-sky-650' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                      onClick={() => setAttachmentTabs(prev => ({ ...prev, [idx]: 'upload' }))}
                                    >
                                      Upload New
                                    </button>
                                    <button
                                      type="button"
                                      className={`px-3 py-1.5 font-bold transition-all border-b-2 ${(attachmentTabs[idx] === 'internal') ? 'border-sky-500 text-sky-650' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                                      onClick={() => {
                                        setAttachmentTabs(prev => ({ ...prev, [idx]: 'internal' }));
                                        fetchMedia();
                                      }}
                                    >
                                      Internal Attachment
                                    </button>
                                  </div>

                                  {(!attachmentTabs[idx] || attachmentTabs[idx] === 'upload') ? (
                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50/30 transition">
                                      {uploadingBlockIdx === idx ? (
                                        <div className="flex items-center gap-2 text-sky-600">
                                          <Loader2 className="w-5 h-5 animate-spin" />
                                          <span className="text-xs font-bold">Uploading...</span>
                                        </div>
                                      ) : (
                                        <>
                                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                                          <span className="text-xs font-bold text-slate-500">Click to upload file</span>
                                          <span className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, XLSX, PPT, etc.</span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                        onChange={(e) => handleAttachmentUpload(idx, e.target.files[0])}
                                        disabled={uploadingBlockIdx === idx}
                                      />
                                    </label>
                                  ) : (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        placeholder="Search files..."
                                        value={mediaSearch}
                                        onChange={(e) => setMediaSearch(e.target.value)}
                                        className="editor-text-input"
                                      />
                                      {loadingMedia ? (
                                        <div className="flex items-center justify-center p-4 text-xs text-sky-600 gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" /> Loading files...
                                        </div>
                                      ) : (
                                        <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl bg-white divide-y divide-slate-100">
                                          {mediaFiles.filter(f => f.filename.toLowerCase().includes(mediaSearch.toLowerCase())).length === 0 ? (
                                            <div className="p-3 text-xs text-slate-400 text-center">No files found.</div>
                                          ) : (
                                            mediaFiles
                                              .filter(f => f.filename.toLowerCase().includes(mediaSearch.toLowerCase()))
                                              .map((file, fIdx) => (
                                                <button
                                                  key={fIdx}
                                                  type="button"
                                                  className="w-full text-left p-2 hover:bg-slate-50/50 transition-colors text-xs flex justify-between items-center"
                                                  onClick={() => {
                                                    handleUpdateBlock(idx, {
                                                      file_url: file.url,
                                                      file_name: file.filename,
                                                      title: file.filename
                                                    });
                                                  }}
                                                >
                                                  <span className="font-semibold text-slate-700 truncate max-w-[200px]">{file.filename}</span>
                                                  <span className="text-[10px] text-slate-400 flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                                                </button>
                                              ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            block.file_url ? (
                              <div className="attachment-block-container">
                                <div className="flex items-center gap-3">
                                  <div className="attachment-icon-badge">
                                    <Paperclip className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold animate-fade-in">{block.title || block.file_name || 'Attached File'}</h4>
                                    <p className="text-[10px] font-medium">{block.file_name || 'File Attachment'}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const url = block.file_url.startsWith('/uploads/') ? `http://localhost:8000${block.file_url}` : block.file_url;
                                    setSecureViewerUrl(url);
                                  }}
                                  className="secure-open-button"
                                >
                                  Open Securely
                                </button>
                              </div>
                            ) : (
                              <div className="attachment-empty-placeholder">
                                <p>No file attached yet. Click Edit to upload.</p>
                              </div>
                            )
                          )
                        )}

                      </div>

                      {/* Add Hover-Add UI bar below the block when in edit mode */}
                      {editMode && (
                        <div className="relative h-6 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity my-1 z-10">
                          <div className="absolute inset-x-0 h-0.5 bg-sky-200/50"></div>
                          <button
                            onClick={() => setActiveInsertMenuIdx(activeInsertMenuIdx === idx ? null : idx)}
                            className="bg-sky-600 hover:bg-sky-700 text-white rounded-full p-1 shadow-md hover:scale-110 active:scale-95 transition-all z-20 flex items-center gap-1 text-[10px] font-bold px-2.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Block
                          </button>
                          
                          {activeInsertMenuIdx === idx && (
                            <div className="absolute top-7 bg-white border border-slate-150 shadow-xl rounded-2xl p-3 grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-lg z-30 animate-scale-in">
                              {Object.entries(BLOCK_INFO).map(([bType, info]) => {
                                const IconComp = info.icon;
                                return (
                                  <button
                                    key={bType}
                                    onClick={() => handleInsertBlock(idx, bType)}
                                    className="flex flex-col items-center p-2 rounded-xl border border-slate-100 hover:border-sky-500 hover:bg-sky-50/30 transition-all text-center"
                                  >
                                    <div className={`w-8 h-8 rounded-lg ${info.bg} ${info.color} flex items-center justify-center mb-1`}>
                                      <IconComp className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-600">{info.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}

              </div>
            ) : (
              // Fallback to legacy HTML rendering/editing OR empty state
              <div>
                {editMode ? (
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setHtmlDraft(e.target.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: htmlDraft }}
                    className="w-full min-h-[450px] p-6 border border-slate-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-sky-600 overflow-y-auto prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg"
                    placeholder="Write or edit lesson content in HTML..."
                  />
                ) : htmlDraft ? (
                  <div ref={containerRef} className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg">
                    <div dangerouslySetInnerHTML={{ __html: formatRichText(htmlDraft) }} className="animate-fade-in" />
                  </div>
                ) : (
                  // ── Empty state after deletion or before generation ──
                  <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-slate-300" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Content Yet</p>
                      <p className="text-xs text-slate-300 font-medium max-w-xs leading-relaxed">
                        This lesson doesn't have any content. Close this preview and use the <span className="text-sky-500 font-bold">Generate Content</span> button to add content.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-xl active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
