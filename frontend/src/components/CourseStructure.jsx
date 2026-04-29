import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ChevronDown, ChevronRight, Edit3, GripVertical, 
  Sparkles, MessageSquareText, FileJson, ChevronLeft, Loader2, AlertCircle, 
  X, CheckCircle2, MoreVertical
} from 'lucide-react';
import AIAssistantSidebar from './AIAssistantSidebar';
import { generateStructure } from '../api';

export default function CourseStructure({ courseData, updateCourseData, onNext, onBack }) {
  const [structure, setStructure] = useState(courseData.structure || { modules: [] });
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedModules, setExpandedModules] = useState({});
  const [editingModuleIdx, setEditingModuleIdx] = useState(null);
  const [editingLessonIdx, setEditingLessonIdx] = useState({ modIdx: null, chapIdx: null });

  const toggleModule = (idx) => {
    setExpandedModules(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const updateGlobalStructure = (newStructure) => {
    setStructure(newStructure);
    updateCourseData('structure', newStructure);
  };

  const handleAddModule = () => {
    const newModules = [...structure.modules, { title: 'New Module', chapters: [] }];
    updateGlobalStructure({ ...structure, modules: newModules });
  };

  const handleRemoveModule = (modIdx) => {
    const newModules = structure.modules.filter((_, i) => i !== modIdx);
    updateGlobalStructure({ ...structure, modules: newModules });
  };

  const handleModuleTitleChange = (modIdx, title) => {
    const newModules = [...structure.modules];
    newModules[modIdx].title = title;
    updateGlobalStructure({ ...structure, modules: newModules });
  };

  const handleAddChapter = (modIdx) => {
    const newModules = [...structure.modules];
    newModules[modIdx].chapters.push({ title: 'New Lesson' });
    updateGlobalStructure({ ...structure, modules: newModules });
    // Auto-expand if adding a lesson
    setExpandedModules(prev => ({ ...prev, [modIdx]: true }));
  };

  const handleRemoveChapter = (modIdx, chapIdx) => {
    const newModules = [...structure.modules];
    newModules[modIdx].chapters = newModules[modIdx].chapters.filter((_, i) => i !== chapIdx);
    updateGlobalStructure({ ...structure, modules: newModules });
  };

  const handleChapterTitleChange = (modIdx, chapIdx, title) => {
    const newModules = [...structure.modules];
    newModules[modIdx].chapters[chapIdx].title = title;
    updateGlobalStructure({ ...structure, modules: newModules });
  };

  const handleApplyAISuggestion = (suggestion) => {
    if (suggestion.modules) {
      updateGlobalStructure({ ...structure, modules: suggestion.modules });
    }
  };

  const handleImportSyllabus = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          if (json.modules) {
            updateGlobalStructure(json);
          } else {
            setError("Invalid syllabus format. Expected { 'modules': [...] }");
          }
        } catch (err) {
          setError("Failed to parse JSON syllabus.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-bounce shadow-sm">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           {error}
           <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 h-[750px]">
        {/* Main Content Section */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full">
          <div className="p-6 md:p-8 flex-1 scroll-smooth overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Course Structure</h2>
                  <span className="bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-600 px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI ENHANCED
                  </span>
                </div>
                <p className="text-slate-400 font-semibold text-[10px] tracking-wide uppercase">Create and organize your course curriculum structure.</p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" /> 
                  <span>ASK AI</span>
                </button>
                <button 
                  onClick={handleImportSyllabus}
                  className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95 group"
                >
                  <FileJson className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500" /> 
                  <span>Import Syllabus</span>
                </button>
              </div>
            </div>

            {/* Structure List */}
            <div className="space-y-4">
              {!structure.modules.length ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100 h-full">
                  <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm flex items-center justify-center mb-2">
                    <Sparkles className="w-10 h-10 text-sky-400 opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-slate-900 font-bold text-lg uppercase tracking-tight">Empty Structure</h3>
                    <p className="text-slate-400 text-[11px] font-bold max-w-xs uppercase tracking-widest leading-loose">Your Course Curriculum is empty, Use Ask AI or Create Module Manually.</p>
                  </div>
                  <button 
                    onClick={handleAddModule}
                    className="mt-4 flex items-center gap-2 bg-white border-2 border-sky-100 text-sky-600 px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-50 transition shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Add Module
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {structure.modules.map((mod, modIdx) => (
                    <div key={modIdx} className="group animate-scale-in">
                      {/* Module Header */}
                      <div className={`
                        flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all duration-300
                        ${expandedModules[modIdx] ? 'bg-white border-sky-100 shadow-lg shadow-sky-50' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-100'}
                      `}>
                        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                        </div>
                        <button 
                          onClick={() => toggleModule(modIdx)}
                          className={`p-1.5 rounded-lg transition-colors ${expandedModules[modIdx] ? 'bg-sky-50 text-sky-600' : 'bg-white text-slate-400'}`}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedModules[modIdx] ? '' : '-rotate-90'}`} />
                        </button>
                        
                        <div className="flex-1 flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 min-w-[1.5rem]">{modIdx + 1}.</span>
                          <input 
                            type="text" 
                            value={mod.title}
                            readOnly={editingModuleIdx !== modIdx}
                            onChange={(e) => handleModuleTitleChange(modIdx, e.target.value)}
                            onBlur={() => setEditingModuleIdx(null)}
                            onKeyPress={(e) => e.key === 'Enter' && setEditingModuleIdx(null)}
                            autoFocus={editingModuleIdx === modIdx}
                            className={`bg-transparent border-none focus:ring-0 outline-none text-sm font-bold w-full p-0 transition-colors ${editingModuleIdx === modIdx ? 'text-sky-600' : 'text-slate-800'}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="bg-sky-50 text-sky-600 px-3 py-1 rounded-lg text-[10px] font-bold border border-sky-100/50">
                            {mod.chapters?.length || 0} Lessons
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingModuleIdx(modIdx)}
                              className={`p-2 rounded-xl transition-all ${editingModuleIdx === modIdx ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50'}`}
                              title="Edit Title"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemoveModule(modIdx)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete Module"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chapters (Lessons) */}
                      {expandedModules[modIdx] && (
                        <div className="ml-14 mt-2 space-y-2 pb-2">
                          {mod.chapters?.map((chap, chapIdx) => (
                            <div key={chapIdx} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-50 group/lesson hover:border-sky-50 hover:shadow-sm transition-all">
                              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover/lesson:bg-sky-50 transition-colors">
                                <FileJson className="w-3.5 h-3.5 text-slate-400 group-hover/lesson:text-sky-500" />
                              </div>
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-300">{modIdx + 1}.{chapIdx + 1}</span>
                                <input 
                                  type="text" 
                                  value={chap.title}
                                  readOnly={editingLessonIdx.modIdx !== modIdx || editingLessonIdx.chapIdx !== chapIdx}
                                  onChange={(e) => handleChapterTitleChange(modIdx, chapIdx, e.target.value)}
                                  onBlur={() => setEditingLessonIdx({ modIdx: null, chapIdx: null })}
                                  onKeyPress={(e) => e.key === 'Enter' && setEditingLessonIdx({ modIdx: null, chapIdx: null })}
                                  autoFocus={editingLessonIdx.modIdx === modIdx && editingLessonIdx.chapIdx === chapIdx}
                                  className={`bg-transparent border-none focus:ring-0 outline-none text-xs font-medium w-full p-0 transition-colors ${editingLessonIdx.modIdx === modIdx && editingLessonIdx.chapIdx === chapIdx ? 'text-sky-500 font-bold' : 'text-slate-600'}`}
                                />
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setEditingLessonIdx({ modIdx, chapIdx })}
                                  className={`p-1.5 transition-colors ${editingLessonIdx.modIdx === modIdx && editingLessonIdx.chapIdx === chapIdx ? 'text-sky-500' : 'text-slate-300 hover:text-sky-400'}`}
                                  title="Edit Lesson"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleRemoveChapter(modIdx, chapIdx)}
                                  className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                                  title="Delete Lesson"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => handleAddChapter(modIdx)}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-50 text-slate-400 hover:border-sky-100 hover:text-sky-500 hover:bg-sky-50/30 transition-all text-[10px] font-bold uppercase tracking-widest"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Lesson
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Module Button */}
                  <button 
                    onClick={handleAddModule}
                    className="w-full flex items-center justify-center gap-3 p-6 rounded-[2rem] border-2 border-dashed border-slate-100 text-slate-400 hover:border-sky-200 hover:text-sky-600 hover:bg-sky-50/50 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Add Module</span>
                  </button>
                </div>
              )}
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
              disabled={!structure.modules.length}
              className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:from-sky-700 hover:to-sky-800 transition-all shadow-xl shadow-sky-100 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              Confirm & Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Assistant Sidebar Area */}
        <div className="col-span-12 lg:col-span-4 h-full relative lg:sticky lg:top-6">
          {!showSidebar ? (
            <div className="h-[750px] rounded-[2rem] bg-white border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center p-8 group transition-all">
               <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquareText className="w-8 h-8 text-sky-400 opacity-50" />
               </div>
               <h3 className="text-slate-400 font-bold text-sm mb-2">AI Assistant Workspace</h3>
               <p className="text-[10px] text-slate-300 font-medium max-w-[160px] mb-6">Toggle the assistant to brainstorm or refine your course structure.</p>
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
              scope="Step 3: Course Structure"
            />
          )}
        </div>
      </div>
    </div>
  );
}
