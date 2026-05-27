import React from 'react';
import { X, Volume2, BookOpen, Video, PlayCircle, Link, CheckCircle2, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import FlashcardViewer from './FlashcardViewer';
import QuizViewer from './QuizViewer';

// Beautiful Tablespec component
function BeautifulTablesList({ tables }) {
  if (!tables || !Array.isArray(tables) || tables.length === 0) return null;
  return (
    <div className="space-y-8 mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
        📊 Data & Comparison Tables
      </h3>
      {tables.map((table, idx) => (
        <div key={idx} className="overflow-x-auto my-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            {table.caption && (
              <caption className="p-4 text-sm font-semibold text-left text-slate-800 bg-slate-50/50 border-b border-slate-200">
                {table.caption}
              </caption>
            )}
            <thead className="bg-slate-50/50">
              <tr>
                {table.headers?.map((header, hIdx) => (
                  <th key={hIdx} scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {table.rows?.map((row, rIdx) => (
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
      ))}
    </div>
  );
}

// Beautiful References List
function BeautifulReferencesList({ references }) {
  if (!references || !Array.isArray(references) || references.length === 0) return null;
  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-base font-bold text-slate-850 mb-4 flex items-center gap-2">
        📚 References & External Learning Links
      </h3>
      <ul className="space-y-3 list-none p-0 m-0">
        {references.map((ref, idx) => (
          <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-150 transition-all gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-950">{ref.title}</h4>
              {ref.description && <p className="text-xs text-slate-650 mt-0.5">{ref.description}</p>}
            </div>
            <a 
              href={ref.url} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-1.5 self-start sm:self-center text-xs font-bold text-sky-600 hover:text-sky-850 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 whitespace-nowrap"
            >
              Visit Resource ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Custom hook to automatically add copy buttons to <pre> tags
// Custom hook to automatically add copy buttons to <pre> tags with MutationObserver
function useCopyCode(containerRef, dependency) {
  React.useEffect(() => {
    if (!containerRef.current) return;
    const addCopyButtons = () => {
      const preBlocks = containerRef.current.querySelectorAll('pre');
      preBlocks.forEach((pre) => {
        if (pre.querySelector('.copy-code-btn') || pre.dataset.hasCopyBtn) return;
        pre.style.position = 'relative';
        pre.dataset.hasCopyBtn = 'true';
        const button = document.createElement('button');
        button.className = 'copy-code-btn absolute top-3 right-3 bg-gray-800/95 hover:bg-gray-700 text-gray-350 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-gray-700/50 shadow-md flex items-center gap-1 active:scale-95 z-10';
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

// Parse raw markdown bold into <strong> tags
function parseMarkdownBold(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export default function LessonPreviewModal({ chapter, chapterContent, onClose, onNext, onPrev, hasNext, hasPrev }) {
  if (!chapter) return null;

  const containerRef = React.useRef(null);
  useCopyCode(containerRef, chapterContent);

  const renderMediaComponent = (url) => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    const finalUrl = url.startsWith('/uploads/') ? `http://localhost:8000${url}` : url;

    // YouTube Embed
    const ytMatch = finalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`}
          title="Video Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full aspect-video border-0 rounded-2xl overflow-hidden"
        />
      );
    }

    // Audio Files
    if (lowerUrl.includes('.mp3') || lowerUrl.includes('.wav')) {
      return (
        <div className="flex flex-col items-center justify-center py-12 bg-slate-900 w-full rounded-2xl border border-slate-800">
           <Volume2 className="w-12 h-12 text-sky-400 mb-4 animate-pulse" />
           <audio controls autoPlay controlsList="nodownload" className="w-11/12 max-w-md">
             <source src={finalUrl} />
           </audio>
        </div>
      );
    }

    // PDF / Documents
    if (lowerUrl.includes('.pdf') || lowerUrl.includes('.ppt') || lowerUrl.includes('.doc')) {
      return (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center px-6">
          <BookOpen className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">External Resource</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">This file ({chapter.title}) will be available for download in the final course.</p>
          <a href={finalUrl} target="_blank" rel="noreferrer" className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-sky-700 transition shadow-lg shadow-sky-100">
             Open Resource
          </a>
        </div>
      );
    }

    // Video Files
    if (lowerUrl.includes('.mp4') || finalUrl.includes('/uploads/')) {
        return (
            <video controls className="w-full aspect-video bg-black rounded-2xl shadow-xl">
                <source src={finalUrl} />
            </video>
        );
    }

    return (
      <a href={finalUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center py-12 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition">
        <Video className="w-12 h-12 text-slate-400 mb-3" />
        <span className="font-bold text-slate-800">View Attachment</span>
        <span className="text-xs text-slate-400 mt-1 truncate max-w-[200px]">{finalUrl}</span>
      </a>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-scale-in">
        
        {/* Header */}
        <div className="p-6 sm:px-10 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
               <span className="bg-sky-50 text-sky-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-sky-100">Live Preview</span>
               <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate max-w-md">{chapter.title}</h2>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Reviewing how students will see this lesson</p>
          </div>
          <div className="flex items-center gap-2">
            {(onPrev || onNext) && (
              <div className="flex items-center gap-1 mr-2 border-r border-slate-100 pr-3">
                <button 
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={onNext}
                  disabled={!hasNext}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/30">
          {!chapterContent ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
                 <Bot className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No Content Ready</h3>
              <p className="text-slate-500 max-w-sm">This lesson doesn't have any text or media generated yet. Please go back and generate content first.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-12 sm:px-12 space-y-10 bg-white shadow-sm my-10 rounded-[2rem] border border-slate-100">
              
              {/* Media Block */}
              {(chapterContent.video_url || chapterContent.content_type === 'video') ? (
                <div className="mb-10">
                  {renderMediaComponent(chapterContent.video_url)}
                </div>
              ) : chapterContent.image_url ? (
                <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <img 
                    src={chapterContent.image_url.startsWith('/uploads') ? `http://localhost:8000${chapterContent.image_url}` : chapterContent.image_url} 
                    alt="Visual Context" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}

              {/* Text Content */}
              <div className="space-y-6">
                <h1 className="text-4xl font-black text-slate-900 leading-tight">{chapter.title}</h1>
                
                {/* File Attachment Pill Bar */}
                {chapterContent.files?.length > 0 && (
                  <div className="flex flex-wrap gap-3 py-2">
                     {chapterContent.files.map((file, idx) => (
                       <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 hover:border-sky-200 hover:bg-white transition-all shadow-sm">
                          <Link className="w-3.5 h-3.5 text-sky-500" />
                          {file.name || 'Resource'}
                       </a>
                     ))}
                  </div>
                )}

                 <div ref={containerRef} className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg">
                     {chapterContent.html_content ? (
                        <div dangerouslySetInnerHTML={{ __html: parseMarkdownBold(chapterContent.html_content) }} className="animate-fade-in" />
                     ) : (
                        <div dangerouslySetInnerHTML={{ __html: parseMarkdownBold(chapterContent.explanation).replace(/\n/g, '<br/>') }} className="animate-fade-in" />
                     )}
                    <BeautifulTablesList tables={chapterContent.tables} />
                    <BeautifulReferencesList references={chapterContent.references} />
                 </div>
              </div>

              {/* Flashcards */}
              {chapterContent.flashcards?.length > 0 && (
                <div className="pt-10 border-t border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-sky-500" /> Mastery Cards
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <FlashcardViewer flashcards={chapterContent.flashcards} />
                  </div>
                </div>
              )}

              {/* Quiz */}
              {chapterContent.mcqs?.length > 0 && (
                <div className="pt-10 border-t border-slate-100">
                   <QuizViewer questions={chapterContent.mcqs} title="Quick Knowledge Check" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
           <button 
             onClick={onClose}
             className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-xl active:scale-95"
           >
             Close Preview
           </button>
        </div>
      </div>
    </div>
  );
}
