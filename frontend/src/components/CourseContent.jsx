import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, ChevronDown, ChevronRight, Edit3, GripVertical, 
  Sparkles, MessageSquareText, FileJson, ChevronLeft, Loader2, AlertCircle, 
  X, CheckCircle2, MoreVertical, Bot, Upload, Code, FileCode, FileText, Presentation, 
  Video, Volume2, HelpCircle, CheckSquare, RefreshCw, Zap, Settings2, Eye
} from 'lucide-react';
import AIAssistantSidebar from './AIAssistantSidebar';
import ActionModal from './ActionModal';
import LessonPreviewEditorModal from './LessonPreviewEditorModal';
import { generateLessonContent, uploadChapterMedia } from '../api';

const CONTENT_TYPES = [
  { id: 'html', label: 'HTML', icon: FileCode, color: 'text-sky-500', bg: 'bg-sky-50', disabled: false },
  { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'ppt', label: 'PPT', icon: Presentation, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'video', label: 'Video', icon: Video, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'audio', label: 'Audio', icon: Volume2, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'assessment', label: 'Assessment', icon: CheckSquare, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
];

export default function CourseContent({ courseData, updateCourseData, contentGenUi, setContentGenUi, onNext, onBack }) {
  const [expandedLesson, setExpandedLesson] = useState(null); // { mIdx, cIdx }
  const [previewLesson, setPreviewLesson] = useState(null); // { mIdx, cIdx, startInEdit }
  const [showSidebar, setShowSidebar] = useState(false);
  const [error, setError] = useState('');
  const [sidebarRequest, setSidebarRequest] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const fileInputRef = useRef(null);
  const bulkMenuRef = useRef(null);

  const loadingMap = contentGenUi?.loadingMap || {};
  const isGeneratingAll = !!contentGenUi?.isGeneratingAll;
  const modalConfig = contentGenUi?.modalConfig || null;

  const setLoadingMap = (updater) => {
    if (!setContentGenUi) return;
    setContentGenUi((prev) => ({
      ...prev,
      loadingMap: typeof updater === 'function' ? updater(prev.loadingMap || {}) : updater,
    }));
  };

  const setIsGeneratingAll = (value) => {
    if (!setContentGenUi) return;
    setContentGenUi((prev) => ({ ...prev, isGeneratingAll: value }));
  };

  const setModalConfig = (value) => {
    if (!setContentGenUi) return;
    setContentGenUi((prev) => ({ ...prev, modalConfig: value }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target)) {
        setShowBulkMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state helper
  const updateLessonContent = (mIdx, cIdx, updates, blockIdx = null) => {
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== cIdx) return chap;
          const newChap = { ...chap };
          
          if (!newChap.contents) {
            newChap.contents = (newChap.content && newChap.content.completed) ? [newChap.content] : [];
          } else {
            newChap.contents = [...newChap.contents];
          }

          if (blockIdx !== null) {
            newChap.contents[blockIdx] = { ...newChap.contents[blockIdx], ...updates };
          } else {
            newChap.content = { ...(newChap.content || {}), ...updates };
          }
          return newChap;
        })
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
  };

  const deleteContentBlock = (mIdx, cIdx, blockIdx) => {
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== cIdx) return chap;
          if (chap.contents) {
            const newContents = [...chap.contents];
            newContents.splice(blockIdx, 1);
            return { ...chap, contents: newContents };
          }
          return chap;
        })
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
  };

  const moveContentBlock = (mIdx, cIdx, blockIdx, direction) => {
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== cIdx) return chap;
          if (chap.contents) {
            const newIdx = blockIdx + direction;
            if (newIdx >= 0 && newIdx < chap.contents.length) {
              const newContents = [...chap.contents];
              const temp = newContents[blockIdx];
              newContents[blockIdx] = newContents[newIdx];
              newContents[newIdx] = temp;
              return { ...chap, contents: newContents };
            }
          }
          return chap;
        })
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
  };

  // NOTE: deleting lessons is not supported here; only content blocks should be deleted.

  const handleApplyAISuggestion = (suggestion) => {
    if (suggestion.prompts && Array.isArray(suggestion.prompts) && suggestion.prompts.length > 0) {
      const newModules = (courseData.structure?.modules || []).map(mod => ({
        ...mod,
        chapters: (mod.chapters || []).map(chap => {
          const cTitle = (chap.title || "").trim().toLowerCase();
          const matchingPrompt = suggestion.prompts.find(p => {
            if (!p) return false;
            const pTitle = (p.title || p.lesson || "").trim().toLowerCase();
            return pTitle === cTitle;
          })?.prompt;

          if (matchingPrompt) {
            return {
              ...chap,
              content: { ...(chap.content || {}), prompt: matchingPrompt, source: 'ai' }
            };
          }
          return chap;
        })
      }));
      updateCourseData('structure', { ...courseData.structure, modules: newModules });
      setModalConfig({
        title: 'Prompts Applied',
        message: 'The AI-generated prompts have been successfully added to your lessons!',
        type: 'success',
        confirmText: 'Great!'
      });
    } else if (suggestion.prompt) {
      // Robust Targeted Application: Use title and module from metadata if available
      // Otherwise fallback to expandedLesson
      let targetM = -1, targetC = -1;
      
      if (suggestion.title || suggestion.lesson) {
        const sTitle = (suggestion.title || suggestion.lesson || "").trim().toLowerCase();
        const sMod = (suggestion.module || "").trim().toLowerCase();

        // Pass 1: Try exact match
        modules.forEach((mod, mIdx) => {
          const mTitle = (mod.title || "").trim().toLowerCase();
          mod.chapters.forEach((chap, cIdx) => {
            const cTitle = (chap.title || "").trim().toLowerCase();
            if (cTitle === sTitle && (!sMod || mTitle === sMod)) {
              targetM = mIdx; targetC = cIdx;
            }
          });
        });

        // Pass 2: Try partial match if no exact match found
        if (targetM === -1) {
          modules.forEach((mod, mIdx) => {
            const mTitle = (mod.title || "").trim().toLowerCase();
            mod.chapters.forEach((chap, cIdx) => {
              const cTitle = (chap.title || "").trim().toLowerCase();
              const matchTitle = cTitle.includes(sTitle) || sTitle.includes(cTitle);
              const matchMod = sMod ? (mTitle.includes(sMod) || sMod.includes(mTitle)) : true;
              
              if (matchMod && matchTitle && targetM === -1) {
                targetM = mIdx; targetC = cIdx;
              }
            });
          });
        }
      }

      if (targetM !== -1 && targetC !== -1) {
        updateLessonContent(targetM, targetC, { prompt: suggestion.prompt, source: 'ai' });
        setModalConfig({
          title: 'Prompt Applied',
          message: 'The AI-generated prompt has been successfully added to this lesson!',
          type: 'success',
          confirmText: 'Great!'
        });
      } else if (expandedLesson) {
        updateLessonContent(expandedLesson.mIdx, expandedLesson.cIdx, { prompt: suggestion.prompt, source: 'ai' });
        setModalConfig({
          title: 'Prompt Applied',
          message: 'The AI-generated prompt has been successfully added to this lesson!',
          type: 'success',
          confirmText: 'Great!'
        });
      }
    }
  };

  const handleGenerateContent = async (mIdx, cIdx, lesson) => {
    const prompt = lesson.content?.prompt || '';
    if (!prompt.trim()) return setError('Please provide a prompt first.');
    
    const key = `${mIdx}-${cIdx}`;
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      const payload = {
        title: lesson.title,
        module_title: courseData.structure.modules[mIdx].title,
        prompt: prompt,
        type: lesson.content?.type || 'html',
        course_details: courseData.details
      };
      const res = await generateLessonContent(payload);
      
      // Deep clone modules to avoid direct state mutation and ensure React detects change
      const currentModules = JSON.parse(JSON.stringify(courseData.structure?.modules || []));
      const chapter = currentModules[mIdx].chapters[cIdx];
      if (!chapter.contents) {
        chapter.contents = (chapter.content && chapter.content.completed) ? [chapter.content] : [];
      }
      
      chapter.contents.push({ 
        ...res, 
        source: 'ai', 
        type: lesson.content?.type || 'html',
        completed: true,
        timestamp: new Date().toISOString()
      });

      updateCourseData('structure', { ...courseData.structure, modules: currentModules });
    } catch (err) {
      setError(`Failed to generate content for ${lesson.title}`);
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFileUpload = async (event, mIdx, cIdx) => {
    const file = event.target.files[0];
    if (!file) return;

    const key = `${mIdx}-${cIdx}`;
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      const res = await uploadChapterMedia(file);
      
      const newModules = [...(courseData.structure?.modules || [])];
      const chapter = newModules[mIdx].chapters[cIdx];
      if (!chapter.contents) chapter.contents = (chapter.content && chapter.content.completed) ? [chapter.content] : [];
      
      chapter.contents.push({ 
        completed: true, 
        source: 'manual',
        type: file.type.includes('pdf') ? 'pdf' : 'file',
        file_url: res.url,
        file_name: file.name,
        timestamp: new Date().toISOString()
      });

      updateCourseData('structure', { ...courseData.structure, modules: newModules });
    } catch (err) {
      setError("Failed to upload file.");
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRegeneratePrompt = (lesson) => {
    const moduleTitle = modules[expandedLesson.mIdx]?.title || `Module ${expandedLesson.mIdx + 1}`;
    const prompt = `Please generate a high-quality, practical, and highly detailed AI content generation prompt ONLY for the lesson: "${lesson.title}" in the module: "${moduleTitle}". 
    The course is about: "${courseData.details?.courseName || courseData.details?.title || 'this course'}". 
    Description: "${courseData.details?.description || ''}".

    CRITICAL REQUIREMENTS: 
    1. The prompt you generate MUST be at least 200 words long, covering specific learning objectives, detailed content outlines, examples, and analogies. 
    2. DO NOT ask any questions. DO NOT ask for confirmation. Generate the prompt IMMEDIATELY.
    3. This lesson is part of the CURRENT course - do NOT refuse or ask if the user wants relevant content.

    YOU MUST RETURN A [METADATA] BLOCK with the following JSON:
    { "module": "${moduleTitle}", "title": "${lesson.title}", "prompt": "..." }`;
    
    setSidebarRequest({ 
      text: prompt, 
      display: `Regenerate Prompt for ${moduleTitle}: ${lesson.title}`, 
      fillInput: false,
      clearHistory: true,
      _ts: Date.now()
    });
    setShowSidebar(true);
    // Reset trigger after a short delay so it can be re-triggered
    setTimeout(() => setSidebarRequest(null), 200);
  };

  const modules = courseData.structure?.modules || [];
  
  let totalLessons = 0;
  let lessonsWithContent = 0;
  let lessonsWithPromptOnly = 0;
  let lessonsMissingPrompt = 0;

  modules.forEach(mod => {
    (mod.chapters || []).forEach(chap => {
      totalLessons++;
      const hasContents = (chap.contents && chap.contents.length > 0) || chap.content?.completed;
      const hasPrompt = chap.content?.prompt && chap.content.prompt.trim() !== '';

      if (hasContents) {
        lessonsWithContent++;
      } else if (hasPrompt) {
        lessonsWithPromptOnly++;
      } else {
        lessonsMissingPrompt++;
      }
    });
  });



  const triggerGenerateAll = async () => {
    setIsGeneratingAll(true);
    setError('');
    
    let currentModules = JSON.parse(JSON.stringify(courseData.structure.modules || []));
    let completedCount = 0;
    let failCount = 0;

    // Collect all pending tasks
    const tasks = [];
    for (let mIdx = 0; mIdx < currentModules.length; mIdx++) {
      const mod = currentModules[mIdx];
      for (let cIdx = 0; cIdx < (mod.chapters || []).length; cIdx++) {
        const chap = mod.chapters[cIdx];
        const hasContents = (chap.contents && chap.contents.length > 0) || chap.content?.completed;
        
        if (!hasContents && chap.content?.prompt?.trim()) {
          tasks.push({ mIdx, cIdx, chap, mod });
        }
      }
    }

    if (tasks.length === 0) {
      setIsGeneratingAll(false);
      return;
    }

    // Process tasks sequentially, one-by-one, so the UI updates in real-time
    for (const task of tasks) {
      const { mIdx, cIdx, chap, mod } = task;
      const key = `${mIdx}-${cIdx}`;
      setLoadingMap(prev => ({ ...prev, [key]: true }));
      
      try {
        const payload = {
          title: chap.title,
          module_title: mod.title,
          prompt: chap.content.prompt,
          type: chap.content.type || 'html',
          course_details: courseData.details
        };
        
        const res = await generateLessonContent(payload);
        
        // Update our local copy safely
        if (!currentModules[mIdx].chapters[cIdx].contents) {
          currentModules[mIdx].chapters[cIdx].contents = 
            (currentModules[mIdx].chapters[cIdx].content && currentModules[mIdx].chapters[cIdx].content.completed) 
            ? [currentModules[mIdx].chapters[cIdx].content] 
            : [];
        }
        
        currentModules[mIdx].chapters[cIdx].contents.push({
          ...res,
          source: 'ai',
          type: chap.content.type || 'html',
          completed: true,
          timestamp: new Date().toISOString()
        });

        // Update the React state immediately so this lesson's content renders right away!
        updateCourseData('structure', { 
          ...courseData.structure, 
          modules: JSON.parse(JSON.stringify(currentModules)) 
        });

        completedCount++;
      } catch (err) {
        console.error(`Failed for ${chap.title}`, err);
        failCount++;
      } finally {
        setLoadingMap(prev => ({ ...prev, [key]: false }));
      }
    }
    
    setIsGeneratingAll(false);
    
    setModalConfig({
      title: 'Generation Complete',
      message: failCount > 0 
        ? `Successfully generated ${completedCount} lessons. ${failCount} lessons failed to generate.`
        : `Successfully generated content for all ${completedCount} pending lessons!`,
      type: failCount > 0 ? 'warning' : 'success',
      confirmText: 'Great!'
    });
  };

  const handleBulkGeneratePrompts = () => {
    const prompt = `Please generate high-quality, practical, and EXTREMELY detailed AI content generation prompts for ALL lessons in this course. 

    QUALITY STANDARD:
    For every single lesson, the prompt must be a comprehensive guide that is exactly 100 to 150 words long. 
    Example of quality: "Write a comprehensive chapter on the fundamentals of Python variables. You must cover naming conventions, dynamic typing, and memory allocation in deep detail. Use a 'Storage Box' analogy to make it easy for beginners to understand. Include exactly 3 hands-on coding exercises where the user has to declare different types of variables, and provide a 5-question multiple choice quiz on Python naming rules at the end. Ensure the tone is encouraging and professional."

    CRITICAL RULE: Do NOT provide short or generic single-line summaries. If a course has 10 lessons, you must provide 10 long, highly detailed prompts, each being 100-150 words.

    Course Context:
    - Title: "${courseData.details?.courseName || courseData.details?.title}"
    - Description: "${courseData.details?.description}"

    RETURN THE FULL LIST:
    Format: { "prompts": [ { "module": "...", "title": "...", "prompt": "..." } ] }`;
    
    setSidebarRequest({ 
      text: prompt, 
      display: "Generate All Prompts", 
      fillInput: false 
    });
    setShowSidebar(true);
    setTimeout(() => setSidebarRequest(null), 100);
  };

  const handleGenerateAllContent = async () => {
    if (lessonsWithPromptOnly === 0 && lessonsMissingPrompt > 0) {
      setModalConfig({
        title: 'Missing Prompts',
        message: 'First generate prompts for the lessons to generate content.',
        type: 'warning',
        confirmText: 'Got It'
      });
      return;
    }
    
    if (lessonsWithPromptOnly === 0 && lessonsMissingPrompt === 0) {
      setModalConfig({
        title: 'All Done!',
        message: 'All lessons already have content generated!',
        type: 'success',
        confirmText: 'Awesome'
      });
      return;
    }

    if (lessonsMissingPrompt > 0) {
      setModalConfig({
        title: 'Generate Content',
        message: `You have prompts for ${lessonsWithContent + lessonsWithPromptOnly} out of ${totalLessons} lessons.\n\nWould you like to generate content for these ready lessons only?\n\n(Click Cancel if you want to add prompts for the remaining ${lessonsMissingPrompt} lessons first.)`,
        type: 'confirm',
        confirmText: 'Generate Content',
        onConfirm: () => {
          setModalConfig(null);
          triggerGenerateAll();
        }
      });
      return;
    } else if (lessonsWithContent > 0) {
      setModalConfig({
        title: 'Generate Content',
        message: `You have already created content for ${lessonsWithContent} lesson(s).\n\nWould you like to generate content for the remaining ${lessonsWithPromptOnly} lesson(s)?`,
        type: 'confirm',
        confirmText: 'Generate Remaining',
        onConfirm: () => {
          setModalConfig(null);
          triggerGenerateAll();
        }
      });
      return;
    }

    setModalConfig({
      title: 'Bulk Generation Started',
      message: 'We are now generating comprehensive, interactive learning materials for all ready lessons. Please sit back and watch your course come to life lesson-by-lesson!',
      type: 'success',
      confirmText: 'Awesome!',
      onConfirm: () => {
        setModalConfig(null);
        triggerGenerateAll();
      }
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <ActionModal 
        isOpen={!!modalConfig}
        onClose={() => setModalConfig(null)}
        {...modalConfig}
      />

      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-bounce shadow-sm">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           {error}
           <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 h-[800px]">
        {/* Main Content Section */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full">
          <div className="p-6 md:p-8 flex-1 overflow-y-auto no-scrollbar scroll-smooth">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Step 4: Course Content</h2>
                  <span className="bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-600 px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI ENHANCED
                  </span>
                </div>
                <p className="text-slate-400 font-semibold text-[10px] tracking-wide uppercase leading-relaxed">Grouped by modules. AI is enabled by default with HTML content.</p>
              </div>

              <div className="flex items-center gap-2 relative">
                {/* ASK AI Button (moved to the left) */}
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" /> 
                  <span>ASK AI</span>
                </button>

                {/* Bulk Action Dropdown Container */}
                <div className="relative" ref={bulkMenuRef}>
                  <button 
                    onClick={() => setShowBulkMenu(!showBulkMenu)}
                    className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-700 px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-200 transition shadow-sm active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                    <span>BULK ACTION</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${showBulkMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showBulkMenu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-100 shadow-xl py-2 z-50 animate-scale-in">
                      <button 
                        onClick={() => {
                          setShowBulkMenu(false);
                          handleBulkGeneratePrompts();
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:text-sky-600 hover:bg-sky-50/50 transition flex items-center gap-2"
                      >
                        <Bot className="w-4 h-4 text-sky-500" />
                        <span>Generate all Prompt</span>
                      </button>
                      <button 
                        onClick={() => {
                          setShowBulkMenu(false);
                          handleGenerateAllContent();
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:text-sky-600 hover:bg-sky-50/50 transition flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-sky-500" />
                        <span>Generate all Content</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modules and Lessons List */}
            <div className="space-y-10">
              {modules.map((mod, mIdx) => (
                <div key={mIdx} className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xs">
                      {mIdx + 1}
                    </div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{mod.title}</h3>
                  </div>

                  <div className="space-y-3 pl-4 border-l-2 border-slate-50 ml-4">
                    {(mod.chapters || []).map((chap, cIdx) => (
                      <div key={cIdx} className="group animate-scale-in">
                        {/* Lesson Header */}
                        <div className={`
                          flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300
                          ${expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx ? 'bg-white border-sky-100 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-100'}
                        `}>
                          <div className="flex-1 flex items-center justify-between">
                            <button 
                              onClick={() => setExpandedLesson(expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx ? null : { mIdx, cIdx })}
                              className="flex items-center gap-3 text-left group/title"
                            >
                              <span className={`text-xs font-bold transition-colors ${expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx ? 'text-sky-600' : 'text-slate-900 group-hover/title:text-slate-600'}`}>
                                {mIdx + 1}.{cIdx + 1} {chap.title}
                              </span>
                            </button>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-1 items-center">
                                {/* Prompt Status Icon */}
                                <div 
                                  className={`w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm z-10 transition-opacity duration-300 ${chap.content?.prompt?.trim() ? 'opacity-100' : 'opacity-30 grayscale'}`} 
                                  title={chap.content?.prompt?.trim() ? 'Prompt Added' : 'No Prompt'}
                                >
                                  <MessageSquareText className={`w-2.5 h-2.5 ${chap.content?.prompt?.trim() ? 'text-sky-600' : 'text-slate-400'}`} />
                                </div>
                                {/* Loading Spinner or Normal Content Type Icons */}
                                {loadingMap[`${mIdx}-${cIdx}`] ? (
                                  <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full shadow-sm animate-pulse z-20">
                                    <Loader2 className="w-2.5 h-2.5 text-sky-600 animate-spin" />
                                    <span className="text-[8px] font-black text-sky-600 uppercase tracking-wider">Generating...</span>
                                  </div>
                                ) : (
                                  <>
                                    {((chap.contents || (chap.content?.completed ? [chap.content] : []))).map((c, i) => {
                                      const TypeIcon = CONTENT_TYPES.find(t => t.id === (c.type || 'html'))?.icon || FileJson;
                                      return (
                                        <div key={i} className="w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm" title={c.type}>
                                          <TypeIcon className="w-2.5 h-2.5 text-sky-600" />
                                        </div>
                                      );
                                    })}
                                    {(chap.contents || []).length === 0 && !chap.content?.completed && (
                                      isGeneratingAll ? (
                                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100/60 px-2 py-0.5 rounded-full shadow-sm z-20 animate-pulse">
                                          <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                                          <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">In Progress</span>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">No Content</span>
                                      )
                                    )}
                                  </>
                                )}
                              </div>
                              <button 
                                onClick={() => setExpandedLesson(expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx ? null : { mIdx, cIdx })}
                                className={`p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-transform ${expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx ? '' : '-rotate-90'}`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Lesson Detail (Expanded) */}
                        {expandedLesson?.mIdx === mIdx && expandedLesson?.cIdx === cIdx && (
                          <div className="mt-4 space-y-8 animate-in slide-in-from-top-2 duration-300">

                            {/* Existing Generated Content (preview/edit/delete) */}
                            {(chap.contents || (chap.content?.completed ? [chap.content] : [])).length > 0 && (
                              <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Lesson Material</label>
                                {(chap.contents || (chap.content?.completed ? [chap.content] : [])).map((block, bIdx) => (
                                  <ContentBlock
                                    key={bIdx}
                                    block={block}
                                    onDelete={() => deleteContentBlock(mIdx, cIdx, bIdx)}
                                    onPreview={() => setPreviewLesson({ mIdx, cIdx, startInEdit: false })}
                                    onEdit={() => setPreviewLesson({ mIdx, cIdx, startInEdit: true })}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Add New Content Section */}
                            <div className="p-6 bg-white border border-sky-50 rounded-[2rem] space-y-8 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-6 bg-sky-500 rounded-full" />
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Add Content Block</h4>
                              </div>

                              {/* Source & Type Section */}
                              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8`}>
                                {/* Content Source */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Source</label>
                                    <div className={`grid grid-cols-2 gap-3`}>
                                        <button 
                                          onClick={() => updateLessonContent(mIdx, cIdx, { source: 'ai' })}
                                          className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 ${(!chap.content?.source || chap.content?.source === 'ai') ? 'border-sky-500 bg-sky-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                        >
                                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${(!chap.content?.source || chap.content?.source === 'ai') ? 'bg-sky-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                              <Sparkles className="w-4 h-4" />
                                          </div>
                                          <div className="space-y-0.5">
                                              <p className={`text-[11px] font-bold ${(!chap.content?.source || chap.content?.source === 'ai') ? 'text-sky-700' : 'text-slate-700'}`}>AI Generated</p>
                                              <p className="text-[9px] text-slate-400 font-medium leading-tight">Prompt the AI.</p>
                                          </div>
                                        </button>
                                      <button 
                                        onClick={() => updateLessonContent(mIdx, cIdx, { source: 'manual' })}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 ${chap.content?.source === 'manual' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                      >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${chap.content?.source === 'manual' ? 'bg-sky-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                            <Upload className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className={`text-[11px] font-bold ${chap.content?.source === 'manual' ? 'text-sky-700' : 'text-slate-700'}`}>Upload File</p>
                                            <p className="text-[9px] text-slate-400 font-medium leading-tight">Use your media.</p>
                                        </div>
                                      </button>
                                    </div>
                                </div>

                                {/* Content Type - Only visible if source is AI */}
                                {(!chap.content?.source || chap.content?.source === 'ai') && (
                                  <div className="space-y-3">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Type</label>
                                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                                        {CONTENT_TYPES.map((type) => (
                                          <button 
                                            key={type.id}
                                            disabled={type.disabled}
                                            onClick={() => updateLessonContent(mIdx, cIdx, { type: type.id })}
                                            className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${chap.content?.type === type.id || (!chap.content?.type && type.id === 'html') ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100/50' : 'border-slate-100 hover:border-slate-200'} ${type.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          >
                                              <div className={`w-8 h-8 rounded-lg ${type.bg} ${type.color} flex items-center justify-center shadow-sm`}>
                                                <type.icon className="w-4 h-4" />
                                              </div>
                                              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{type.label}</span>
                                          </button>
                                        ))}
                                      </div>
                                  </div>
                                )}
                              </div>

                              {/* AI Prompt Section - Only visible if source is AI */}
                              {(!chap.content?.source || chap.content?.source === 'ai') && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Content Prompt</label>
                                        <HelpCircle className="w-3 h-3 text-slate-300" />
                                      </div>
                                  </div>
                                  <div className="relative group">
                                      <textarea 
                                        value={chap.content?.prompt || ''}
                                        onChange={(e) => updateLessonContent(mIdx, cIdx, { prompt: e.target.value })}
                                        className="w-full bg-slate-50/50 border-2 border-slate-50 rounded-2xl p-5 text-[11px] text-slate-700 font-medium min-h-[140px] focus:ring-0 focus:border-sky-100 transition-all outline-none resize-none leading-relaxed"
                                        placeholder="Describe what content AI should generate for this block..."
                                      />
                                      <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                        <button 
                                          onClick={() => handleRegeneratePrompt(chap)}
                                          className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-500 px-3.5 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition shadow-sm active:scale-95"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Regenerate Prompt
                                        </button>
                                        <button 
                                          onClick={() => handleGenerateContent(mIdx, cIdx, chap)}
                                          disabled={loadingMap[`${mIdx}-${cIdx}`] || !(chap.content?.prompt || '').trim()}
                                          className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 disabled:opacity-50 active:scale-95"
                                        >
                                            {loadingMap[`${mIdx}-${cIdx}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                            Generate Content
                                        </button>
                                      </div>
                                  </div>
                                </div>
                              )}

                              {/* Manual Upload State */}
                              {chap.content?.source === 'manual' && (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                                      <Upload className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <div className="text-center space-y-1 mb-6">
                                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ready to upload</p>
                                      <p className="text-[10px] text-slate-300 font-medium leading-relaxed">Your file will be added as a new content block below.</p>
                                    </div>
                                    
                                    <input 
                                      type="file" 
                                      id={`file-upload-${mIdx}-${cIdx}`}
                                      className="hidden" 
                                      onChange={(e) => handleFileUpload(e, mIdx, cIdx)} 
                                    />
                                    <button 
                                      onClick={() => document.getElementById(`file-upload-${mIdx}-${cIdx}`).click()}
                                      disabled={loadingMap[`${mIdx}-${cIdx}`]}
                                      className="bg-white border-2 border-slate-100 text-slate-600 px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition shadow-sm active:scale-95"
                                    >
                                        {loadingMap[`${mIdx}-${cIdx}`] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Select File'}
                                    </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-gray-50/50 border-t border-gray-50 flex flex-col md:flex-row justify-between gap-4">
            <button 
              onClick={onBack}
              className="px-6 py-3.5 border-2 border-slate-100 text-slate-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-sky-600 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button 
              onClick={onNext}
              className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:from-sky-700 hover:to-sky-800 transition-all shadow-xl shadow-sky-100 active:scale-[0.98]"
            >
              Confirm & Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {previewLesson && (
          <LessonPreviewEditorModal
            courseData={courseData}
            updateCourseData={updateCourseData}
            initialMIdx={previewLesson.mIdx}
            initialCIdx={previewLesson.cIdx}
            startInEdit={previewLesson.startInEdit}
            onClose={() => setPreviewLesson(null)}
          />
        )}

        {/* AI Assistant Sidebar Area */}
        <div className="col-span-12 lg:col-span-4 h-full relative lg:sticky lg:top-6 flex-shrink-0 min-w-[400px]">
          {!showSidebar ? (
            <div className="h-[800px] w-full rounded-[2rem] bg-white border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center p-8 group transition-all">
               <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquareText className="w-8 h-8 text-sky-400 opacity-50" />
               </div>
               <h3 className="text-slate-400 font-bold text-sm mb-2 uppercase tracking-tight">AI Content Workspace</h3>
               <p className="text-[10px] text-slate-300 font-medium max-w-[160px] mb-6 uppercase leading-relaxed font-bold tracking-widest">Toggle the assistant to generate lesson prompts or refine your content strategy.</p>
               <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  <span>ASK AI</span>
                </button>
            </div>
          ) : (
            <AIAssistantSidebar 
              details={courseData.details}
              courseData={courseData}
              onApply={handleApplyAISuggestion} 
              onClose={() => setShowSidebar(false)} 
              scope="Step 4: Course Content"
              initialInput={sidebarRequest}
              onGenerateAllContent={handleGenerateAllContent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const MenuBar = () => {
  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
  };
  
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 rounded-t-2xl">
      <button onClick={() => exec('bold')} className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition"><b>B</b></button>
      <button onClick={() => exec('italic')} className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition italic">I</button>
      <button onClick={() => exec('strikeThrough')} className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition line-through">S</button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button onClick={() => exec('formatBlock', 'H1')} className="p-1.5 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition">H1</button>
      <button onClick={() => exec('formatBlock', 'H2')} className="p-1.5 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition">H2</button>
      <button onClick={() => exec('formatBlock', 'H3')} className="p-1.5 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition">H3</button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button onClick={() => exec('insertUnorderedList')} className="p-1.5 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition">• List</button>
      <button onClick={() => exec('insertOrderedList')} className="p-1.5 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition">1. List</button>
    </div>
  );
};

function ContentBlock({ block, onDelete, onPreview, onEdit }) {
  const TypeIcon = CONTENT_TYPES.find(t => t.id === (block.type || 'html'))?.icon || FileJson;

  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm group/block animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-slate-50/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-sky-600 shadow-sm">
            <TypeIcon className="w-4 h-4" />
          </div>
          <div>
             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
               {block.type?.toUpperCase()} {block.source === 'ai' ? '• AI Generated' : '• Manual Upload'}
             </p>
             {block.timestamp && <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(block.timestamp).toLocaleTimeString()}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity">
          <button
            onClick={onPreview}
            className="p-1.5 text-slate-400 hover:bg-white hover:text-sky-600 rounded-lg transition"
            title="Preview lesson"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {(block.type === 'html' || block.type === 'lesson-blocks') && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg transition text-slate-400 hover:bg-white hover:text-sky-600"
              title="Edit in preview"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
