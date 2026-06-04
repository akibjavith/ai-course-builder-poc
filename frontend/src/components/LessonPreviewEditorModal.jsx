import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Edit3, Save, Trash2, X, Plus, Trash, 
  HelpCircle, FileCode, AlertTriangle, AlertCircle, FileText, Info, 
  BookOpen, ExternalLink, Lightbulb, CheckSquare, ListOrdered, List, Check
} from 'lucide-react';

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
  reference: { label: 'Reference', icon: ExternalLink, color: 'text-blue-500', bg: 'bg-blue-50' }
};

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
          navigator.clipboard.writeText(textToCopy).then(() => {
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
          });
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
      <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
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
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Options (One per line)</label>
            <textarea
              value={(block.options || []).join('\n')}
              onChange={(e) => onUpdateBlock({ options: e.target.value.split('\n') })}
              rows={4}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-purple-200 outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Correct Answer</label>
              <select
                value={block.correctAnswer || ''}
                onChange={(e) => onUpdateBlock({ correctAnswer: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-purple-200 outline-none"
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
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCorrect = selected === block.correctAnswer;

  return (
    <div className="bg-purple-50/20 border border-purple-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm my-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-purple-500" />
        <span className="text-xs font-black text-purple-600 uppercase tracking-widest">Knowledge Challenge</span>
      </div>
      <h3 className="text-lg font-bold text-slate-900 leading-snug">{block.question}</h3>
      <div className="grid grid-cols-1 gap-3">
        {(block.options || []).map((opt, idx) => {
          let btnClass = "border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30 text-slate-700";
          if (submitted) {
            if (opt === block.correctAnswer) {
              btnClass = "border-green-500 bg-green-50 text-green-700 font-bold ring-2 ring-green-100";
            } else if (selected === opt) {
              btnClass = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100";
            } else {
              btnClass = "border-slate-100 bg-slate-50/50 text-slate-400 opacity-60";
            }
          } else if (selected === opt) {
            btnClass = "border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-100 font-bold";
          }
          return (
            <button
              key={idx}
              disabled={submitted}
              onClick={() => setSelected(opt)}
              className={`p-4 rounded-2xl text-left text-sm font-medium transition-all duration-200 flex items-center justify-between active:scale-[0.99] ${btnClass}`}
            >
              <span>{opt}</span>
              {submitted && opt === block.correctAnswer && <Check className="w-4 h-4 text-green-600" />}
            </button>
          );
        })}
      </div>
      {!submitted && selected && (
        <button
          onClick={() => setSubmitted(true)}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition shadow-md active:scale-95"
        >
          Submit Answer
        </button>
      )}
      {submitted && (
        <div className={`p-4 rounded-2xl border transition-all ${isCorrect ? 'bg-green-50/30 border-green-100 text-green-800' : 'bg-red-50/30 border-red-100 text-red-800'}`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            {isCorrect ? '✨ Correct!' : '❌ Incorrect'}
          </p>
          <p className="text-sm font-medium leading-relaxed">{block.explanation}</p>
        </div>
      )}
    </div>
  );
}

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

  // Simple active insertion menu index
  const [activeInsertMenuIdx, setActiveInsertMenuIdx] = useState(null);

  useCopyCode(containerRef, blocksDraft || htmlDraft);

  useEffect(() => {
    const nextPreview = buildPreviewContent(getChapter(courseData?.structure, active.mIdx, active.cIdx));
    setBlocksDraft(nextPreview?.lessonBlocks || null);
    setHtmlDraft(nextPreview?.html_content || '');
    setEditMode(!readOnly && !!startInEdit);
    setActiveInsertMenuIdx(null);
  }, [active.mIdx, active.cIdx]);

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

    const updated = [...blocksDraft];
    updated.splice(idx + 1, 0, newBlock);
    setBlocksDraft(updated);
    setActiveInsertMenuIdx(null);
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

  const deleteLesson = () => {
    if (readOnly) return;
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      const newChapters = [...(mod.chapters || [])];
      newChapters.splice(active.cIdx, 1);
      return { ...mod, chapters: newChapters };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
    const nextLessons = flattenLessons({ ...courseData.structure, modules: newModules });
    if (nextLessons.length === 0) {
      onClose?.();
      return;
    }
    const nextIdx = Math.min(activeLessonIndex, nextLessons.length - 1);
    const next = nextLessons[nextIdx];
    setActive({ mIdx: next.mIdx, cIdx: next.cIdx });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-scale-in">
        
        {/* Header toolbar */}
        <div className="p-6 sm:px-10 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-sky-50 text-sky-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-sky-100">
                {editMode ? 'Edit Lesson' : 'Live Preview'}
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate max-w-md">
                {chapter?.title || 'Lesson'}
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {blocksDraft ? 'Block-based Interactive Lesson Outline' : 'HTML-based legacy content'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2 border-r border-slate-100 pr-3">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                disabled={!hasNext}
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {!readOnly && !editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="p-3 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-2xl transition-all active:scale-95"
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
                className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all active:scale-95"
                title="Delete lesson"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Viewer / Editor Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/30">
          <div className="max-w-4xl mx-auto px-6 py-12 sm:px-12 space-y-8 bg-white shadow-sm my-10 rounded-[2.5rem] border border-slate-100">
            {blocksDraft ? (
              <div ref={containerRef} className="space-y-6">
                
                {blocksDraft.map((block, idx) => {
                  const isLastBlock = idx === blocksDraft.length - 1;
                  
                  return (
                    <div key={block.id || idx} className="group/block relative">
                      
                      {/* Top indicator & delete button inside edit mode */}
                      {editMode && (
                        <div className="absolute -top-3 left-4 bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider opacity-0 group-hover/block:opacity-100 transition-opacity z-10 flex items-center gap-2 shadow-sm border border-slate-200">
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
                      <div className={`p-1 rounded-xl transition-all duration-200 ${editMode ? 'border border-dashed border-slate-200 hover:border-sky-300 hover:shadow-sm p-4' : ''}`}>
                        {block.type === 'heading' && (
                          editMode ? (
                            <div className="flex gap-2 items-center">
                              <select 
                                value={block.level || 2}
                                onChange={(e) => handleUpdateBlock(idx, { level: parseInt(e.target.value) })}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                              >
                                <option value={1}>H1</option>
                                <option value={2}>H2</option>
                                <option value={3}>H3</option>
                              </select>
                              <input 
                                type="text"
                                value={block.text || ''}
                                onChange={(e) => handleUpdateBlock(idx, { text: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-semibold text-slate-800"
                              />
                            </div>
                          ) : (
                            block.level === 1 ? (
                              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4 border-b border-slate-100 pb-2">{block.text}</h1>
                            ) : block.level === 3 ? (
                              <h3 className="text-lg font-bold text-slate-800 mb-2">{block.text}</h3>
                            ) : (
                              <h2 className="text-xl font-bold text-sky-600 mb-3 border-l-4 border-sky-500 pl-3">{block.text}</h2>
                            )
                          )
                        )}

                        {block.type === 'paragraph' && (
                          editMode ? (
                            <textarea
                              value={block.text || ''}
                              onChange={(e) => handleUpdateBlock(idx, { text: e.target.value })}
                              rows={5}
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-sky-100 outline-none leading-relaxed"
                              placeholder="Detailed paragraph content (150-250 words suggested)..."
                            />
                          ) : (
                            <p 
                              className="text-slate-700 leading-relaxed text-base mb-4"
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
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700"
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
                              <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-4">
                                {(block.items || []).map((item, itemIdx) => (
                                  <li key={itemIdx} dangerouslySetInnerHTML={{ __html: formatRichText(item) }} />
                                ))}
                              </ul>
                            ) : (
                              <ol className="list-decimal pl-6 space-y-2 text-slate-700 mb-4">
                                {(block.items || []).map((item, itemIdx) => (
                                  <li key={itemIdx} dangerouslySetInnerHTML={{ __html: formatRichText(item) }} />
                                ))}
                              </ol>
                            )
                          )
                        )}

                        {block.type === 'image' && (
                          editMode ? (
                            <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Block</label>
                              <input 
                                type="text"
                                placeholder="Image URL (can be empty)"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                              <input 
                                type="text"
                                placeholder="Caption / Prompt Description"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="my-6 text-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                              {block.url ? (
                                <img src={block.url} alt={block.caption || ''} className="max-w-full max-h-[400px] object-contain rounded-xl mx-auto shadow-sm" />
                              ) : (
                                <div className="h-40 bg-slate-100 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                  [Visual Placeholder: {block.caption}]
                                </div>
                              )}
                              {block.caption && <p className="text-xs text-slate-500 italic mt-2">{block.caption}</p>}
                            </div>
                          )
                        )}

                        {block.type === 'video' && (
                          editMode ? (
                            <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Video Block</label>
                              <input 
                                type="text"
                                placeholder="Video URL"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                              <input 
                                type="text"
                                placeholder="Caption"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="my-6 text-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                              {block.url ? (
                                <video src={block.url} controls className="max-w-full rounded-xl mx-auto" />
                              ) : (
                                <div className="h-40 bg-slate-100 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                                  [Video Segment: {block.caption}]
                                </div>
                              )}
                              {block.caption && <p className="text-xs text-slate-500 italic mt-2">{block.caption}</p>}
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
                                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold w-full"
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
                                      className="bg-white border border-slate-200 rounded-lg p-2 text-xs w-full"
                                    />
                                  ))}
                                  <button
                                    onClick={() => {
                                      const newRows = [...block.rows];
                                      newRows.splice(rIdx, 1);
                                      handleUpdateBlock(idx, { rows: newRows });
                                    }}
                                    className="text-red-400 hover:text-red-600"
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
                            <div className="overflow-x-auto my-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
                              <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50/50">
                                  <tr>
                                    {(block.headers || []).map((header, hIdx) => (
                                      <th key={hIdx} scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                  {(block.rows || []).map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="px-6 py-4 text-sm text-slate-700 font-medium">
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
                            <div className="space-y-3 p-3 bg-yellow-50/30 border border-yellow-100 rounded-xl">
                              <div className="flex gap-2 items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Callout Type</label>
                                <select 
                                  value={block.callout_type || 'info'}
                                  onChange={(e) => handleUpdateBlock(idx, { callout_type: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-lg p-1 text-xs"
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
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none"
                              />
                            </div>
                          ) : (
                            (() => {
                              let styles = 'bg-sky-50 border-sky-400 text-sky-800';
                              let CalloutIcon = Info;
                              if (block.callout_type === 'warning') { styles = 'bg-amber-50/50 border-amber-400 text-amber-800'; CalloutIcon = AlertTriangle; }
                              else if (block.callout_type === 'tip') { styles = 'bg-emerald-50/50 border-emerald-400 text-emerald-800'; CalloutIcon = Lightbulb; }
                              else if (block.callout_type === 'danger') { styles = 'bg-rose-50/50 border-rose-400 text-rose-800'; CalloutIcon = AlertCircle; }
                              return (
                                <div className={`border-l-6 p-5 rounded-2xl flex gap-3 my-4 ${styles}`}>
                                  <CalloutIcon className="w-5 h-5 flex-shrink-0" />
                                  <div className="text-sm font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: formatRichText(block.text) }} />
                                </div>
                              );
                            })()
                          )
                        )}

                        {block.type === 'code' && (
                          editMode ? (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="Language"
                                  value={block.language || 'javascript'}
                                  onChange={(e) => handleUpdateBlock(idx, { language: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-lg p-2 text-xs w-1/4"
                                />
                                <input 
                                  type="text"
                                  placeholder="Explanation"
                                  value={block.explanation || ''}
                                  onChange={(e) => handleUpdateBlock(idx, { explanation: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-lg p-2 text-xs w-3/4"
                                />
                              </div>
                              <textarea
                                value={block.code || ''}
                                onChange={(e) => handleUpdateBlock(idx, { code: e.target.value })}
                                rows={6}
                                className="w-full bg-slate-900 text-sky-400 font-mono p-4 rounded-lg text-xs leading-relaxed focus:ring-0 outline-none"
                              />
                            </div>
                          ) : (
                            <div className="my-6">
                              <div className="position-relative">
                                <pre className="bg-slate-900 text-sky-400 p-6 pt-12 rounded-2xl overflow-x-auto font-mono text-sm leading-relaxed">
                                  <code>{block.code}</code>
                                </pre>
                              </div>
                              {block.explanation && (
                                <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-650 leading-relaxed font-medium">
                                  {block.explanation}
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {block.type === 'example' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-emerald-50/30 border border-emerald-100 rounded-xl">
                              <input 
                                type="text"
                                value={block.scenario || ''}
                                onChange={(e) => handleUpdateBlock(idx, { scenario: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                                placeholder="Scenario Name"
                              />
                              <textarea 
                                value={block.detail || ''}
                                onChange={(e) => handleUpdateBlock(idx, { detail: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs leading-relaxed"
                                placeholder="Detail content..."
                                rows={3}
                              />
                            </div>
                          ) : (
                            <div className="bg-emerald-50/20 border-l-6 border-emerald-500 p-6 rounded-2xl my-6">
                              <h4 className="text-emerald-700 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Lightbulb className="w-4 h-4" /> Real-World Example: {block.scenario}
                              </h4>
                              <p className="text-slate-700 text-sm leading-relaxed font-medium">{block.detail}</p>
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
                            <div className="space-y-3 p-4 bg-violet-50/30 border border-violet-100 rounded-xl">
                              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest block">Assignment Block</span>
                              <input 
                                type="text"
                                value={block.task || ''}
                                onChange={(e) => handleUpdateBlock(idx, { task: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                                placeholder="Task Name"
                              />
                              <textarea 
                                value={block.instructions || ''}
                                onChange={(e) => handleUpdateBlock(idx, { instructions: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
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
                                      className="bg-white border border-slate-200 rounded-lg p-1 text-xs w-full"
                                    />
                                    <button
                                      onClick={() => {
                                        const newCrit = [...block.grading_criteria];
                                        newCrit.splice(cIdx, 1);
                                        handleUpdateBlock(idx, { grading_criteria: newCrit });
                                      }}
                                      className="text-red-400 hover:text-red-600"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => handleUpdateBlock(idx, { grading_criteria: [...(block.grading_criteria || []), 'New Criterion'] })}
                                  className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100 flex items-center gap-1 active:scale-95"
                                >
                                  <Plus className="w-2.5 h-2.5" /> Add Criterion
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-violet-50/20 border border-violet-100 rounded-3xl p-6 sm:p-8 space-y-4 my-6">
                              <h4 className="text-violet-700 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                                <CheckSquare className="w-4 h-4" /> Practical Assignment: {block.task}
                              </h4>
                              <p className="text-slate-700 text-sm leading-relaxed font-medium">{block.instructions}</p>
                              {block.grading_criteria && block.grading_criteria.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-violet-100">
                                  <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block">Grading Checklist</span>
                                  <ul className="space-y-1.5 list-none pl-0">
                                    {block.grading_criteria.map((item, cIdx) => (
                                      <li key={cIdx} className="flex items-start gap-2 text-xs text-slate-650 font-medium">
                                        <Check className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
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
                            <div className="space-y-2 p-3 bg-sky-50 rounded-xl">
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
                                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs w-full"
                                  />
                                  <button
                                    onClick={() => {
                                      const newPts = [...block.points];
                                      newPts.splice(ptIdx, 1);
                                      handleUpdateBlock(idx, { points: newPts });
                                    }}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => handleUpdateBlock(idx, { points: [...(block.points || []), 'New Summary Point'] })}
                                className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 flex items-center gap-1 active:scale-95"
                              >
                                <Plus className="w-2.5 h-2.5" /> Add Point
                              </button>
                            </div>
                          ) : (
                            <div className="bg-sky-50/20 border border-sky-100 rounded-3xl p-6 sm:p-8 space-y-4 my-6">
                              <h4 className="text-sky-700 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4" /> Lesson Summary
                              </h4>
                              <ul className="space-y-2 pl-4 list-disc text-slate-700 text-sm font-medium">
                                {(block.points || []).map((pt, ptIdx) => (
                                  <li key={ptIdx}>{pt}</li>
                                ))}
                              </ul>
                            </div>
                          )
                        )}

                        {block.type === 'reference' && (
                          editMode ? (
                            <div className="space-y-2 p-3 bg-blue-50/30 border border-blue-100 rounded-xl">
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Reference Link</span>
                              <input 
                                type="text"
                                placeholder="Title"
                                value={block.title || ''}
                                onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                              <input 
                                type="text"
                                placeholder="URL"
                                value={block.url || ''}
                                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-150 transition-all gap-2 my-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4 text-sky-500" /> {block.title}
                                </h4>
                              </div>
                              <a 
                                href={block.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95 whitespace-nowrap"
                              >
                                Visit Resource ↗
                              </a>
                            </div>
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
              // Fallback to legacy HTML rendering/editing
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
                  <div className="text-slate-500 text-sm">
                    No HTML content yet for this lesson. Click edit to add content.
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
