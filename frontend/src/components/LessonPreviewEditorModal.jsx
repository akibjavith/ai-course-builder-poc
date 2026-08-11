import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, ChevronDown, Edit3, Save, Trash2, X, Plus, Trash, 
  HelpCircle, FileCode, AlertTriangle, AlertCircle, FileText, Info, 
  BookOpen, ExternalLink, Lightbulb, CheckSquare, ListOrdered, List, Check,
  Paperclip, Upload, Loader2, Palette, Paintbrush, Layers, Sparkles, Globe, Volume2, Music, MessageSquare
} from 'lucide-react';
import { uploadChapterMedia, uploadCourseImage, downloadExternalImage, uploadCourseAudio, downloadExternalAudio, generateAIImage, generateAIAudio, listMediaFiles, getThemes, uploadTheme, resolveMediaUrl, API_URL } from '../api';
import SecureDocViewer from './SecureDocViewer';
import ActionModal from './ActionModal';
import DynamicStyle from './DynamicStyle';

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
  audio: { label: 'Audio Block', icon: Volume2, color: 'text-purple-500', bg: 'bg-purple-50' },
  table: { label: 'Table', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  callout: { label: 'Callout', icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  code: { label: 'Code Block', icon: FileCode, color: 'text-slate-500', bg: 'bg-slate-50' },
  example: { label: 'Example', icon: Lightbulb, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  quiz: { label: 'Quiz', icon: HelpCircle, color: 'text-purple-500', bg: 'bg-purple-50' },
  assignment: { label: 'Assignment', icon: CheckSquare, color: 'text-violet-500', bg: 'bg-violet-50' },
  flashcard: { label: 'Flashcards', icon: Layers, color: 'text-amber-500', bg: 'bg-amber-50' },
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
      if (!containerRef.current) return;
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
// Interactive Quiz block renderer with Landing Card, Taking Mode, and Results
function InteractiveQuiz({ block, editMode, onUpdateBlock }) {
  // Extract normalized question list from block.questions or legacy single question
  const questions = useMemo(() => {
    if (block.questions && Array.isArray(block.questions) && block.questions.length > 0) {
      return block.questions;
    }
    if (block.question || block.options) {
      return [{
        question: block.question || 'Assess your understanding:',
        options: block.options || [],
        correctAnswer: block.correctAnswer || '',
        explanation: block.explanation || '',
        question_type: 'SINGLE CHOICE'
      }];
    }
    return [{
      question: 'Sample Question',
      options: ['Option A', 'Option B'],
      correctAnswer: 'Option A',
      explanation: 'Sample explanation text.',
      question_type: 'SINGLE CHOICE'
    }];
  }, [block.questions, block.question, block.options, block.correctAnswer, block.explanation]);

  const [quizMode, setQuizMode] = useState('landing'); // 'landing' | 'taking' | 'results'
  const [userAnswers, setUserAnswers] = useState({}); // { [qIdx]: option }
  const [showExplanations, setShowExplanations] = useState({}); // { [qIdx]: boolean }
  const [lastResults, setLastResults] = useState(null); // { score, totalPoints, percentage, userAnswers }

  // Reset quiz mode if block ID changes
  useEffect(() => {
    setQuizMode('landing');
    setUserAnswers({});
    setShowExplanations({});
    setLastResults(null);
  }, [block.id]);

  const title = block.title || 'Knowledge Check & Assessment';
  const objective = block.objective || 'Work through mixed question types in one quiz set. Each question scores independently.';
  const totalQuestions = questions.length;
  const totalPoints = totalQuestions * 10;
  const estimatedTime = block.estimated_time || `~${Math.max(1, totalQuestions * 2)} min`;

  // Start/Retake Quiz action
  const handleStartQuiz = () => {
    setUserAnswers({});
    setShowExplanations({});
    setQuizMode('taking');
  };

  // Option select handler - locks question choice once selected
  const handleSelectOption = (qIdx, opt) => {
    if (userAnswers[qIdx] !== undefined) return; // locked once selected
    setUserAnswers(prev => ({ ...prev, [qIdx]: opt }));
  };

  // Toggle answer description explanation
  const toggleExplanation = (qIdx) => {
    setShowExplanations(prev => ({ ...prev, [qIdx]: !prev[qIdx] }));
  };

  // Submit/Finish quiz
  const handleFinishQuiz = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        score += 10;
      }
    });
    const percentage = Math.round((score / (totalQuestions * 10)) * 100);
    const results = {
      score,
      totalPoints,
      percentage,
      userAnswers: { ...userAnswers }
    };
    setLastResults(results);
    setQuizMode('results');
  };

  // Edit Mode Renderer
  if (editMode) {
    const handleQuestionChange = (qIdx, field, val) => {
      const updatedQ = [...questions];
      updatedQ[qIdx] = { ...updatedQ[qIdx], [field]: val };
      onUpdateBlock({
        questions: updatedQ,
        question: updatedQ[0].question,
        options: updatedQ[0].options,
        correctAnswer: updatedQ[0].correctAnswer,
        explanation: updatedQ[0].explanation
      });
    };

    const handleAddQuestion = () => {
      const updatedQ = [
        ...questions,
        {
          question: `Question ${questions.length + 1}?`,
          options: ['Option A', 'Option B'],
          correctAnswer: 'Option A',
          explanation: 'Explanation text',
          question_type: 'SINGLE CHOICE'
        }
      ];
      onUpdateBlock({
        questions: updatedQ,
        question: updatedQ[0].question,
        options: updatedQ[0].options,
        correctAnswer: updatedQ[0].correctAnswer,
        explanation: updatedQ[0].explanation
      });
    };

    const handleDeleteQuestion = (qIdx) => {
      if (questions.length <= 1) return;
      const updatedQ = questions.filter((_, idx) => idx !== qIdx);
      onUpdateBlock({
        questions: updatedQ,
        question: updatedQ[0].question,
        options: updatedQ[0].options,
        correctAnswer: updatedQ[0].correctAnswer,
        explanation: updatedQ[0].explanation
      });
    };

    return (
      <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-500" />
            <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">Quiz Block Editor</span>
          </div>
          <button
            onClick={handleAddQuestion}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Question
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quiz Title</label>
            <input
              type="text"
              value={block.title || ''}
              onChange={(e) => onUpdateBlock({ title: e.target.value })}
              className="editor-text-input"
              placeholder="e.g. Cloud Concepts Quiz"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Time</label>
            <input
              type="text"
              value={block.estimated_time || ''}
              onChange={(e) => onUpdateBlock({ estimated_time: e.target.value })}
              className="editor-text-input"
              placeholder="e.g. ~5 min"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Objective / Description</label>
          <textarea
            value={block.objective || ''}
            onChange={(e) => onUpdateBlock({ objective: e.target.value })}
            rows={2}
            className="editor-textarea-field resize-none !text-xs"
            placeholder="Work through mixed questions in one quiz set..."
          />
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 relative shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-sky-600 uppercase">Question {qIdx + 1}</span>
                {questions.length > 1 && (
                  <button
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Question Text</label>
                <input
                  type="text"
                  value={q.question || ''}
                  onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                  className="editor-text-input"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Options (One per line)</label>
                <textarea
                  value={(q.options || []).join('\n')}
                  onChange={(e) => handleQuestionChange(qIdx, 'options', e.target.value.split('\n'))}
                  rows={3}
                  className="editor-textarea-field resize-none !text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Correct Answer</label>
                  <select
                    value={q.correctAnswer || ''}
                    onChange={(e) => handleQuestionChange(qIdx, 'correctAnswer', e.target.value)}
                    className="editor-select-field !text-xs"
                  >
                    <option value="">Select Correct Option</option>
                    {(q.options || []).map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Explanation</label>
                  <input
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                    className="editor-text-input"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // State 1: Summary Landing Card View (Image 1 reference)
  if (quizMode === 'landing') {
    return (
      <div className="my-6 p-6 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-5 shadow-sm">
        {/* Header Badge & Title */}
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 bg-sky-500/10 text-sky-600 border border-sky-500/20 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
            QUIZ
          </span>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
        </div>

        {/* Objective Box */}
        <div className="p-3.5 bg-sky-50/50 border border-sky-100/80 rounded-xl text-xs text-sky-900 leading-relaxed font-medium">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 block mb-0.5">OBJECTIVE</span>
          {objective}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL QUESTIONS</span>
            <span className="text-lg font-black text-slate-800">{totalQuestions}</span>
          </div>
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL POINTS</span>
            <span className="text-lg font-black text-slate-800">{totalPoints} pts</span>
          </div>
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-0.5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ESTIMATED TIME</span>
            <span className="text-lg font-black text-slate-800">{estimatedTime}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleStartQuiz}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-600/20 flex items-center gap-1.5"
          >
            {lastResults ? 'Retake quiz' : 'Start quiz'}
          </button>
          {lastResults && (
            <button
              onClick={() => setQuizMode('results')}
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-sm"
            >
              View last results
            </button>
          )}
        </div>
      </div>
    );
  }

  // State 2: Active Taking Mode (Image 2 reference)
  if (quizMode === 'taking') {
    const answeredCount = Object.keys(userAnswers).length;

    return (
      <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-md overflow-y-auto flex justify-center p-4 sm:p-6">
      <div className="my-2 sm:my-6 p-6 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-6 shadow-md w-full max-w-3xl h-fit">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-sky-500/10 text-sky-600 text-[10px] font-extrabold uppercase rounded-md">
              QUIZ
            </span>
            <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          </div>
          <button
            onClick={() => setQuizMode('landing')}
            className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-sm"
          >
            Stop Quiz, Continue learning
          </button>
        </div>

        {/* Questions Container */}
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Progress Tracker */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                {answeredCount} OF {totalQuestions} ANSWERED
              </span>
              <span className="font-bold text-sky-600 font-mono">
                {answeredCount * 10} / {totalPoints} pts potential
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-600 transition-all duration-300 rounded-full"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* List of Questions */}
          {questions.map((q, qIdx) => {
            const selectedOpt = userAnswers[qIdx];
            const isAnswered = selectedOpt !== undefined;
            const isCorrect = selectedOpt === q.correctAnswer;

            return (
              <div key={qIdx} className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400">Q{qIdx + 1}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded">
                      {q.question_type || 'SINGLE CHOICE'}
                    </span>
                  </div>
                  {isAnswered && (
                    <span className={`text-[10px] font-extrabold uppercase ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-slate-800 leading-snug">{q.question}</h4>

                {/* Options List */}
                <div className="space-y-2.5">
                  {(q.options || []).map((opt, optIdx) => {
                    const isOptionSelected = selectedOpt === opt;
                    let btnStyle = "w-full text-left p-3.5 rounded-xl border text-xs font-medium transition flex justify-between items-center ";
                    if (isOptionSelected) {
                      btnStyle += isCorrect
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold"
                        : "bg-rose-50/80 border-rose-300 text-rose-900 font-bold";
                    } else if (isAnswered) {
                      btnStyle += "bg-slate-50/50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60";
                    } else {
                      btnStyle += "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(qIdx, opt)}
                        className={btnStyle}
                      >
                        <span>{opt}</span>
                        {isOptionSelected && isCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Toggle */}
                {q.explanation && (
                  <div className="pt-2">
                    <button
                      onClick={() => toggleExplanation(qIdx)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[11px] font-semibold transition"
                    >
                      {showExplanations[qIdx] ? 'Hide answer description' : 'Show answer description'}
                    </button>
                    {showExplanations[qIdx] && (
                      <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed italic">
                        <span className="font-bold not-italic block mb-0.5 text-slate-800 text-[10px] uppercase">Explanation:</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Finish Quiz Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleFinishQuiz}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-600/20"
            >
              Submit Quiz & View Results
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  // State 3 & 4: Final Score Results View
  const score = lastResults?.score || 0;
  const percentage = lastResults?.percentage || 0;
  const isPassed = percentage >= 70;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-md overflow-y-auto flex justify-center p-4 sm:p-6">
    <div className="my-2 sm:my-6 p-6 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-6 shadow-md w-full max-w-2xl h-fit">
      <div className="text-center space-y-2 border-b border-slate-200 pb-5">
        <span className="px-3 py-1 bg-sky-500/10 text-sky-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
          QUIZ COMPLETED
        </span>
        <h3 className="text-2xl font-black text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 font-medium">{objective}</p>
      </div>

      {/* Score Summary Box */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-sm">
        <div className="text-4xl font-black text-sky-600 font-mono">{percentage}%</div>
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Score: {score} / {totalPoints} pts
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
          isPassed ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
        }`}>
          {isPassed ? '🎉 Quiz Passed!' : '📖 Review Recommended'}
        </span>
      </div>

      {/* Detailed Question Review */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Review</h4>
        {questions.map((q, idx) => {
          const userAns = lastResults?.userAnswers?.[idx];
          const isCorrect = userAns === q.correctAnswer;

          return (
            <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-800">Q{idx + 1}. {q.question}</span>
                <span className={isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                  {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Your answer: <span className="font-semibold text-slate-700">{userAns || 'Not answered'}</span>
              </p>
              {!isCorrect && (
                <p className="text-emerald-600 text-[11px]">
                  Correct answer: <span className="font-semibold">{q.correctAnswer}</span>
                </p>
              )}
              {q.explanation && (
                <p className="text-slate-400 text-[10px] italic border-t border-slate-100 pt-1 mt-1">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setQuizMode('landing')}
          className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-sm"
        >
          Back to Lesson
        </button>
        <button
          onClick={handleStartQuiz}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-600/20"
        >
          Retake Quiz
        </button>
      </div>
    </div>
    </div>
  );
}

// Interactive 3D Stacked Flashcards block renderer
function InteractiveFlashcards({ block, editMode, onUpdateBlock }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const cards = useMemo(() => block.cards || [], [block.cards]);

  useEffect(() => {
    setCurrentIdx(0);
    setIsFlipped(false);
  }, [block.id]);

  const handleNext = () => {
    if (currentIdx < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setIsFlipped(false);
      setCurrentIdx(prev => prev - 1);
    }
  };

  const handleCardUpdate = (index, field, value) => {
    const updatedCards = [...cards];
    updatedCards[index] = { ...updatedCards[index], [field]: value };
    onUpdateBlock({ cards: updatedCards });
  };

  const handleAddCard = () => {
    const updatedCards = [...cards, { front: 'New Term / Question', back: 'New Definition / Answer' }];
    onUpdateBlock({ cards: updatedCards });
  };

  const handleDeleteCard = (index) => {
    if (cards.length <= 1) return;
    const updatedCards = cards.filter((_, i) => i !== index);
    onUpdateBlock({ cards: updatedCards });
    if (currentIdx >= updatedCards.length) {
      setCurrentIdx(Math.max(0, updatedCards.length - 1));
    }
  };

  if (editMode) {
    return (
      <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-500" />
            <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">Flashcards Editor</span>
          </div>
          <button
            onClick={handleAddCard}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Card
          </button>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Block Title</label>
          <input
            type="text"
            value={block.title || ''}
            onChange={(e) => onUpdateBlock({ title: e.target.value })}
            className="editor-text-input"
            placeholder="Flashcard Title"
          />
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {cards.map((card, idx) => (
            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative shadow-sm">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                <span>Card {idx + 1}</span>
                {cards.length > 1 && (
                  <button
                    onClick={() => handleDeleteCard(idx)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                    title="Delete Card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Front (Term / Question)</label>
                  <textarea
                    value={card.front || ''}
                    onChange={(e) => handleCardUpdate(idx, 'front', e.target.value)}
                    rows={2}
                    className="editor-textarea-field !p-2 !text-xs"
                    placeholder="Front content..."
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Back (Definition / Answer)</label>
                  <textarea
                    value={card.back || ''}
                    onChange={(e) => handleCardUpdate(idx, 'back', e.target.value)}
                    rows={2}
                    className="editor-textarea-field !p-2 !text-xs"
                    placeholder="Back content..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIdx] || { front: 'No content', back: 'No content' };

  return (
    <div className="my-6 space-y-4">
      {/* Header Badge + Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 bg-sky-500/10 text-sky-700 border border-sky-500/20 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
            FLASHCARDS
          </span>
          <h3 className="text-base font-bold text-slate-800">{block.title || 'Key Terminology & Flashcards'}</h3>
        </div>
        <span className="text-xs font-semibold text-slate-400 font-mono">
          {cards.length > 0 ? `${currentIdx + 1} of ${cards.length}` : '0 Cards'}
        </span>
      </div>

      {/* 3D Stacked Card Deck Container */}
      <div className="relative max-w-xl mx-auto h-64 [perspective:1000px]">
        {/* Layered stack visual effect */}
        <div className="absolute inset-x-3 bottom-0 top-3 bg-slate-100 border border-slate-200/80 rounded-2xl transform translate-y-2 scale-95 opacity-50 shadow-sm pointer-events-none" />
        <div className="absolute inset-x-1.5 bottom-0 top-1.5 bg-slate-50 border border-slate-200 rounded-2xl transform translate-y-1 scale-98 opacity-80 shadow-md pointer-events-none" />

        {/* Main Card Flipper */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`relative w-full h-full cursor-pointer rounded-2xl shadow-xl transition-transform duration-500 [transform-style:preserve-3d] ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* Card Front */}
          <div className="absolute inset-0 bg-white border border-slate-200 rounded-2xl p-8 flex flex-col justify-between items-center text-center [backface-visibility:hidden]">
            <div className="w-full flex justify-between items-center text-xs text-slate-400">
              <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Front
              </span>
              <span className="text-[11px] font-mono text-slate-400">Click to flip ↺</span>
            </div>
            <div className="my-auto space-y-2">
              <h4 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-snug">{currentCard.front}</h4>
              <p className="text-xs font-medium text-sky-600/80">Front · click to flip</p>
            </div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
              Card {currentIdx + 1} of {cards.length}
            </div>
          </div>

          {/* Card Back */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 text-white rounded-2xl p-8 flex flex-col justify-between items-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="w-full flex justify-between items-center text-xs text-slate-400">
              <span className="text-[10px] font-bold text-sky-400 bg-sky-950/80 border border-sky-800/50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Back
              </span>
              <span className="text-[11px] font-mono text-sky-400/80">Click to flip ↺</span>
            </div>
            <div className="my-auto space-y-2">
              <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed max-h-36 overflow-y-auto">
                {currentCard.back}
              </p>
              <p className="text-xs font-medium text-sky-400">Back · click to flip</p>
            </div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
              Card {currentIdx + 1} of {cards.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Controls */}
      <div className="flex items-center justify-between max-w-xl mx-auto pt-2">
        <button
          disabled={currentIdx === 0}
          onClick={handlePrev}
          className="px-5 py-2 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        <span className="text-xs font-bold text-slate-500 font-mono">
          {currentIdx + 1} / {cards.length}
        </span>
        <button
          disabled={currentIdx >= cards.length - 1}
          onClick={handleNext}
          className="px-5 py-2 rounded-full text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition shadow-md shadow-sky-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
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
  role = 'super-admin',
  onClose,
}) {
  const userRole = readOnly ? 'learner' : role;
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
  const [aiPromptModal, setAiPromptModal] = useState(null); // { idx, prompt }
  const [aiAudioModal, setAiAudioModal] = useState(null); // { idx, prompt, script, voice, mode, isPodcast }
  const [expandedTranscripts, setExpandedTranscripts] = useState({}); // { [blockIdx]: boolean }

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
  const [theme, setTheme] = useState(chapter?.content?.themeId || 'light');
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const themeFileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Sync theme when active chapter changes or loaded from DB
  useEffect(() => {
    if (chapter?.content?.themeId) {
      setTheme(chapter.content.themeId);
    } else {
      setTheme('light');
    }
  }, [active.mIdx, active.cIdx, chapter]);

  const handleSelectTheme = (newThemeId) => {
    setTheme(newThemeId);
    setDropdownOpen(false);
    if (readOnly) return;
    
    // Auto-save selected theme to lesson content
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== active.cIdx) return chap;
          return {
            ...chap,
            content: {
              ...(chap.content || {}),
              themeId: newThemeId,
            }
          };
        }),
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
  };
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

  const themeCss = useMemo(() => {
    if (!activeThemeObj || !activeThemeObj.variables) return '';
    const rules = Object.entries(activeThemeObj.variables)
      .map(([key, val]) => `  ${key}: ${val};`)
      .join('\n');
    return `[data-lesson-instance="${chapter?.id || active.mIdx + '-' + active.cIdx}"] {\n${rules}\n}`;
  }, [activeThemeObj, chapter, active]);

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

  const isExternalUrl = (url) => {
    if (!url) return false;
    let trimmed = url.trim();
    if (trimmed.startsWith('www.')) trimmed = 'https://' + trimmed;
    if (!trimmed.match(/^https?:\/\//i)) return false;
    if (trimmed.startsWith(API_URL) || trimmed.startsWith('http://localhost') || trimmed.startsWith('http://127.0.0.1') || trimmed.startsWith('/uploads/')) {
      return false;
    }
    return true;
  };

  const handleUpdateBlock = (idx, fields) => {
    setBlocksDraft(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...fields };
      return updated;
    });
  };

  const handleDownloadExternalImage = async (idx, rawUrl) => {
    let trimmed = (rawUrl || '').trim();
    if (!trimmed) return;
    if (trimmed.startsWith('www.')) {
      trimmed = 'https://' + trimmed;
    }
    if (!isExternalUrl(trimmed)) {
      return;
    }
    try {
      setUploadingBlockIdx(idx);
      const res = await downloadExternalImage(trimmed);
      if (res && res.url) {
        handleUpdateBlock(idx, { url: res.url });
      }
    } catch (err) {
      console.error("Failed to download external image:", err);
      setModalConfig({
        title: 'Download Failed',
        message: err?.response?.data?.detail || 'Could not download external image URL to local storage. Check the link and try again.',
        type: 'warning',
        confirmText: 'Got It'
      });
    } finally {
      setUploadingBlockIdx(null);
    }
  };

  const handleDownloadExternalAudio = async (idx, rawUrl) => {
    let trimmed = (rawUrl || '').trim();
    if (!trimmed) return;
    if (trimmed.startsWith('www.')) {
      trimmed = 'https://' + trimmed;
    }
    if (!isExternalUrl(trimmed)) {
      return;
    }
    try {
      setUploadingBlockIdx(idx);
      const res = await downloadExternalAudio(trimmed);
      if (res && res.url) {
        handleUpdateBlock(idx, { url: res.url, audio_source: 'external' });
      }
    } catch (err) {
      console.error("Failed to download external audio:", err);
      setModalConfig({
        title: 'Download Failed',
        message: err?.response?.data?.detail || 'Could not download external audio URL to local storage. Check the link and try again.',
        type: 'warning',
        confirmText: 'Got It'
      });
    } finally {
      setUploadingBlockIdx(null);
    }
  };

  const handleGenerateAIImage = async (idx, promptText) => {
    const trimmedPrompt = (promptText || '').trim();
    if (!trimmedPrompt) {
      setModalConfig({
        title: 'Prompt Required',
        message: 'Please enter a prompt or description for the AI image.',
        type: 'warning',
        confirmText: 'Got It'
      });
      return;
    }
    try {
      setUploadingBlockIdx(idx);
      const res = await generateAIImage(trimmedPrompt, courseData?.id || null);
      if (res && res.url) {
        handleUpdateBlock(idx, { 
          url: res.url, 
          image_source: 'ai_generated',
          caption: trimmedPrompt 
        });
      }
    } catch (err) {
      console.error("Failed to generate AI image:", err);
      setModalConfig({
        title: 'AI Generation Failed',
        message: err?.response?.data?.detail || 'Could not generate AI image. Please check your OpenAI API key and try again.',
        type: 'warning',
        confirmText: 'Got It'
      });
    } finally {
      setUploadingBlockIdx(null);
      setAiPromptModal(null);
    }
  };

  const handleGenerateAIAudio = async (idx, configPayload) => {
    const { script, prompt, voice, mode, isPodcast } = configPayload;
    if (mode === 'verbatim' && !(script || '').trim()) {
      setModalConfig({
        title: 'Script Required',
        message: 'Please enter a text script to generate verbatim AI speech.',
        type: 'warning',
        confirmText: 'Got It'
      });
      return;
    }
    if (mode === 'prompt' && !(prompt || '').trim()) {
      setModalConfig({
        title: 'Topic Prompt Required',
        message: 'Please enter a topic prompt for generating the AI audio content.',
        type: 'warning',
        confirmText: 'Got It'
      });
      return;
    }

    try {
      setUploadingBlockIdx(idx);
      const res = await generateAIAudio({
        script: mode === 'prompt' ? null : (script || null),
        prompt: prompt || null,
        voice: voice || 'nova',
        mode: mode || 'verbatim',
        is_podcast: !!isPodcast,
        draft_id: courseData?.id || null
      });

      if (res && res.url) {
        handleUpdateBlock(idx, {
          url: res.url,
          script: res.script || script,
          caption: res.caption || (mode === 'prompt' ? prompt : 'AI Audio Track'),
          voice: res.voice || voice || 'nova',
          audio_source: 'ai_generated'
        });
      }
    } catch (err) {
      console.error("Failed to generate AI audio:", err);
      setModalConfig({
        title: 'Audio Generation Failed',
        message: err?.response?.data?.detail || 'Could not generate AI audio. Check your OpenAI API key and try again.',
        type: 'warning',
        confirmText: 'Got It'
      });
    } finally {
      setUploadingBlockIdx(null);
      setAiAudioModal(null);
    }
  };

  const handleChangeAudioVoice = async (idx, currentBlock, newVoice) => {
    if (!currentBlock || !currentBlock.script) {
      handleUpdateBlock(idx, { voice: newVoice });
      return;
    }
    try {
      setUploadingBlockIdx(idx);
      const res = await generateAIAudio({
        script: currentBlock.script,
        voice: newVoice,
        mode: 'verbatim',
        draft_id: courseData?.id || null
      });

      if (res && res.url) {
        handleUpdateBlock(idx, {
          url: res.url,
          voice: newVoice,
          audio_source: 'ai_generated'
        });
      }
    } catch (err) {
      console.error("Failed to change voice tone:", err);
      handleUpdateBlock(idx, { voice: newVoice });
    } finally {
      setUploadingBlockIdx(null);
    }
  };

  const handleDeleteBlock = (idx) => {
    setBlocksDraft(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated.splice(idx, 1);
      return updated;
    });
  };

  const handleInsertBlock = (idx, type) => {
    if (!blocksDraft) return;
    const newBlock = { id: generateLocalId(), type };
    // Set default fields based on type
    if (type === 'heading') { newBlock.level = 2; newBlock.text = 'New Heading'; }
    else if (type === 'paragraph') { newBlock.text = 'New paragraph explanation content...'; }
    else if (type === 'bullet_list' || type === 'numbered_list') { newBlock.items = ['List item 1', 'List item 2']; }
    else if (type === 'image' || type === 'video') { newBlock.url = ''; newBlock.caption = 'Describe this content'; }
    else if (type === 'audio') { newBlock.url = ''; newBlock.caption = 'Audio Track Title / Narration'; newBlock.audio_source = 'user_uploaded'; }
    else if (type === 'table') { newBlock.headers = ['Header 1', 'Header 2']; newBlock.rows = [['Value 1', 'Value 2']]; }
    else if (type === 'callout') { newBlock.text = 'Note text'; newBlock.callout_type = 'info'; }
    else if (type === 'code') { newBlock.language = 'javascript'; newBlock.code = '// Code snippet'; newBlock.explanation = 'Explain the code'; }
    else if (type === 'example') { newBlock.scenario = 'Scenario title'; newBlock.detail = 'Example detailed description'; }
    else if (type === 'quiz') { 
      newBlock.title = 'Knowledge Check & Assessment';
      newBlock.objective = 'Work through mixed question types in one quiz set. Each question scores independently.';
      newBlock.estimated_time = '~3 min';
      newBlock.questions = [
        { question: 'Sample Question 1?', options: ['Option A', 'Option B'], correctAnswer: 'Option A', explanation: 'Why Option A is correct', question_type: 'SINGLE CHOICE' }
      ];
      newBlock.question = 'Sample Question 1?';
      newBlock.options = ['Option A', 'Option B'];
      newBlock.correctAnswer = 'Option A';
      newBlock.explanation = 'Why Option A is correct';
    }
    else if (type === 'assignment') { newBlock.task = 'Assignment task'; newBlock.instructions = 'Instructions'; newBlock.grading_criteria = ['Criterion 1']; }
    else if (type === 'flashcard') {
      newBlock.title = 'Key Terminology & Flashcards';
      newBlock.cards = [
        { front: 'Key Term 1', back: 'Definition of key term 1.' },
        { front: 'Key Term 2', back: 'Definition of key term 2.' },
        { front: 'Key Term 3', back: 'Definition of key term 3.' }
      ];
    }
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
                themeId: theme,
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
                themeId: theme,
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
        data-lesson-instance={chapter?.id || active.mIdx + '-' + active.cIdx}
      >
        <DynamicStyle css={themeCss} styleId={`lesson-theme-${chapter?.id || active.mIdx + '-' + active.cIdx}`} />
        
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
              {(userRole === 'super-admin' || userRole === 'vendor-admin') && (
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
                            onClick={() => handleSelectTheme(t.id)}
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
              )}

              {userRole === 'super-admin' && (
                <>
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
                </>
              )}
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
                            className="text-red-500 hover:text-red-700 p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
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
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Block</label>
                                  {block.url && (block.image_source === 'ai_generated' || block.url.includes('ai_img_')) ? (
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> AI Generated
                                    </span>
                                  ) : block.url && block.url.includes('ext_img_') ? (
                                    <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Globe className="w-3 h-3" /> Web Search
                                    </span>
                                  ) : block.url && block.url.includes('user_img_') ? (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Upload className="w-3 h-3" /> Local File
                                    </span>
                                  ) : block.url && !isExternalUrl(block.url) ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Saved on Server
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {block.url ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(idx, { url: '', image_source: null })}
                                      className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 shadow-sm cursor-pointer"
                                      title="Remove current image to upload, generate, or paste a new one"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove Image</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setAiPromptModal({ idx, prompt: block.caption || block.search_query || '' })}
                                        disabled={uploadingBlockIdx === idx}
                                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
                                      >
                                        {uploadingBlockIdx === idx ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Generating...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="w-3 h-3" />
                                            <span>Generate AI Image</span>
                                          </>
                                        )}
                                      </button>
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        id={`image-block-upload-${idx}`} 
                                        className="hidden" 
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          try {
                                            setUploadingBlockIdx(idx);
                                            const res = await uploadCourseImage(file);
                                            if (res && res.url) {
                                              handleUpdateBlock(idx, { url: res.url, image_source: 'user_uploaded' });
                                            }
                                          } catch (err) {
                                            console.error("Failed to upload course image:", err);
                                            setModalConfig({
                                              title: 'Upload Failed',
                                              message: 'Could not upload image file. Please try again.',
                                              type: 'warning',
                                              confirmText: 'Got It'
                                            });
                                          } finally {
                                            setUploadingBlockIdx(null);
                                            e.target.value = '';
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById(`image-block-upload-${idx}`)?.click()}
                                        disabled={uploadingBlockIdx === idx}
                                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
                                      >
                                        {uploadingBlockIdx === idx ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Uploading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="w-3 h-3" />
                                            <span>Upload Local Image</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex gap-2 items-center">
                                  <input 
                                    type="text"
                                    placeholder="Image URL (e.g. https://... or /uploads/...)"
                                    value={!!block.url && !isExternalUrl(block.url) ? block.url.split('/').pop() : (block.url || '')}
                                    disabled={!!block.url && !isExternalUrl(block.url)}
                                    onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                    className={`editor-text-input !p-2 !text-xs flex-1 ${
                                      !!block.url && !isExternalUrl(block.url) ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-mono' : ''
                                    }`}
                                  />
                                  {block.url && isExternalUrl(block.url) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadExternalImage(idx, block.url)}
                                      disabled={uploadingBlockIdx === idx}
                                      className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-2.5 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap shadow-sm cursor-pointer"
                                      title="Download & save image to local server uploads"
                                    >
                                      {uploadingBlockIdx === idx ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          <span>Saving to Server...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-3 h-3" />
                                          <span>Save to Server</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                                {block.url && isExternalUrl(block.url) && (
                                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                    <Info className="w-3 h-3 inline" /> External URL detected. Click "Save to Server" if you wish to store a local copy on your server.
                                  </p>
                                )}
                                {block.url && !isExternalUrl(block.url) && (
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    🔒 Image is saved to local server. Click "Remove Image" to change or pick a new file.
                                  </p>
                                )}
                              </div>
                              <input 
                                type="text"
                                placeholder="Caption / Prompt Description"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />
                              {block.url && (
                                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 bg-white p-1.5 max-h-44 flex flex-col items-center justify-center group">
                                  <img src={resolveMediaUrl(block.url)} alt={block.caption || ''} className="max-h-36 object-contain rounded-md" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="image-block-container">
                              {block.url ? (
                                <img src={resolveMediaUrl(block.url)} alt={block.caption || ''} className="max-w-full max-h-[400px] object-contain rounded-xl mx-auto shadow-sm" />
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

                        {block.type === 'audio' && (
                          editMode ? (
                            <div className="space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Volume2 className="w-3 h-3 text-purple-500" /> Audio Block
                                  </label>
                                  {block.url && (block.audio_source === 'ai_generated' || block.url.includes('ai_audio_')) ? (
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> AI Generated
                                    </span>
                                  ) : block.url && (block.audio_source === 'user_uploaded' || block.url.includes('user_audio_')) ? (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Upload className="w-3 h-3" /> Local File
                                    </span>
                                  ) : block.url && !isExternalUrl(block.url) ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Saved on Server
                                    </span>
                                  ) : null}

                                  {/* Voice Selector Dropdown - Only shown for AI Generated Audio or New Audio blocks */}
                                  {(!block.url || block.audio_source === 'ai_generated' || (block.url && block.url.includes('ai_audio_'))) && (
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs shadow-xs">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Voice:</span>
                                      <select
                                        value={block.voice || 'nova'}
                                        onChange={(e) => handleChangeAudioVoice(idx, block, e.target.value)}
                                        disabled={uploadingBlockIdx === idx}
                                        className="text-[11px] font-bold text-purple-700 bg-transparent focus:outline-none cursor-pointer"
                                      >
                                        <option value="nova">👩 Nova (Friendly Female)</option>
                                        <option value="onyx">👨 Onyx (Professional Male)</option>
                                        <option value="echo">👨 Echo (Warm Male)</option>
                                        <option value="shimmer">👩 Shimmer (Soft Female)</option>
                                        <option value="alloy">🧑 Alloy (Neutral)</option>
                                        <option value="fable">🎭 Fable (Storyteller)</option>
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {block.url ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBlock(idx, { url: '', audio_source: null })}
                                      className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 shadow-sm cursor-pointer"
                                      title="Remove current audio file to upload or generate a new one"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove Audio</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setAiAudioModal({
                                          idx,
                                          prompt: block.caption || '',
                                          script: block.script || '',
                                          voice: block.voice || 'nova',
                                          mode: block.script ? 'verbatim' : 'prompt',
                                          isPodcast: false
                                        })}
                                        disabled={uploadingBlockIdx === idx}
                                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
                                      >
                                        {uploadingBlockIdx === idx ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Generating Audio...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="w-3 h-3" />
                                            <span>Generate AI Audio</span>
                                          </>
                                        )}
                                      </button>
                                      <input 
                                        type="file" 
                                        accept="audio/*"
                                        id={`audio-block-upload-${idx}`} 
                                        className="hidden" 
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          try {
                                            setUploadingBlockIdx(idx);
                                            const res = await uploadCourseAudio(file);
                                            if (res && res.url) {
                                              handleUpdateBlock(idx, { url: res.url, audio_source: 'user_uploaded', caption: block.caption || file.name });
                                            }
                                          } catch (err) {
                                            console.error("Failed to upload course audio:", err);
                                            setModalConfig({
                                              title: 'Upload Failed',
                                              message: 'Could not upload audio file. Please try again.',
                                              type: 'warning',
                                              confirmText: 'Got It'
                                            });
                                          } finally {
                                            setUploadingBlockIdx(null);
                                            e.target.value = '';
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById(`audio-block-upload-${idx}`)?.click()}
                                        disabled={uploadingBlockIdx === idx}
                                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer"
                                      >
                                        {uploadingBlockIdx === idx ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Uploading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="w-3 h-3" />
                                            <span>Upload Local Audio</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex gap-2 items-center">
                                  <input 
                                    type="text"
                                    placeholder="Audio URL (e.g. https://... or /uploads/...)"
                                    value={!!block.url && !isExternalUrl(block.url) ? block.url.split('/').pop() : (block.url || '')}
                                    disabled={!!block.url && !isExternalUrl(block.url)}
                                    onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                    className={`editor-text-input !p-2 !text-xs flex-1 ${
                                      !!block.url && !isExternalUrl(block.url) ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-mono' : ''
                                    }`}
                                  />
                                  {block.url && isExternalUrl(block.url) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadExternalAudio(idx, block.url)}
                                      disabled={uploadingBlockIdx === idx}
                                      className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-2.5 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap shadow-sm cursor-pointer"
                                      title="Download & save audio to local server uploads"
                                    >
                                      {uploadingBlockIdx === idx ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          <span>Saving to Server...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-3 h-3" />
                                          <span>Save to Server</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                                {block.url && isExternalUrl(block.url) && (
                                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                    <Info className="w-3 h-3 inline" /> External Audio URL detected. Click "Save to Server" if you wish to store a local copy on your server.
                                  </p>
                                )}
                                {block.url && !isExternalUrl(block.url) && (
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    🔒 Audio file is saved to local server. Click "Remove Audio" to change or pick a new file.
                                  </p>
                                )}
                              </div>

                              <input 
                                type="text"
                                placeholder="Audio Title / Narration Description"
                                value={block.caption || ''}
                                onChange={(e) => handleUpdateBlock(idx, { caption: e.target.value })}
                                className="editor-text-input !p-2 !text-xs"
                              />

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Written Transcript / Narration Script</label>
                                <textarea 
                                  rows={3}
                                  placeholder="Written transcript text script (read verbatim by tts-1)..."
                                  value={block.script || ''}
                                  onChange={(e) => handleUpdateBlock(idx, { script: e.target.value })}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-700 leading-relaxed font-sans"
                                />
                              </div>

                              {block.url && (
                                <div className="mt-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                                  <audio controls src={resolveMediaUrl(block.url)} className="w-full" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="audio-block-container p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                                  <Volume2 className="w-4 h-4 text-purple-600" />
                                  <span>{block.caption || 'Audio Overview Track'}</span>
                                </div>
                                {block.script && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTranscripts(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                    className="text-[11px] font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>{expandedTranscripts[idx] ? 'Hide Transcript ▲' : 'Read Transcript ▾'}</span>
                                  </button>
                                )}
                              </div>

                              {block.url ? (
                                <audio controls src={resolveMediaUrl(block.url)} className="w-full rounded-xl" />
                              ) : (
                                <div className="p-3 bg-slate-100 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                                  [Audio Track Placeholder: {block.caption || 'No audio file attached'}]
                                </div>
                              )}

                              {/* Accordion Read-Along Transcript */}
                              {block.script && expandedTranscripts[idx] && (
                                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 text-xs text-slate-700 leading-relaxed font-sans animate-fade-in shadow-inner">
                                  <p className="font-bold text-[10px] text-purple-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> Audio Transcript
                                  </p>
                                  <div className="whitespace-pre-line">{block.script}</div>
                                </div>
                              )}
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

                        {block.type === 'quiz' && (
                          <InteractiveQuiz 
                            block={block} 
                            editMode={editMode} 
                            onUpdateBlock={(fields) => handleUpdateBlock(idx, fields)} 
                          />
                        )}

                        {block.type === 'flashcard' && (
                          <InteractiveFlashcards 
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
                                    className="text-red-400 hover:text-red-600 flex-shrink-0 p-1.5 -m-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                                    title="Remove file"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex border-b border-slate-100 text-xs">
                                    <button
                                      type="button"
                                      className={`px-3 py-1.5 font-bold transition-all border-b-2 ${(!attachmentTabs[idx] || attachmentTabs[idx] === 'upload') ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                      onClick={() => setAttachmentTabs(prev => ({ ...prev, [idx]: 'upload' }))}
                                    >
                                      Upload New
                                    </button>
                                    <button
                                      type="button"
                                      className={`px-3 py-1.5 font-bold transition-all border-b-2 ${(attachmentTabs[idx] === 'internal') ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
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
                            <div className="absolute top-7 bg-white border border-slate-100 shadow-xl rounded-2xl p-3 grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-lg z-30 animate-scale-in">
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

        {/* AI Image Generation Prompt Modal Overlay */}
        {aiPromptModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up border border-slate-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Generate AI Image</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Powered by OpenAI gpt-image-1-mini</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiPromptModal(null)}
                  className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Prompt / Image Description</label>
                <textarea
                  rows={3}
                  value={aiPromptModal.prompt}
                  onChange={(e) => setAiPromptModal({ ...aiPromptModal, prompt: e.target.value })}
                  placeholder="Describe the image or diagram you want AI to generate (e.g., Clean vector diagram of AI vs Machine Learning)..."
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-700 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAiPromptModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateAIImage(aiPromptModal.idx, aiPromptModal.prompt)}
                  disabled={uploadingBlockIdx === aiPromptModal.idx || !aiPromptModal.prompt.trim()}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  {uploadingBlockIdx === aiPromptModal.idx ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating AI Image...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Audio Generation Modal */}
        {aiAudioModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Generate AI Audio Track</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Use tts-1 or gpt-4o-mini-tts with voice selection</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAiAudioModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Selection Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAiAudioModal(prev => ({ ...prev, mode: 'verbatim' }))}
                  className={`flex-1 py-1.5 rounded-lg transition ${aiAudioModal.mode === 'verbatim' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  🎵 Verbatim Script
                </button>
                <button
                  type="button"
                  onClick={() => setAiAudioModal(prev => ({ ...prev, mode: 'prompt' }))}
                  className={`flex-1 py-1.5 rounded-lg transition ${aiAudioModal.mode === 'prompt' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  ✨ Topic Prompt
                </button>
              </div>

              {/* Voice Choice */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Voice Tone</label>
                <select
                  value={aiAudioModal.voice || 'nova'}
                  onChange={(e) => setAiAudioModal(prev => ({ ...prev, voice: e.target.value }))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-purple-700 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                >
                  <option value="nova">👩 Nova (Friendly Female Teacher)</option>
                  <option value="onyx">👨 Onyx (Professional Male Instructor)</option>
                  <option value="echo">👨 Echo (Warm Conversational Male)</option>
                  <option value="shimmer">👩 Shimmer (Soft & Calm Female)</option>
                  <option value="alloy">🧑 Alloy (Neutral & Balanced)</option>
                  <option value="fable">🎭 Fable (Expressive Storyteller)</option>
                </select>
              </div>

              {aiAudioModal.mode === 'verbatim' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exact Text Script (read word-for-word)</label>
                  <textarea 
                    rows={4}
                    placeholder="Enter the exact script text to convert to spoken audio..."
                    value={aiAudioModal.script || ''}
                    onChange={(e) => setAiAudioModal(prev => ({ ...prev, script: e.target.value }))}
                    className="w-full p-3 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed font-sans"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topic / Concept Prompt</label>
                    <textarea 
                      rows={3}
                      placeholder="Describe what the audio content should be about (e.g. Explain Supervised vs Unsupervised Learning in simple terms)..."
                      value={aiAudioModal.prompt || ''}
                      onChange={(e) => setAiAudioModal(prev => ({ ...prev, prompt: e.target.value }))}
                      className="w-full p-3 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed font-sans"
                    />
                  </div>

                  {/* Podcast Toggle */}
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={!!aiAudioModal.isPodcast}
                      onChange={(e) => setAiAudioModal(prev => ({ ...prev, isPodcast: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-700">🎙️ Podcast Mode (2-Speaker Dialogue)</p>
                      <p className="text-[10px] text-slate-400 font-medium">Generates an interactive dialogue between Host Alex and Dr. Taylor</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAiAudioModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateAIAudio(aiAudioModal.idx, aiAudioModal)}
                  disabled={uploadingBlockIdx === aiAudioModal.idx}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  {uploadingBlockIdx === aiAudioModal.idx ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating AI Audio...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Audio</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
