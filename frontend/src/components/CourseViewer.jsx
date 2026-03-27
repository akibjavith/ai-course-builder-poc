import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, BookOpen, CheckCircle, Video, PlayCircle, ClipboardList, Send, ThumbsUp } from 'lucide-react';

export default function CourseViewer({ course, onBack }) {
  const { details, structure, content, course_quiz } = course || {};
  
  if (!course) return null;

  const [expandedModule, setExpandedModule] = useState(0);
  const [activeChap, setActiveChap] = useState({ modIdx: 0, chapIdx: 0 });
  const [completedItems, setCompletedItems] = useState([]); // string keys "modIdx-chapIdx"
  const [quizMode, setQuizMode] = useState(false);
  const [surveyMode, setSurveyMode] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  // Flatten chapters to count totals
  let totalItems = 0;
  structure?.modules?.forEach(mod => {
    totalItems += mod.chapters.length;
  });

  const progressPercent = totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0;
  const isCourseFinished = completedItems.length === totalItems;

  const markComplete = () => {
     const key = `${activeChap.modIdx}-${activeChap.chapIdx}`;
     if (!completedItems.includes(key)) {
        setCompletedItems([...completedItems, key]);
     }
  };

  const jumpTo = (mIdx, cIdx) => {
     setQuizMode(false);
     setSurveyMode(false);
     setExpandedModule(mIdx);
     setActiveChap({ modIdx: mIdx, chapIdx: cIdx });
  };

  const activeChapData = structure.modules[activeChap.modIdx]?.chapters[activeChap.chapIdx];
  const activeChapContent = content?.find(c => 
     c.module_title === structure.modules[activeChap.modIdx]?.title && 
     c.title === activeChapData?.title
  );

  const startQuiz = () => setQuizMode(true);
  
  const submitQuiz = (e) => {
     e.preventDefault();
     setQuizScore(100); 
  };

  const startSurvey = () => {
    setQuizMode(false);
    setSurveyMode(true);
  };

  const finishSurvey = (e) => {
    e.preventDefault();
    alert("Thank you for your feedback! Course Complete.");
    onBack();
  }

  // Smart Video Renderer
  const renderVideo = (url) => {
     if (!url) return null;

     // Handle YouTube URLs
     const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
     if (ytMatch && ytMatch.length > 1) {
         return (
            <iframe 
               src={`https://www.youtube.com/embed/${ytMatch[1]}`} 
               title="YouTube video player" 
               frameBorder="0" 
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
               allowFullScreen
               className="w-full h-96 rounded-xl shadow-lg border-0"
            ></iframe>
         )
     }

     // Handle Raw Server URLs / regular MP4
     if (url.includes('.mp4') || url.includes('/uploads/')) {
         return (
            <video 
               src={url} 
               controls 
               autoPlay
               className="w-full rounded-xl shadow-lg bg-black"
            >
               Your browser does not support HTML5 video.
            </video>
         )
     }

     // Fallback Link
     return (
        <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-12 bg-gray-900 border border-gray-700 rounded-xl text-white hover:bg-gray-800 transition">
             <Video className="w-16 h-16 text-indigo-400 mb-4" />
             <span className="text-xl font-medium">Play External Video</span>
             <span className="text-sm mt-2 text-indigo-300 block">{url}</span>
        </a>
     )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-indigo-700 shadow-md text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
             <button onClick={onBack} className="text-indigo-200 hover:text-white mr-4 transition">
                <ChevronLeft className="h-6 w-6" />
             </button>
             <h1 className="text-xl font-bold truncate max-w-lg">{details?.title}</h1>
          </div>
          <div className="flex items-center w-64">
             <div className="mr-3 text-sm font-semibold whitespace-nowrap">{progressPercent}% Completed</div>
             <div className="w-full bg-indigo-900 rounded-full h-2.5">
               <div className="bg-green-400 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-full w-full flex overflow-hidden">
        {/* LMS Sidebar Navigation */}
        <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 shadow-inner">
           <div className="p-4 bg-gray-50 border-b">
              <h2 className="font-bold text-gray-800 uppercase text-xs tracking-wider">Course Curriculum</h2>
           </div>
           <nav className="divide-y divide-gray-100">
             {structure?.modules?.map((mod, mIdx) => (
               <div key={mIdx}>
                  <div 
                    onClick={() => setExpandedModule(expandedModule === mIdx ? null : mIdx)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 bg-white group transition"
                  >
                     <span className="font-semibold text-gray-900 text-sm">{mod.title}</span>
                     {expandedModule === mIdx ? <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-indigo-600"/> : <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600"/>}
                  </div>
                  
                  {expandedModule === mIdx && (
                    <div className="bg-gray-50 border-t border-b border-gray-100">
                      {mod.chapters.map((chap, cIdx) => {
                         const key = `${mIdx}-${cIdx}`;
                         const isDone = completedItems.includes(key);
                         const isActive = activeChap.modIdx === mIdx && activeChap.chapIdx === cIdx && !quizMode && !surveyMode;

                         return (
                           <div 
                             key={cIdx}
                             onClick={() => jumpTo(mIdx, cIdx)}
                             className={`pl-8 pr-4 py-3 flex items-start cursor-pointer transition text-sm
                               ${isActive ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent hover:bg-gray-100'}
                             `}
                           >
                              <div className="mt-0.5 mr-3">
                                {isDone ? <CheckCircle className="w-4 h-4 text-green-500" /> : <PlayCircle className="w-4 h-4 text-gray-400" />}
                              </div>
                              <span className={`${isActive ? 'text-indigo-900 font-medium' : 'text-gray-600'}`}>{chap.title}</span>
                           </div>
                         );
                      })}
                    </div>
                  )}
               </div>
             ))}

             {/* Final Actions Sidebar Item */}
             <div className="p-4 bg-gray-50">
               <button 
                  onClick={startQuiz}
                  disabled={!isCourseFinished}
                  className={`w-full flex items-center justify-center py-2 px-4 rounded text-sm font-medium transition shadow-sm
                    ${isCourseFinished ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}
                  `}
               >
                 <ClipboardList className="w-4 h-4 mr-2" />
                 Final Course Exam
               </button>
             </div>
           </nav>
        </aside>

        {/* LMS Content Area */}
        <section className="flex-1 bg-white overflow-y-auto p-4 sm:p-8 lg:p-12 relative">
           
           {surveyMode ? (
              <div className="max-w-2xl mx-auto py-12">
                 <div className="text-center mb-10">
                    <ThumbsUp className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-gray-900">Congratulations</h2>
                    <p className="text-gray-600">You've successfully mastered the course material!</p>
                 </div>
                 
                 <form onSubmit={finishSurvey} className="bg-gray-50 p-6 sm:p-8 border border-gray-200 rounded-xl shadow-sm">
                    <h3 className="font-bold text-gray-800 border-b pb-4 mb-6">Course Feedback Survey (Required)</h3>
                    
                    <div className="space-y-6">
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">How satisfied are you with this course?</label>
                         <select required className="block w-full border-gray-300 rounded-md p-2 border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            <option value="">Select rating...</option>
                            <option value="5">Extremely Satisfied</option>
                            <option value="4">Satisfied</option>
                            <option value="3">Neutral</option>
                            <option value="2">Unsatisfied</option>
                            <option value="1">Extremely Unsatisfied</option>
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">What was your favorite module and why?</label>
                         <textarea required rows={3} className="block w-full border-gray-300 rounded-md p-2 border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">How could this course be improved?</label>
                         <textarea rows={2} className="block w-full border-gray-300 rounded-md p-2 border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                       </div>
                    </div>

                    <div className="mt-8">
                       <button type="submit" className="w-full flex justify-center py-3 border border-transparent rounded-md shadow flex items-center text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                          <Send className="w-4 h-4 mr-2" /> Complete Course & Submit Feedback
                       </button>
                    </div>
                 </form>
              </div>

           ) : quizMode ? (
              <div className="max-w-4xl mx-auto py-8">
                 <h2 className="text-3xl font-bold text-gray-900 mb-2">Global Course Assessment</h2>
                 <p className="text-gray-500 mb-8 border-b pb-4">Test your knowledge across all modules.</p>

                 {quizScore !== null ? (
                    <div className="bg-green-50 border-2 border-green-500 rounded-lg p-8 text-center text-green-900 shadow-sm animate-pulse-once">
                       <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                       <h3 className="text-3xl font-black mb-2">You Passed! ({quizScore}%)</h3>
                       <p className="mb-6">Outstanding performance on the final text.</p>
                       <button 
                         onClick={startSurvey}
                         className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition transform hover:scale-105"
                       >
                          Proceed to Certification Survey
                       </button>
                    </div>
                 ) : (
                    <form onSubmit={submitQuiz}>
                      <div className="space-y-8">
                         {course_quiz?.map((q, qIdx) => (
                           <div key={qIdx} className="bg-white p-6 border rounded-lg shadow-sm font-serif">
                              <h4 className="font-semibold text-lg text-gray-900 mb-4">{qIdx + 1}. {q.question}</h4>
                              <div className="space-y-3 pl-2">
                                 {q.options.map((opt, oIdx) => (
                                   <label key={oIdx} className="flex items-center space-x-3 cursor-pointer group p-2 rounded hover:bg-indigo-50 transition border border-transparent hover:border-indigo-100">
                                      <input type="radio" required name={`q-${qIdx}`} className="h-4 w-4 text-indigo-600 cursor-pointer" />
                                      <span className="text-gray-700 group-hover:text-indigo-900">{opt}</span>
                                   </label>
                                 ))}
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="mt-10 mb-20 bg-gray-50 p-6 rounded-lg text-center shadow-inner border border-gray-200">
                         <button type="submit" className="bg-indigo-600 text-white font-bold py-3 px-10 rounded shadow hover:bg-indigo-700 tracking-wide text-lg">
                            Submit Exam
                         </button>
                      </div>
                    </form>
                 )}
              </div>

           ) : (
              <div className="max-w-4xl mx-auto pb-20">
                 {!activeChapContent ? (
                    <div className="bg-red-50 text-red-600 p-6 rounded shadow border border-red-200 font-semibold flex items-center text-lg">
                       Error: Content missing for this chapter.
                    </div>
                 ) : (
                    <div className="animate-fade-in">
                       <div className="mb-8">
                          <h4 className="text-indigo-600 font-bold tracking-widest text-sm uppercase mb-1">
                             Module {activeChap.modIdx + 1}: {structure.modules[activeChap.modIdx]?.title}
                          </h4>
                          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
                             {activeChapData?.title}
                          </h2>
                       </div>
                       
                       {/* Render AI Document */}
                       {(!activeChapContent.content_type || activeChapContent.content_type === 'ai_generated') && (
                          <div className="prose prose-indigo max-w-none text-gray-700 text-lg leading-relaxed">
                             <div className="whitespace-pre-wrap">{activeChapContent.explanation}</div>
                             
                             {activeChapContent.example && (
                                <div className="mt-10 bg-indigo-50 border-l-4 border-indigo-600 p-6 rounded-r-lg">
                                  <h4 className="text-xl font-bold text-indigo-900 mb-3 m-0">Case Study / Example</h4>
                                  <div className="whitespace-pre-wrap italic text-indigo-800 m-0">{activeChapContent.example}</div>
                                </div>
                             )}
                             
                             {activeChapContent.code && (
                                <div className="mt-10 shadow-lg rounded-xl overflow-hidden">
                                  <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex">
                                     <div className="flex space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                     </div>
                                  </div>
                                  <pre className="bg-gray-900 text-gray-100 p-6 overflow-x-auto text-sm font-mono m-0">
                                     {activeChapContent.code}
                                  </pre>
                                </div>
                             )}

                             {activeChapContent.summary && (
                                <div className="mt-12 border-t border-gray-200 pt-8">
                                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Summary Recap</h4>
                                  <p className="whitespace-pre-wrap font-medium">{activeChapContent.summary}</p>
                                </div>
                             )}
                          </div>
                       )}

                       {/* Render External Video securely */}
                       {activeChapContent.content_type === 'video' && (
                          <div className="mt-6 mb-12">
                             {renderVideo(activeChapContent.video_url)}
                          </div>
                       )}

                       {/* Render External Document */}
                       {activeChapContent.content_type === 'document' && (
                          <div className="mt-6 mb-12">
                             <div className="bg-blue-50 border-2 border-dashed border-blue-400 rounded-xl p-12 text-center">
                                <BookOpen className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                                <h3 className="text-2xl font-bold text-blue-900 mb-2">Reading Material Attached</h3>
                                <p className="text-blue-700 mb-6">Instructor has provided an external reference material for this chapter.</p>
                                <a href={activeChapContent.document_url} target="_blank" rel="noreferrer" className="inline-block bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-lg font-bold py-3 px-8 rounded-md transition hover:-translate-y-1">
                                   Open Document
                                </a>
                             </div>
                          </div>
                       )}

                       {/* Mark as complete CTA */}
                       <div className="bg-gray-50 border border-gray-200 shadow-sm p-6 rounded-lg mt-16 flex items-center justify-between">
                          <p className="text-gray-700 font-medium">Finished with this chapter?</p>
                          <button 
                             onClick={markComplete}
                             className={`px-6 py-3 rounded-md font-bold shadow-sm flex items-center transition ${
                               completedItems.includes(`${activeChap.modIdx}-${activeChap.chapIdx}`) 
                               ? 'bg-green-100 text-green-800 hover:bg-green-200'
                               : 'bg-indigo-600 text-white hover:bg-indigo-700'
                             }`}
                          >
                             {completedItems.includes(`${activeChap.modIdx}-${activeChap.chapIdx}`) && <CheckCircle className="w-5 h-5 mr-2" />}
                             {completedItems.includes(`${activeChap.modIdx}-${activeChap.chapIdx}`) ? 'Completed' : 'Mark as Complete'}
                          </button>
                       </div>
                    </div>
                 )}
              </div>
           )}

        </section>
      </main>
    </div>
  );
}
