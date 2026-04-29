import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, ChevronDown, ChevronRight, Edit3, GripVertical, 
  Sparkles, MessageSquareText, FileJson, ChevronLeft, Loader2, AlertCircle, 
  X, CheckCircle2, MoreVertical, Bot, Upload, Code, FileText, Presentation, 
  Video, Volume2, HelpCircle, CheckSquare, RefreshCw, Zap, Settings2, Eye
} from 'lucide-react';
import AIAssistantSidebar from './AIAssistantSidebar';
import { generateLessonContent, uploadChapterMedia } from '../api';

const CONTENT_TYPES = [
  { id: 'html', label: 'HTML', icon: Code, color: 'text-sky-500', bg: 'bg-sky-50', disabled: false },
  { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'ppt', label: 'PPT', icon: Presentation, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'video', label: 'Video', icon: Video, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'audio', label: 'Audio', icon: Volume2, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
  { id: 'assessment', label: 'Assessment', icon: CheckSquare, color: 'text-slate-300', bg: 'bg-slate-50', disabled: true },
];

export default function CourseContent({ courseData, updateCourseData, onNext, onBack }) {
  const [aiMode, setAiMode] = useState(true);
  const [expandedLesson, setExpandedLesson] = useState(null); // { mIdx, cIdx }
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingMap, setLoadingMap] = useState({});
  const [error, setError] = useState('');
  const [sidebarRequest, setSidebarRequest] = useState('');
  const fileInputRef = useRef(null);

  // Sync state helper
  const updateLessonContent = (mIdx, cIdx, updates) => {
    const newModules = [...(courseData.structure?.modules || [])];
    if (newModules[mIdx] && newModules[mIdx].chapters[cIdx]) {
      const currentContent = newModules[mIdx].chapters[cIdx].content || {};
      newModules[mIdx].chapters[cIdx].content = { ...currentContent, ...updates };
      updateCourseData('structure', { ...courseData.structure, modules: newModules });
    }
  };

  const handleApplyAISuggestion = (suggestion) => {
    if (suggestion.prompts && Array.isArray(suggestion.prompts)) {
      // Create a deep copy to avoid mutations
      const newModules = (courseData.structure?.modules || []).map(mod => ({
        ...mod,
        chapters: (mod.chapters || []).map(chap => {
          const matchingPrompt = suggestion.prompts.find(p => p && (p.title === chap.title || p.lesson === chap.title))?.prompt;
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
    } else if (suggestion.prompt && expandedLesson) {
      updateLessonContent(expandedLesson.mIdx, expandedLesson.cIdx, { prompt: suggestion.prompt, source: 'ai' });
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
      updateLessonContent(mIdx, cIdx, { completed: true, ...res });
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
      updateLessonContent(mIdx, cIdx, { 
        completed: true, 
        source: 'manual',
        file_url: res.url,
        file_name: file.name
      });
    } catch (err) {
      setError("Failed to upload file.");
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRegeneratePrompt = (lesson) => {
    const prompt = `Please generate a high-quality AI content generation prompt ONLY for the lesson: "${lesson.title}" in the module: "${modules[expandedLesson.mIdx].title}". 
    The course is about: "${courseData.details?.title}". 
    Target Audience: "${courseData.details?.target_audience}".
    Desired Focus: Practical, engaging, and highly detailed.
    Return ONLY the metadata for this single lesson. Schema: { "prompt": "..." }`;
    
    setSidebarRequest({ 
      text: prompt, 
      display: "Regenerate Lesson Prompt", 
      fillInput: false 
    });
    setShowSidebar(true);
    // Reset trigger after a short delay so it can be re-triggered
    setTimeout(() => setSidebarRequest(null), 100);
  };

  const modules = courseData.structure?.modules || [];

  return (
    <div className="animate-fade-in space-y-6">
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

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" /> 
                  <span>ASK AI</span>
                </button>
                <button className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95">
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" /> 
                  <span>Bulk Actions</span>
                </button>
              </div>
            </div>

            {/* AI Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-50/50 p-5 rounded-2xl border border-slate-100 mb-8">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Mode</span>
                   <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
                      <button 
                        onClick={() => setAiMode(true)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${aiMode ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                      >ON</button>
                      <button 
                        onClick={() => setAiMode(false)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!aiMode ? 'bg-slate-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                      >OFF</button>
                   </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {aiMode ? 'AI will generate content and prompts for all lessons.' : 'AI features are disabled. Please upload content manually.'}
                </p>
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
                              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-bold border transition-colors ${chap.content?.source === 'ai' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                  {chap.content?.source === 'ai' ? 'AI: ' : 'UPLOAD: '}{(chap.content?.type || 'html').toUpperCase()}
                                  {chap.content?.completed && <CheckCircle2 className="w-3 h-3 text-green-500 ml-1" />}
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
                          <div className="mt-4 p-6 bg-white border border-sky-50 rounded-[2rem] space-y-8 animate-in slide-in-from-top-2 duration-300 shadow-sm">
                            {/* Source & Type Section */}
                            <div className={`grid grid-cols-1 ${aiMode ? 'lg:grid-cols-2' : ''} gap-8`}>
                              {/* Content Source */}
                              <div className="space-y-3">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Content Source</label>
                                  <div className={`grid ${aiMode ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                    {aiMode && (
                                      <button 
                                        onClick={() => updateLessonContent(mIdx, cIdx, { source: 'ai' })}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 ${chap.content?.source === 'ai' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                      >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${chap.content?.source === 'ai' ? 'bg-sky-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className={`text-[11px] font-bold ${chap.content?.source === 'ai' ? 'text-sky-700' : 'text-slate-700'}`}>AI Generated (Default)</p>
                                            <p className="text-[9px] text-slate-400 font-medium leading-tight">Let AI generate content.</p>
                                        </div>
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => updateLessonContent(mIdx, cIdx, { source: 'manual' })}
                                      className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 ${chap.content?.source === 'manual' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                    >
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${chap.content?.source === 'manual' ? 'bg-sky-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                          <Upload className="w-4 h-4" />
                                      </div>
                                      <div className="space-y-0.5">
                                          <p className={`text-[11px] font-bold ${chap.content?.source === 'manual' ? 'text-sky-700' : 'text-slate-700'}`}>Upload Manually</p>
                                          <p className="text-[9px] text-slate-400 font-medium leading-tight">Upload your own file.</p>
                                      </div>
                                    </button>
                                  </div>
                              </div>

                              {/* Content Type - Only visible in AI Mode and if source is AI */}
                              {aiMode && chap.content?.source === 'ai' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Content Type</label>
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

                            {/* AI Prompt Section - Only visible in AI Mode and if source is AI */}
                            {aiMode && chap.content?.source === 'ai' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Prompt</label>
                                      <HelpCircle className="w-3 h-3 text-slate-300" />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{(chap.content?.prompt || '').length}/2000 characters</span>
                                </div>
                                <div className="relative group">
                                    <textarea 
                                      value={chap.content?.prompt || ''}
                                      onChange={(e) => updateLessonContent(mIdx, cIdx, { prompt: e.target.value })}
                                      className="w-full bg-slate-50/50 border-2 border-slate-50 rounded-2xl p-5 text-[11px] text-slate-700 font-medium min-h-[140px] focus:ring-0 focus:border-sky-100 transition-all outline-none resize-none leading-relaxed"
                                      placeholder="Describe what content AI should generate for this specific lesson..."
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
                                          {chap.content?.completed ? 'Regenerate Content' : 'Generate Content'}
                                      </button>
                                    </div>
                                </div>
                              </div>
                            )}

                            {/* Manual Upload State */}
                            {(!aiMode || chap.content?.source === 'manual') && (
                              <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
                                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                                    <Upload className="w-8 h-8 text-slate-300" />
                                  </div>
                                  <div className="text-center space-y-1 mb-6">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Manual upload is enabled
                                    </p>
                                    <p className="text-[10px] text-slate-300 font-medium">Attach your source file for this lesson.</p>
                                  </div>
                                  
                                  {chap.content?.file_name ? (
                                    <div className="flex items-center gap-3 bg-white border border-slate-100 px-4 py-2 rounded-xl shadow-sm">
                                      <FileJson className="w-4 h-4 text-sky-400" />
                                      <span className="text-xs font-bold text-slate-600">{chap.content.file_name}</span>
                                      <button onClick={() => updateLessonContent(mIdx, cIdx, { file_name: null, file_url: null, completed: false })} className="p-1 hover:bg-slate-50 rounded-lg transition text-slate-400"><X className="w-3 h-3" /></button>
                                    </div>
                                  ) : (
                                    <>
                                      <input 
                                        type="file" 
                                        id={`file-upload-${mIdx}-${cIdx}`}
                                        className="hidden" 
                                        onChange={(e) => handleFileUpload(e, mIdx, cIdx)} 
                                      />
                                      <button 
                                        onClick={() => document.getElementById(`file-upload-${mIdx}-${cIdx}`).click()}
                                        className="bg-white border-2 border-slate-100 text-slate-600 px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition shadow-sm active:scale-95"
                                      >
                                          Select File
                                      </button>
                                    </>
                                  )}
                              </div>
                            )}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
