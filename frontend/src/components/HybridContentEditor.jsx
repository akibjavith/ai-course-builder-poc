import React, { useState } from 'react';
import { uploadChapterMedia, startAsyncGeneration, checkAsyncStatus } from '../api';
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, Video, FileText, Bot, Upload, PlayCircle, RefreshCw } from 'lucide-react';

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
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-2">Step 2: Content Processing</h2>
      <p className="text-sm text-gray-600 mb-6">Automatically generate all course content in parallel using AI, or manually upload custom videos and documents for specific chapters.</p>

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

      {/* CHAPTER LIST ACCORDION */}
      <div className="space-y-4 mb-8">
        <h4 className="font-semibold text-gray-800 border-b pb-2">Manual Overrides & Details</h4>
        {flatChapters.map((c, i) => {
          const key = `${c.moduleTitle}-${c.chapterTitle}`;
          const isGeneratingChap = loadingMap[key];
          const hasContent = isCompleted(c.moduleTitle, c.chapterTitle);
          const expanded = expandedChapter === key;
          const chapData = getChapContent(c.moduleTitle, c.chapterTitle);

          return (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow transition">
              <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 bg-white"
                onClick={() => setExpandedChapter(expanded ? null : key)}
              >
                <div className="flex items-center">
                  {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 mr-2" /> : <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />}
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 truncate">{c.moduleTitle}</span>
                  <span className="text-sm font-medium text-gray-900 ml-4">{c.chapterTitle}</span>
                </div>
                
                <div className="flex items-center">
                   {hasContent && <CheckCircle2 className="h-5 w-5 text-green-500 mr-4" />}
                   {hasContent && (
                       <span className="mr-4 text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600 uppercase tracking-wider">
                          {chapData.content_type === 'ai_generated' ? 'AI Generated' : 'Manual Upload'}
                       </span>
                   )}
                   {!hasContent && (
                       <span className="mr-4 text-xs font-medium px-2 py-1 bg-orange-50 text-orange-600 rounded uppercase tracking-wider">
                          Pending
                       </span>
                   )}
                   <span className="text-sm text-indigo-600 font-medium">{expanded ? "Close" : "Edit"}</span>
                </div>
              </div>

              {expanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm">
                   
                   {hasContent && chapData.content_type === 'ai_generated' ? (
                       <div className="mb-6 border rounded-lg bg-white overflow-hidden shadow-sm">
                          <div className="bg-green-50 px-4 py-3 flex justify-between items-center border-b border-green-100">
                             <h4 className="font-semibold text-green-800 flex items-center text-sm"><CheckCircle2 className="h-4 w-4 mr-2 text-green-600"/> Auto-Generated Preview</h4>
                             <button 
                               onClick={() => handleRegenerateLesson(c)}
                               className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded text-xs font-medium flex items-center shadow-sm transition"
                             >
                               <RefreshCw className="w-3 h-3 mr-1" /> Regenerate Text & Media
                             </button>
                          </div>
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="md:col-span-2">
                               <p className="text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                 {chapData.explanation}
                               </p>
                             </div>
                             {chapData.image_url && (
                                <div className="rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                                   <img src={chapData.image_url} alt="AI Vis" className="w-full h-full object-cover" />
                                </div>
                             )}
                          </div>
                          {chapData.video_url && (
                             <div className="bg-indigo-50 border-t border-indigo-100 px-4 py-2 text-xs font-medium text-indigo-700 flex items-center">
                               <Video className="w-3.5 h-3.5 mr-2" /> 
                               Video Compiled Successfully
                             </div>
                          )}
                       </div>
                   ) : null}

                   <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white relative">
                      {isGeneratingChap && (
                         <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-lg">
                            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                         </div>
                      )}

                      <h4 className="font-semibold text-gray-700 flex items-center mb-2">Attach External Media (Manual Override)</h4>
                      <p className="text-xs text-gray-500 mb-4">Paste a YouTube/Vimeo/Drive link, OR upload your own local MP4/PDF.</p>
                      
                      {/* File Upload Area */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <label className="border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition">
                             <Upload className="h-6 w-6 text-indigo-400 mb-2"/>
                             <span className="font-medium text-xs text-gray-700">Upload Video File (.mp4)</span>
                             <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => handleFileUpload(e, c, 'video')} />
                         </label>

                         <label className="border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition">
                             <Upload className="h-6 w-6 text-blue-400 mb-2"/>
                             <span className="font-medium text-xs text-gray-700">Upload Document (.pdf)</span>
                             <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, c, 'document')} />
                         </label>
                      </div>

                      <div className="flex items-center text-xs text-gray-400 mb-4 px-2 uppercase tracking-widest font-bold">
                         <div className="flex-1 border-b"></div><span className="px-2">OR Paste Link</span><div className="flex-1 border-b"></div>
                      </div>

                      {/* URL Input Area */}
                      <input 
                         type="text"
                         placeholder="https://youtube.com/..."
                         value={manualLinks[key] || chapData?.video_url || chapData?.document_url || ''}
                         onChange={(e) => setManualLinks({...manualLinks, [key]: e.target.value})}
                         className="w-full border border-gray-300 p-2 rounded text-sm mb-3 focus:ring focus:ring-indigo-100"
                      />
                      <div className="flex space-x-2">
                         <button onClick={() => handleManualSave(c, 'video')} className="text-xs bg-gray-800 text-white px-3 py-2 rounded flex items-center shadow-sm hover:bg-gray-700">
                            <Video className="w-3 h-3 mr-1"/> Attach Link as Video
                         </button>
                         <button onClick={() => handleManualSave(c, 'document')} className="text-xs bg-gray-800 text-white px-3 py-2 rounded flex items-center shadow-sm hover:bg-gray-700">
                            <FileText className="w-3 h-3 mr-1"/> Attach Link as Doc
                         </button>
                      </div>
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-between pt-4 border-t border-gray-200">
        <button onClick={onBack} disabled={globalProgress.active} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50 transition disabled:opacity-50">
          Back
        </button>
        <button 
          onClick={onNext}
          disabled={!allGenerated || globalProgress.active}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 transition shadow-sm"
        >
          {allGenerated ? 'Review & Publish' : 'Finish Generating Above First'}
        </button>
      </div>
    </div>
  );
}
