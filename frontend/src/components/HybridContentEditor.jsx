import React, { useState } from 'react';
import { uploadChapterMedia, startAsyncGeneration, checkAsyncStatus } from '../api';
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, Video, FileText, Bot, Upload, PlayCircle, RefreshCw, Sparkles } from 'lucide-react';
import ChapterEditor from './ChapterEditor';
import ModuleAssessmentBox from './ModuleAssessmentBox';
import QuizViewer from './QuizViewer';

export default function HybridContentEditor({ courseData, updateCourseData, onNext, onBack }) {
  const { structure, details, sourceType, content = [] } = courseData;
  const [loadingMap, setLoadingMap] = useState({});
  const [expandedChapter, setExpandedChapter] = useState(null);
  
  // Global progress state
  const [globalProgress, setGlobalProgress] = useState({ active: false, current: 0, total: 0, status: '' });

  // local form states for manual entry
  const [manualLinks, setManualLinks] = useState({});

  // Flatten chapters to track completed status easier
  const flatChapters = [];
  (structure.modules || []).forEach((mod, mIdx) => {
    (mod.chapters || []).forEach((chap, lIdx) => {
      flatChapters.push({
        moduleIdx: mIdx,
        lessonIdx: lIdx,
        moduleTitle: mod.title,
        chapterTitle: chap.title
      });
    });
  });

  const saveContentEntry = (entry) => {
    // We update the content array 
    const updatedContent = [...(courseData.content || [])];
    const existingIdx = updatedContent.findIndex(c => c.module_title === entry.module_title && c.title === entry.title);
    if (existingIdx >= 0) {
       updatedContent[existingIdx] = entry;
    } else {
       updatedContent.push(entry);
    }
    updateCourseData('content', updatedContent);
  };

  const handleSaveChapterContent = (modIdx, chapIdx, contentObj) => {
    const modules = [...(courseData.structure.modules || [])];
    if (modules[modIdx] && modules[modIdx].chapters[chapIdx]) {
      modules[modIdx].chapters[chapIdx].content = contentObj;
      updateCourseData('structure', { ...courseData.structure, modules });

      // Also sync to global content array for CourseViewer
      const entry = {
        module_title: modules[modIdx].title,
        title: modules[modIdx].chapters[chapIdx].title,
        explanation: contentObj.explanation,
        flashcards: contentObj.flashcards,
        mcqs: contentObj.mcqs,
        audio_url: contentObj.audio_url,
        files: contentObj.files || [],
        content_type: contentObj.content_type || (contentObj.explanation ? 'ai_generated' : 'document')
      };
      saveContentEntry(entry);
    }
  };

  const getChapContent = (moduleTitle, chapterTitle) => {
    return (courseData.content || []).find(c => c.module_title === moduleTitle && c.title === chapterTitle);
  };

  const isCompleted = (moduleTitle, chapterTitle) => {
    return !!getChapContent(moduleTitle, chapterTitle);
  };

  // --- MANUAL UPLOAD LOGIC ---
  const handleManualSave = (chapInfo, type) => {
      const key = `${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`;
      const url = manualLinks[key];
      if (!url) return alert("Please enter a valid URL first.");

      saveContentEntry({
         module_title: chapInfo.moduleTitle,
         title: chapInfo.chapterTitle,
         content_type: type, // 'video' or 'document'
         video_url: type === 'video' ? url : null,
         document_url: type === 'document' ? url : null,
         explanation: null,
         examples: null,
         key_points: null,
         voice_script: null,
         image_url: null
      });
      setExpandedChapter(null);
  };

  const handleFileUpload = async (event, chapInfo, type) => {
      const file = event.target.files[0];
      if (!file) return;

      const key = `${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`;
      setLoadingMap(prev => ({ ...prev, [key]: true }));
      try {
          const res = await uploadChapterMedia(file);
          const url = res.url;
          
          saveContentEntry({
               module_title: chapInfo.moduleTitle,
               title: chapInfo.chapterTitle,
               content_type: type,
               video_url: type === 'video' ? url : null,
               document_url: type === 'document' ? url : null,
               explanation: null,
               examples: null,
               key_points: null,
               voice_script: null,
               image_url: null
          });
          setExpandedChapter(null);
      } catch (err) {
          alert("Failed to upload file. Make sure FastAPI has the /uploads dir configured.");
      } finally {
          setLoadingMap(prev => ({ ...prev, [key]: false }));
      }
  };

  // --- AUTOMATED PARALLEL PIPELINE ---
  const handleAutoGeneratePending = async () => {
    const pendingJobs = flatChapters.filter(c => !isCompleted(c.moduleTitle, c.chapterTitle));
    if (pendingJobs.length === 0) return;

    setGlobalProgress({ active: true, current: 0, total: pendingJobs.length, status: 'Initializing generation...' });

    try {
       const resp = await startAsyncGeneration({
           jobs: pendingJobs,
           course_title: details.title,
           course_format: details.course_format || 'video',
           source_type: sourceType,
           audience: details.target_audience || "Everyone",
           difficulty: details.difficulty || "beginner",
           objectives: details.learning_objectives || [],
           modules: structure.modules || []
       });

       const taskId = resp.task_id;
       
       const interval = setInterval(async () => {
           try {
               const statusResp = await checkAsyncStatus(taskId);
               setGlobalProgress({ 
                   active: true, 
                   current: Math.round((statusResp.progress / 100) * pendingJobs.length), 
                   total: pendingJobs.length, 
                   status: statusResp.message 
               });

               if (statusResp.status === 'completed') {
                   clearInterval(interval);
                   // Merge results
                   const newContent = [...(courseData.content || [])];
                   statusResp.result.content.forEach(c => newContent.push(c));
                   updateCourseData('content', newContent);
                   if (statusResp.result.quiz) {
                       updateCourseData('quiz', statusResp.result.quiz);
                   }
                   setGlobalProgress({ active: false, current: pendingJobs.length, total: pendingJobs.length, status: 'All AI lessons and Quiz completed!' });
               } else if (statusResp.status === 'failed') {
                   clearInterval(interval);
                   setGlobalProgress(prev => ({ ...prev, active: false, status: 'Process failed: ' + statusResp.message }));
                   alert("Generation failed: " + statusResp.message);
               }
           } catch (pollErr) {
               console.error("Polling error", pollErr);
           }
       }, 3000);
    } catch (e) {
       setGlobalProgress(prev => ({ ...prev, active: false, status: 'Failed to start generation.' }));
       alert("Failed to start generation.");
    }
  };

  const handleRegenerateLesson = async (chapInfo) => {
    // Unset current content completely to force re-evaluation
    const updatedContent = [...(courseData.content || [])];
    const filtered = updatedContent.filter(c => !(c.module_title === chapInfo.moduleTitle && c.title === chapInfo.chapterTitle));
    updateCourseData('content', filtered);
    
    setLoadingMap(prev => ({ ...prev, [`${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`]: true }));
    
    try {
        const resp = await startAsyncGeneration({
            jobs: [chapInfo],
            course_title: details.title,
            course_format: details.course_format || 'video',
            source_type: sourceType,
            audience: details.target_audience || "Everyone",
            difficulty: details.difficulty || "beginner",
            objectives: details.learning_objectives || [],
            modules: []
        });

        const taskId = resp.task_id;
        
        const interval = setInterval(async () => {
            try {
                const statusResp = await checkAsyncStatus(taskId);
                if (statusResp.status === 'completed') {
                    clearInterval(interval);
                    const newContent = [...filtered];
                    statusResp.result.content.forEach(c => newContent.push(c));
                    updateCourseData('content', newContent);
                    setLoadingMap(prev => ({ ...prev, [`${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`]: false }));
                } else if (statusResp.status === 'failed') {
                    clearInterval(interval);
                    setLoadingMap(prev => ({ ...prev, [`${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`]: false }));
                    alert("Regeneration failed: " + statusResp.message);
                }
            } catch (err) {
                console.error("Poll err", err);
            }
        }, 3000);

    } catch (e) {
      alert("Failed to regenerate lesson.");
      setLoadingMap(prev => ({ ...prev, [`${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`]: false }));
    }
  };


  const allGenerated = flatChapters.length > 0 && flatChapters.every(c => isCompleted(c.moduleTitle, c.chapterTitle));

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Content Processing
            <span className="bg-sky-50 text-sky-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-sky-100 uppercase tracking-widest">Step 4</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm">Automatically generate all course content or manually upload custom materials.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Scope</label>
          <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-600 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-sky-100 shadow-sm">
             <Sparkles className="w-3 h-3" />
             Course Content
          </div>
        </div>
      </div>

      {/* GLOBAL PROGRESS CARD */}
      <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl shadow-sm mb-8 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
           <Bot className="w-24 h-24" />
         </div>
         <h3 className="font-bold text-indigo-900 mb-2 flex items-center text-lg">
           <PlayCircle className="w-5 h-5 mr-2 text-indigo-600" /> Auto-Generate AI Content
         </h3>
         <p className="text-sm text-indigo-700 mb-4 max-w-xl">
           Clicking the button below will instruct the AI to process all pending lessons simultaneously, generating textual content, text-to-speech scripts, and educational images.
         </p>

         {globalProgress.active ? (
           <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold text-indigo-800 mb-1.5">
                <span>{globalProgress.status}</span>
                <span>{Math.round((globalProgress.current / globalProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out flex items-center justify-end" 
                  style={{ width: `${(globalProgress.current / globalProgress.total) * 100}%` }}
                ></div>
              </div>
           </div>
         ) : (
           <button 
               onClick={handleAutoGeneratePending}
               disabled={allGenerated || flatChapters.length === 0}
               className="bg-indigo-600 text-white px-5 py-2.5 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center shadow-sm transition"
           >
               {allGenerated ? 'All Content Generated!' : 'Generate All Pending Lessons'}
           </button>
         )}
      </div>

      {/* CHAPTER LIST - NEW INTEGRATED EDITOR */}
      <div className="space-y-12 mb-12">
        {(structure.modules || []).map((mod, mIdx) => (
          <div key={mIdx} className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-indigo-200 pb-2">
               <h3 className="text-2xl font-bold text-indigo-900">{mod.title}</h3>
               <ModuleAssessmentBox 
                  mIdx={mIdx} 
                  mod={mod} 
                  courseTitle={details.title} 
                  assessmentText={structure.settings?.assessmentText} 
                  onAssessmentSaved={(mcqs) => {
                     const newModules = [...structure.modules];
                     newModules[mIdx].assessment = mcqs;
                     updateCourseData('structure', { ...structure, modules: newModules });
                  }}
               />
            </div>
            
            {mod.assessment && (
               <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-indigo-100">
                  <QuizViewer questions={mod.assessment} title={`${mod.title} Assessment`} />
               </div>
            )}

            <div className="space-y-6 pl-4 border-l-4 border-indigo-100 mt-6 font-sans">
               {(mod.chapters || []).map((chap, cIdx) => (
                  <ChapterEditor 
                     key={cIdx} 
                     courseTitle={details.title}
                     moduleTitle={mod.title}
                     chapter={chap}
                     courseData={courseData}
                     onSave={(contentObj) => handleSaveChapterContent(mIdx, cIdx, contentObj)}
                     onRegenerate={() => {}} // Could link to specific regenerate logic if needed
                  />
               ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between pt-4 border-t border-gray-200">
        <button onClick={onBack} disabled={globalProgress.active} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50 transition disabled:opacity-50">
          Back
        </button>
        <button 
        onClick={() => {
          // Validation: Ensure every chapter has EITHER AI text OR files set
          const modules = structure.modules || [];
          let missing = [];
          modules.forEach(m => {
            m.chapters.forEach(c => {
              const hasText = c.content?.explanation && c.content.explanation.length > 200;
              const hasFiles = c.content?.files && c.content.files.length > 0;
              if (!hasText && !hasFiles) {
                missing.push(`${m.title}: ${c.title}`);
              }
            });
          });

          if (missing.length > 0) {
            alert("The following chapters are missing content: \n\n" + missing.join("\n") + "\n\nPlease generate AI text or upload a file/link for each.");
            return;
          }
          onNext();
        }}
          disabled={globalProgress.active}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 transition shadow-sm"
        >
          Next: Review Final Course
        </button>
      </div>
    </div>
  );
}
