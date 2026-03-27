import React, { useState } from 'react';
import { generateChapter, generateCourseQuiz, uploadChapterMedia } from '../api';
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, Video, FileText, Bot, Upload } from 'lucide-react';

export default function Step4ContentEditor({ courseData, updateCourseData, onNext, onBack }) {
  const { structure, details, sourceType, content } = courseData;
  const [loadingMap, setLoadingMap] = useState({});
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState(null);

  // local form states for manual entry
  const [manualLinks, setManualLinks] = useState({});

  const flatChapters = [];
  structure.modules.forEach(mod => {
    mod.chapters.forEach(chap => {
      flatChapters.push({
        moduleTitle: mod.title,
        chapterTitle: chap.title
      });
    });
  });

  const saveContentEntry = (entry) => {
    const updatedContent = [...content];
    const existingIdx = updatedContent.findIndex(c => c.module_title === entry.module_title && c.title === entry.title);
    if (existingIdx >= 0) {
       updatedContent[existingIdx] = entry;
    } else {
       updatedContent.push(entry);
    }
    updateCourseData('content', updatedContent);
  };

  const generateChap = async (chapInfo) => {
    const key = `${chapInfo.moduleTitle}-${chapInfo.chapterTitle}`;
    setLoadingMap(prev => ({ ...prev, [key]: true }));

    try {
      const result = await generateChapter({
        course_title: details.title,
        module_title: chapInfo.moduleTitle,
        chapter_title: chapInfo.chapterTitle,
        source_type: sourceType,
        audience: details.target_audience,
        difficulty: details.difficulty,
        objectives: details.learning_objectives
      });
      
      saveContentEntry({ module_title: chapInfo.moduleTitle, ...result.content });
    } catch (err) {
      alert("Error generating content for: " + chapInfo.chapterTitle);
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

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
         example: null,
         code: null,
         summary: null
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
               example: null,
               code: null,
               summary: null
          });
          setExpandedChapter(null);
      } catch (err) {
          alert("Failed to upload file. Make sure FastAPI has the /uploads dir configured.");
      } finally {
          setLoadingMap(prev => ({ ...prev, [key]: false }));
      }
  };

  const handleGenerateGlobalQuiz = async () => {
     setGeneratingQuiz(true);
     try {
        const result = await generateCourseQuiz({
           course_title: details.title,
           modules: structure.modules,
           source_type: sourceType,
           audience: details.target_audience,
           difficulty: details.difficulty,
           objectives: details.learning_objectives
        });
        updateCourseData('course_quiz', result.quiz);
     } catch (err) {
        alert("Failed to generate global course quiz.");
     } finally {
        setGeneratingQuiz(false);
     }
  };

  const isCompleted = (moduleTitle, chapterTitle) => {
    return content.some(c => c.module_title === moduleTitle && c.title === chapterTitle);
  };

  const getChapContent = (moduleTitle, chapterTitle) => {
    return content.find(c => c.module_title === moduleTitle && c.title === chapterTitle);
  };

  const allGenerated = flatChapters.every(c => isCompleted(c.moduleTitle, c.chapterTitle));

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-2">Step 4: Mixed Lesson Builder</h2>
      <p className="text-sm text-gray-600 mb-6">Trigger AI generation or attach existing external Video/Document URLs for each lesson.</p>

      <div className="space-y-4 mb-8">
        {flatChapters.map((c, i) => {
          const key = `${c.moduleTitle}-${c.chapterTitle}`;
          const isGenerating = loadingMap[key];
          const hasContent = isCompleted(c.moduleTitle, c.chapterTitle);
          const expanded = expandedChapter === key;
          const chapData = getChapContent(c.moduleTitle, c.chapterTitle);

          return (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
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
                       <span className="mr-4 text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600 uppercase">
                          {chapData.content_type || 'ai_generated'}
                       </span>
                   )}
                   <span className="text-sm text-indigo-600 font-medium">{expanded ? "Close" : "Edit Element"}</span>
                </div>
              </div>

              {expanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm">
                   
                   {!hasContent || chapData.content_type === 'ai_generated' ? (
                       <div className="mb-6 p-4 border rounded bg-white">
                          <h4 className="font-semibold text-gray-700 flex items-center mb-2"><Bot className="h-4 w-4 mr-2 text-indigo-500"/> AI Content Generation</h4>
                          <p className="text-xs text-gray-500 mb-3">Uses language models and optional uploaded PDF context to write lessons directly.</p>
                          <button 
                             onClick={() => generateChap(c)}
                             disabled={isGenerating}
                             className={`text-xs px-4 py-2 rounded font-medium shadow-sm transition
                               ${hasContent ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border' : 'bg-indigo-600 text-white hover:bg-indigo-700'} 
                               ${isGenerating ? 'opacity-50 cursor-wait' : ''}
                             `}
                           >
                             {isGenerating ? (
                               <span className="flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</span>
                             ) : hasContent ? 'Regenerate AI Content' : 'Generate AI Content'}
                           </button>
                       </div>
                   ) : null}

                   {(!hasContent || chapData.content_type !== 'ai_generated') && (
                      <div className="p-4 border rounded bg-white mt-4 relative">
                         {isGenerating && (
                            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                               <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                            </div>
                         )}

                         <h4 className="font-semibold text-gray-700 flex items-center mb-2">Attach External Media</h4>
                         <p className="text-xs text-gray-500 mb-4">Paste a YouTube/Vimeo/Drive link, OR upload your own local MP4/PDF.</p>
                         
                         {/* File Upload Area */}
                         <div className="grid grid-cols-2 gap-4 mb-4">
                            <label className="border-2 border-dashed border-gray-300 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition">
                                <Upload className="h-6 w-6 text-indigo-400 mb-2"/>
                                <span className="font-medium text-xs text-gray-700">Upload Video File (.mp4)</span>
                                <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => handleFileUpload(e, c, 'video')} />
                            </label>

                            <label className="border-2 border-dashed border-gray-300 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition">
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
                            className="w-full border p-2 rounded text-sm mb-3 focus:ring focus:ring-indigo-100"
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
                   )}

                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white border p-6 rounded-lg shadow-sm border-indigo-200">
         <h3 className="font-semibold text-gray-900 mb-2">Final Course Knowledge Test</h3>
         <p className="text-sm text-gray-600 mb-4">Generate 10 multiple-choice questions summarizing the entire curriculum.</p>
         <button 
             onClick={handleGenerateGlobalQuiz}
             disabled={generatingQuiz || !allGenerated}
             className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center shadow-sm"
         >
             {generatingQuiz && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
             {courseData.course_quiz ? 'Regenerate Course Quiz' : 'Generate Course Quiz'}
         </button>
         {!allGenerated && <span className="text-xs text-red-500 ml-3 font-medium">Please finish filling all chapters first.</span>}
         {courseData.course_quiz && !generatingQuiz && <span className="text-xs text-green-600 font-bold ml-3 mt-2 inline-block">✅ Global Quiz Generated</span>}
      </div>

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50">
          Back
        </button>
        <button 
          onClick={onNext}
          disabled={!allGenerated}
          className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {allGenerated ? 'Review Course' : 'Finish Steps Above First'}
        </button>
      </div>
    </div>
  );
}
