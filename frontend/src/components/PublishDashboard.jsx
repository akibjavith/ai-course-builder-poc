import React, { useState } from 'react';
import { storeCourse } from '../api';
import { Loader2, CheckCircle2, Database, ChevronLeft, Sparkles, AlertCircle, Rocket, Eye } from 'lucide-react';
import LessonPreviewModal from './LessonPreviewModal';
import ActionModal from './ActionModal';
import CourseViewer from './CourseViewer';

export default function PublishDashboard({ courseData, onBack, onComplete }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const { details, structure, content } = courseData;

  const allLessons = [];
  (structure?.modules || []).forEach((mod, mIdx) => {
    (mod?.chapters || []).forEach((chap, cIdx) => {
      allLessons.push({ mIdx, cIdx, modTitle: mod?.title, chapter: chap });
    });
  });

  const getLessonPreviewData = (mIdx, cIdx) => {
    const chap = structure?.modules?.[mIdx]?.chapters?.[cIdx];
    if (!chap) return null;
    const validContents = (chap?.contents || []).filter(c => c?.completed && c?.content);
    if (validContents.length === 0 && chap?.content?.completed && chap?.content?.content) {
        validContents.push(chap.content);
    }
    const isReady = validContents.length > 0;
    const cData = isReady ? {
        html_content: validContents.map(c => c?.content).join('<hr class="my-8 border-slate-100" />'),
        files: validContents.filter(c => c?.file_url).map(c => ({ url: c.file_url, name: c.file_name }))
    } : null;
    return { chapter: chap, content: cData, mIdx, cIdx };
  };

  const handleNextPreview = () => {
    if (!previewData) return;
    const idx = allLessons.findIndex(l => l.mIdx === previewData.mIdx && l.cIdx === previewData.cIdx);
    if (idx < allLessons.length - 1) {
      const next = allLessons[idx + 1];
      setPreviewData(getLessonPreviewData(next.mIdx, next.cIdx));
    }
  };

  const handlePrevPreview = () => {
    if (!previewData) return;
    const idx = allLessons.findIndex(l => l.mIdx === previewData.mIdx && l.cIdx === previewData.cIdx);
    if (idx > 0) {
      const prev = allLessons[idx - 1];
      setPreviewData(getLessonPreviewData(prev.mIdx, prev.cIdx));
    }
  };

  const handleSave = async () => {
    // Check if any lessons are pending
    const missingLessons = [];
    (structure?.modules || []).forEach((mod, mIdx) => {
      (mod?.chapters || []).forEach((chap, cIdx) => {
        if (!chap) return;
        const validContents = (chap?.contents || []).filter(c => c?.completed && c?.content);
        if (validContents.length === 0 && chap?.content?.completed && chap?.content?.content) {
            validContents.push(chap.content);
        }
        if (validContents.length === 0 && !chap?.content?.file_url && !(chap?.contents || []).some(c => c?.file_url)) {
          missingLessons.push(`${mod?.title || 'Unknown Module'} - ${chap?.title || 'Unknown Chapter'}`);
        }
      });
    });

    if (missingLessons.length > 0) {
      setModalConfig({
        title: 'Missing Content Detected',
        message: `You cannot publish the course yet because the following lessons are empty:\n\n${missingLessons.slice(0, 3).map(m => `• ${m}`).join('\n')}${missingLessons.length > 3 ? `\n• ...and ${missingLessons.length - 3} more.` : ''}\n\nPlease go to Step 4 to generate or upload content.`,
        type: 'warning',
        confirmText: 'Go to Content Section',
        onConfirm: () => {
          setModalConfig(null);
          onBack();
        }
      });
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await storeCourse({ course_json: courseData });
      setSaved(true);
      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (err) {
      setErrorMsg("Failed to save course. Ensure the backend is running and reachable.");
      setSaving(false);
    }
  };

  if (showFullPreview) {
    return <CourseViewer course={courseData} onBack={() => setShowFullPreview(false)} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ActionModal 
        isOpen={!!modalConfig}
        onClose={() => setModalConfig(null)}
        {...modalConfig}
      />
      {/* Step Heading */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Review & Publish</h2>
            <span className="bg-sky-50 text-sky-600 px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 shadow-sm uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Step 5 of 5
            </span>
          </div>
          <p className="text-slate-400 font-semibold text-xs tracking-wide uppercase">Final check before your course goes live.</p>
        </div>
      </div>

      {saved ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-12 text-center space-y-6 animate-scale-in overflow-hidden relative max-w-4xl mx-auto mt-12">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
           <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Rocket className="h-12 w-12 text-green-500 animate-bounce" />
           </div>
           <div className="space-y-2">
             <h3 className="text-3xl font-bold text-slate-900">Your Course is Live!</h3>
             <p className="text-slate-500 font-medium text-sm">Redirecting you to the dashboard to see your masterpiece...</p>
           </div>
           <div className="flex justify-center gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-green-200 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
              ))}
           </div>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
               <AlertCircle className="w-5 h-5 flex-shrink-0" />
               {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-12 gap-8 h-[750px]">
            {/* Main Summary Section - Left (col-span-8) */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full">
              <div className="p-8 flex-1 overflow-y-auto no-scrollbar space-y-8">
                {/* Course Identity Card */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Course Identity</label>
                    <h3 className="text-2xl font-bold text-slate-900 leading-tight">{details?.title || "Untitled Course"}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{details?.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="bg-sky-50 text-sky-600 px-4 py-1.5 rounded-xl text-[10px] font-bold border border-sky-100 uppercase tracking-tight">{courseData?.sourceType || 'Custom'} Source</span>
                    <span className="bg-slate-50 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-bold border border-slate-100 uppercase tracking-tight">{details?.difficulty || 'All Levels'}</span>
                    <span className="bg-slate-50 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-bold border border-slate-100 uppercase tracking-tight">{details?.duration || 'Flexible Duration'}</span>
                    <span className="bg-slate-50 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-bold border border-slate-100 uppercase tracking-tight">For: {details?.target_audience || 'Everyone'}</span>
                  </div>
                </div>

                {/* Curriculum Section */}
                <div className="space-y-4 pt-6 border-t border-slate-50">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Curriculum Breakdown</label>
                   <div className="grid gap-4">
                     {(structure?.modules || []).map((mod, i) => (
                       <div key={i} className="group p-5 bg-slate-50/50 hover:bg-white border border-transparent hover:border-sky-100 rounded-3xl transition-all shadow-sm hover:shadow-md">
                         <div className="flex justify-between items-center mb-4">
                           <h5 className="font-bold text-slate-800 text-sm">{mod?.title || 'Untitled Module'}</h5>
                           <span className="text-[9px] font-bold text-slate-400 bg-white px-2.5 py-1 rounded-xl border border-slate-100 uppercase tracking-wider">Module {i+1}</span>
                         </div>
                         <div className="space-y-2">
                           {(mod?.chapters || []).map((chap, j) => {
                              // Filter out draft/empty content blocks.
                              if (!chap) return null;
                              const validContents = (chap?.contents || []).filter(c => c?.completed && c?.content);
                              if (validContents.length === 0 && chap?.content?.completed && chap?.content?.content) {
                                  validContents.push(chap.content);
                              }
                              
                              const isReady = validContents.length > 0;
                              
                                return (
                                  <button 
                                    key={j} 
                                    onClick={() => setPreviewData(getLessonPreviewData(i, j))}
                                    className="w-full flex justify-between items-center text-[11px] py-2.5 px-4 rounded-2xl bg-white border border-slate-100/50 shadow-sm hover:border-sky-200 hover:bg-sky-50/30 transition-all group/chap"
                                  >
                                  <span className="font-semibold text-slate-600 flex items-center gap-2">
                                    <Eye className="w-3 h-3 opacity-0 group-hover/chap:opacity-100 transition-opacity text-sky-500" />
                                    {chap?.title || 'Untitled Lesson'}
                                  </span>
                                  {isReady ? (
                                    <span className="flex items-center gap-1.5 text-green-500 font-bold uppercase text-[9px] tracking-wide">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 text-amber-500 font-bold uppercase text-[9px] tracking-wide animate-pulse">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pending
                                    </span>
                                  )}
                                </button>
                              );
                           })}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
                <button 
                  onClick={onBack} 
                  disabled={saving}
                  className="px-6 py-3.5 border-2 border-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-white hover:text-sky-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" /> Edit Content
                </button>
                
                <button 
                  onClick={() => setShowFullPreview(true)} 
                  disabled={saving}
                  className="px-6 py-3.5 bg-sky-50 text-sky-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-sky-100 transition-all active:scale-95 disabled:opacity-50 border border-sky-100 shadow-sm"
                >
                  <Eye className="w-4 h-4" /> Full Course Preview
                </button>
              </div>
            </div>

            {/* Sidebar Publish Section - Right (col-span-4) */}
            <div className="col-span-12 lg:col-span-4 h-full relative flex flex-col gap-6 min-w-[400px]">
              <div className="bg-sky-600 rounded-[2rem] p-10 text-white shadow-2xl shadow-sky-100 relative overflow-hidden group flex-1 flex flex-col justify-center">
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl"></div>
                  
                  <div className="relative z-10 space-y-8">
                    <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md shadow-xl border border-white/10">
                       <Rocket className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-3">
                       <h3 className="text-3xl font-bold leading-tight text-white tracking-tight">Ready to Launch!</h3>
                       <p className="text-sky-100 text-sm font-medium leading-relaxed">Your course is fully assembled. Publish it now to share your expertise with the world.</p>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                      <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-white text-sky-600 hover:bg-sky-50 px-6 py-5 rounded-[1.5rem] font-bold uppercase text-xs tracking-[0.15em] shadow-2xl shadow-sky-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {saving ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Finalizing...</>
                        ) : (
                          <><Database className="w-5 h-5" /> Publish Course</>
                        )}
                      </button>
                      
                      <div className="flex items-center gap-3 px-2">
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-sky-600 bg-sky-400"></div>)}
                        </div>
                        <span className="text-[10px] font-bold text-sky-200 uppercase tracking-widest">Join 1000+ Instructors</span>
                      </div>
                    </div>
                  </div>
              </div>

              {/* Extra Info Card (to match sidebar height feel) */}
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-lg flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                 </div>
                 <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Verification Passed</h4>
                    <p className="text-[10px] text-slate-400 font-medium">All modules and chapters have validated AI content.</p>
                 </div>
              </div>
            </div>
          </div>
        </>
      )}

      {previewData && (
        <LessonPreviewModal 
          chapter={previewData.chapter}
          chapterContent={previewData.content}
          onClose={() => setPreviewData(null)}
          onNext={handleNextPreview}
          onPrev={handlePrevPreview}
          hasNext={allLessons.findIndex(l => l.mIdx === previewData.mIdx && l.cIdx === previewData.cIdx) < allLessons.length - 1}
          hasPrev={allLessons.findIndex(l => l.mIdx === previewData.mIdx && l.cIdx === previewData.cIdx) > 0}
        />
      )}
    </div>
  );
}


