import React, { useState, useEffect } from 'react';
import { PlayCircle, RefreshCw, Save, Image as ImageIcon, FileText, Video, Loader2, FileDown, Volume2, BookOpen, UploadCloud, Link as LinkIcon, Paperclip, X } from 'lucide-react';
import TTSPlayer from './TTSPlayer';
import FlashcardViewer from './FlashcardViewer';
import QuizViewer from './QuizViewer';
import { CheckCircle2 } from 'lucide-react';
import { 
  generateChapter, generateVoiceScript, exportChapter, 
  generateFlashcards, uploadFile 
} from '../api';
import PremiumRichEditor from './PremiumRichEditor';

export default function ChapterEditor({ courseTitle, moduleTitle, chapter, courseData, onSave, onRegenerate }) {
  const [content, setContent] = useState(chapter.content?.explanation || "");
  const [htmlContent, setHtmlContent] = useState(chapter.content?.html_content || "");
  const [editorMode, setEditorMode] = useState(chapter.content?.content_type === 'html' ? 'rich' : 'text');
  const [audioUrl, setAudioUrl] = useState(chapter.content?.audio_url || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wordCountError, setWordCountError] = useState(false);
  const [exportingTo, setExportingTo] = useState(null);
  
  const [flashcards, setFlashcards] = useState(chapter.content?.flashcards || null);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

  const [files, setFiles] = useState(chapter.content?.files || []);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = React.useRef(null);

  const [mcqs, setMcqs] = useState(chapter.content?.mcqs || null);
  const [generatingMcqs, setGeneratingMcqs] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  useEffect(() => {
    if (chapter.content) {
      setContent(chapter.content.explanation || "");
      setHtmlContent(chapter.content.html_content || "");
      setEditorMode(chapter.content.content_type === 'html' ? 'rich' : 'text');
      setIsEditing(false);
    } else if (!isEditing && !isLoading && !content) {
      // Auto-trigger AI generation on first load if empty
      handleGenerate();
    }
  }, [chapter.content]);

  const countWords = (text) => {
    if (!text) return 0;
    return text.toString().replace(/<[^>]*>?/gm, ' ').split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setWordCountError(false);
    try {
      const resp = await generateChapter({
        course_title: courseTitle,
        module_title: moduleTitle,
        chapter_title: chapter.title,
        source_type: courseData.sourceType || "external",
        audience: courseData.details?.target_audience || "Any",
        difficulty: courseData.details?.difficulty || "beginner",
        objectives: courseData.details?.learning_objectives || []
      });
      const generatedExpl = resp.content?.explanation || "";
      const generatedHtml = resp.content?.html_content || "";
      
      if (countWords(generatedHtml || generatedExpl) < 250) {
        setWordCountError(true);
      } else {
        setWordCountError(false);
      }
      
      let newAudioUrl = null;
      try {
        const ttsResp = await generateVoiceScript({ text: generatedExpl.substring(0, 1000) });
        newAudioUrl = ttsResp.audio_url || ttsResp.url;
        setAudioUrl(newAudioUrl);
      } catch(e) {
        console.error("TTS Auto generation failed", e);
      }

      setContent(generatedExpl);
      setHtmlContent(generatedHtml);
      if (generatedHtml) setEditorMode('rich');
      
      onSave({ 
        ...resp.content, 
        explanation: generatedExpl, 
        html_content: generatedHtml,
        audio_url: newAudioUrl,
        content_type: generatedHtml ? 'html' : 'ai_generated'
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate content: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    const activeText = editorMode === 'rich' ? htmlContent : content;
    const wordCount = countWords(activeText);
    
    if (wordCount < 250 && files.length === 0) {
      setWordCountError(true);
      alert("Please provide more content (250+ words) or upload a file for this chapter.");
      return;
    }
    setWordCountError(false);
    onSave({ 
      ...chapter.content, 
      explanation: content, 
      html_content: htmlContent,
      audio_url: audioUrl, 
      flashcards, 
      mcqs, 
      files,
      content_type: editorMode === 'rich' ? 'html' : 'ai_generated'
    });
    setIsEditing(false);
  };

  const syncToRichText = () => {
    if (!htmlContent || htmlContent === '<p><br></p>') {
      // Basic conversion: separate by double newlines for paragraphs
      const paragraphs = content.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      setHtmlContent(paragraphs || '<p><br></p>');
    }
    setEditorMode('rich');
  };

  const handleLinkAdd = () => {
    if (!linkUrl) return;
    const newFiles = [...files, { url: linkUrl, name: linkUrl, type: 'link' }];
    setFiles(newFiles);
    onSave({ ...chapter.content, explanation: content, audio_url: audioUrl, flashcards, files: newFiles });
    setLinkUrl("");
    setShowLinkInput(false);
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setUploadingFile(true);
    try {
      const res = await uploadFile(uploadedFile);
      if (res.url) {
        const newFiles = [...files, { url: res.url, name: uploadedFile.name, type: uploadedFile.type }];
        setFiles(newFiles);
        onSave({ ...chapter.content, explanation: content, audio_url: audioUrl, flashcards, files: newFiles });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload file.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (idx) => {
    const newFiles = files.filter((_, i) => i !== idx);
    setFiles(newFiles);
    onSave({ ...chapter.content, explanation: content, audio_url: audioUrl, flashcards, files: newFiles });
  };

  const handleExport = async (format) => {
    setExportingTo(format);
    try {
      const res = await exportChapter({
        course_title: courseTitle || "Course",
        module_title: moduleTitle || "Module",
        chapter_title: chapter.title || "Chapter",
        content: { explanation: content },
        format
      });
      if (res.url) {
        window.open(res.url, "_blank");
      }
    } catch(e) {
      alert("Failed to export " + format.toUpperCase());
    } finally {
      setExportingTo(null);
    }
  };

  const handleTTS = async () => {
    if (audioUrl) return; 
    try {
      const ttsResp = await generateVoiceScript({ text: content.substring(0, 1000) });
      const newAudioUrl = ttsResp.audio_url || ttsResp.url;
      setAudioUrl(newAudioUrl);
      onSave({ ...chapter.content, explanation: content, audio_url: newAudioUrl, flashcards });
    } catch (e) {
      console.error(e);
      alert("Failed to generate audio");
    }
  };

  const handleGenFlashcards = async () => {
    if (!content || flashcards) return;
    setGeneratingFlashcards(true);
    try {
      const resp = await generateFlashcards({ text: content });
      setFlashcards(resp.flashcards);
      onSave({ ...chapter.content, explanation: content, audio_url: audioUrl, flashcards: resp.flashcards });
    } catch (err) {
      console.error(err);
      alert("Failed to generate flashcards.");
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleGenMcqs = async () => {
    if (!content || mcqs) return;
    setGeneratingMcqs(true);
    try {
      const { generateMCQs } = await import('../api');
      const resp = await generateMCQs({
        course_title: courseTitle,
        module_title: moduleTitle,
        chapter_title: chapter.title
      });
      setMcqs(resp.mcqs);
      onSave({ ...chapter.content, explanation: content, audio_url: audioUrl, flashcards, mcqs: resp.mcqs, files });
    } catch (err) {
      console.error(err);
      alert("Failed to generate chapter MCQs.");
    } finally {
      setGeneratingMcqs(false);
    }
  };

  if (!chapter.content && !isEditing && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
        <h4 className="text-gray-600 font-semibold mb-2">{chapter.title}</h4>
        <p className="text-sm text-gray-500 mb-4">No content generated yet.</p>
        <button 
          onClick={handleGenerate}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition font-medium text-sm flex items-center"
        >
          <PlayCircle className="w-4 h-4 mr-2" /> Generate AI Content
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 relative group transition-all">
      {/* Top Header & Actions */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
        <h4 className="font-bold text-gray-900 text-lg flex items-center">
           {chapter.title}
           {(countWords(content) >= 250 || files.length > 0) ? (
             <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700 border border-green-200 shadow-sm">
                <CheckCircle2 className="w-3 h-3 mr-1" /> READY
             </span>
           ) : (
             <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                INCOMPLETE
             </span>
           )}
        </h4>
        <div className="flex gap-2">
          {isEditing && (
            <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
              <button 
                onClick={() => setEditorMode('text')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${editorMode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Plain Text
              </button>
              <button 
                onClick={syncToRichText}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${editorMode === 'rich' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Rich Text
              </button>
            </div>
          )}

          {!isEditing && !audioUrl && (
            <button onClick={handleTTS} className="p-2 rounded-md transition flex items-center bg-gray-50 text-gray-500 hover:text-indigo-600" title="Generate Audio">
              <Volume2 className="w-4 h-4" />
            </button>
          )}
          
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 font-bold transition flex items-center">
              Edit {editorMode === 'rich' ? 'Lesson' : 'Text'}
            </button>
          ) : (
            <button onClick={handleSave} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-bold flex items-center shadow-sm transition">
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center bg-indigo-50/30 rounded-lg border border-indigo-50/50">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-indigo-600 font-bold text-sm tracking-wide">AI IS WRITING THIS CHAPTER...</p>
          <p className="text-indigo-400 text-xs mt-2">Connecting to GPT Engine</p>
        </div>
      ) : (
        <div className="min-h-[200px]">
          {isEditing ? (
            <div className="bg-white flex flex-col h-full space-y-2">
               {editorMode === 'rich' ? (
                 <PremiumRichEditor 
                    value={htmlContent} 
                    onChange={setHtmlContent}
                    placeholder="Paste your internal document content here or let AI generate it..."
                 />
               ) : (
                 <textarea 
                   value={content} 
                   onChange={(e) => setContent(e.target.value)} 
                   className="w-full min-h-[300px] p-4 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 text-base leading-relaxed bg-indigo-50/10 shadow-inner resize-y transition-colors"
                   placeholder="Write your chapter content here or click Regenerate to try AI again..."
                 />
               )}
               <div className="flex justify-between items-center px-1">
                 <span className={`text-xs uppercase tracking-wider font-bold ${countWords(editorMode === 'rich' ? htmlContent : content) < 250 ? 'text-orange-500' : 'text-green-600'}`}>
                    Word Count: {countWords(editorMode === 'rich' ? htmlContent : content)} <span className="text-gray-400 font-medium normal-case">(250 minimum)</span>
                 </span>
                 {wordCountError && <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">⚠️ Too short! Add more detail.</span>}
               </div>
            </div>
          ) : (
            <div className="prose prose-indigo max-w-none text-gray-700 leading-relaxed bg-gray-50/50 p-6 rounded-lg border border-gray-100">
               {editorMode === 'rich' ? (
                 <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
               ) : (
                 <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
               )}
            </div>
          )}
          
          <div className="mt-6 border-t border-gray-200 pt-5">
             <div className="flex flex-col gap-4 mb-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 shadow-sm gap-4">
                   <div className="flex items-center">
                      <UploadCloud className="w-6 h-6 text-indigo-400 mr-3 hidden sm:block" />
                      <div>
                         <h5 className="text-sm font-bold text-indigo-900">Resource Materials</h5>
                         <p className="text-[10px] text-indigo-500 font-medium tracking-tight">Add manuals, videos, slides, or external links.</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none flex items-center justify-center text-[10px] font-black bg-white text-indigo-600 px-4 py-2.5 rounded-lg border border-indigo-200 shadow-sm transition active:scale-95 uppercase tracking-wider">
                         <Paperclip className="w-3.5 h-3.5 mr-2" /> Upload File
                      </button>
                      <button onClick={() => setShowLinkInput(!showLinkInput)} className="flex-1 sm:flex-none flex items-center justify-center text-[10px] font-black bg-white text-indigo-600 px-4 py-2.5 rounded-lg border border-indigo-200 shadow-sm transition active:scale-95 uppercase tracking-wider">
                         <LinkIcon className="w-3.5 h-3.5 mr-2" /> Attach Link
                      </button>
                   </div>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,video/*,audio/*" className="hidden" />
                </div>

                {showLinkInput && (
                  <div className="bg-indigo-600 p-4 rounded-xl shadow-xl animate-fade-in flex flex-col sm:flex-row gap-3 items-center border border-indigo-500 font-sans">
                     <div className="flex items-center gap-2 flex-1 w-full">
                        <LinkIcon className="text-indigo-200 w-5 h-5 flex-shrink-0" />
                        <input 
                           type="text" 
                           value={linkUrl} 
                           onChange={(e) => setLinkUrl(e.target.value)} 
                           placeholder="Paste external media URL (YouTube, Vimeo, Drive)..." 
                           className="flex-1 bg-indigo-700/50 border border-indigo-400 rounded-lg px-4 py-2 text-white text-sm placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-medium"
                        />
                     </div>
                     <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={handleLinkAdd} className="flex-1 sm:flex-none bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold text-xs hover:bg-indigo-50 transition active:scale-95 shadow-lg uppercase tracking-widest">
                           Save Link
                        </button>
                        <button onClick={() => setShowLinkInput(false)} className="text-indigo-200 hover:text-white p-2">
                          <X className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
                )}
             </div>
             
             {(files.length === 0 && countWords(content) < 250) ? (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs p-5 rounded-2xl flex items-start shadow-sm mb-6 border-l-4 border-l-orange-400 font-sans">
                   <span className="text-2xl mr-4 mt-0.5">⚠️</span>
                   <div>
                     <h6 className="font-black text-sm uppercase tracking-wide decoration-orange-300">Action Needed: Incomplete Content</h6>
                     <p className="opacity-90 mt-1.5 leading-relaxed text-[13px] font-medium italic">
                       Every module must contain material. Please **Expand the AI text** to 300+ words OR **Upload internal media** (PDF, Presentation, Video) to publish successfuly.
                     </p>
                   </div>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 font-sans">
                   {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all relative overflow-hidden group/file">
                         <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover/file:bg-indigo-600 transition" />
                         <div className="flex items-center overflow-hidden pr-2">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mr-4 flex-shrink-0 group-hover/file:bg-indigo-100 transition shadow-inner">
                               {file.type === 'link' ? <LinkIcon className="w-5 h-5 text-indigo-500" /> : 
                                file.name?.toLowerCase().endsWith('.pdf') ? <FileText className="w-5 h-5 text-red-500" /> :
                                (file.name?.toLowerCase().endsWith('.ppt') || file.name?.toLowerCase().endsWith('.pptx')) ? <ImageIcon className="w-5 h-5 text-orange-500" /> :
                                (file.type && file.type.startsWith('video')) ? <Video className="w-5 h-5 text-sky-500" /> : 
                                <Paperclip className="w-5 h-5 text-gray-500" />}
                            </div>
                            <div className="overflow-hidden">
                               <a href={file.url} target={file.url.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer" className="block text-[11px] font-black text-gray-900 hover:text-indigo-600 truncate max-w-[150px] leading-tight" title={file.name}>
                                  {file.name}
                               </a>
                               <div className="flex items-center mt-1">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50/50 px-1.5 py-0.5 rounded leading-none mr-2 border border-indigo-100/50">
                                    {file.type === 'link' ? 'URL' : (file.type?.split('/')[1] || 'FILE')}
                                  </span>
                                  {file.url.includes('upload') ? <span className="text-[8px] font-bold text-gray-400">Internal</span> : <span className="text-[8px] font-bold text-gray-400">External</span>}
                               </div>
                            </div>
                         </div>
                         <button onClick={() => handleRemoveFile(i)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all translate-x-1 opacity-0 group-hover/file:opacity-100">
                            <X className="w-5 h-5" />
                         </button>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      )}

      {/* Media & Export Tools Footer */}
      {!isLoading && (
        <>
        {audioUrl && <TTSPlayer audioUrl={audioUrl} />}
        {flashcards && <div className="mt-8"><FlashcardViewer flashcards={flashcards} /></div>}
        
        {generatingMcqs ? (
          <div className="mt-8 p-8 border-2 border-dashed border-indigo-100 rounded-2xl bg-indigo-50/30 flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
            <p className="text-indigo-600 font-bold text-sm">GENEROATING INTERACTIVE MCQS...</p>
            <p className="text-indigo-400 text-xs mt-1">Analyzing lesson content to create relevant questions</p>
          </div>
        ) : mcqs ? (
          <div className="mt-8"><QuizViewer questions={mcqs} title={`${chapter.title} MCQs`} /></div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between border-t border-gray-100 pt-4 mt-6 gap-4 bg-gray-50/30 rounded-b-lg -mx-5 -mb-5 px-5 pb-5">
          <button onClick={handleGenerate} className="text-xs flex items-center text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-2 rounded-md transition shadow-sm border border-indigo-100">
             <RefreshCw className="w-3.5 h-3.5 mr-2" /> REWRITE WITH AI
          </button>
          
          <div className="flex items-center space-x-2">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Generate Media</span>
             
             {!flashcards && (
               <button onClick={handleGenFlashcards} disabled={generatingFlashcards} className="flex items-center text-xs font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 bg-white border border-gray-200 shadow-sm rounded-md transition">
                 {generatingFlashcards ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <BookOpen className="w-3.5 h-3.5 mr-1.5" />} Flashcards
               </button>
             )}

             {!mcqs ? (
               <button onClick={handleGenMcqs} disabled={generatingMcqs} className="flex items-center text-xs font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 bg-white border border-gray-200 shadow-sm rounded-md transition">
                 {generatingMcqs ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />} MCQs
               </button>
             ) : (
               <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-3 py-2 rounded-md shadow-sm border border-green-100"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/> MCQs Ready</span>
             )}

             <button onClick={() => alert("Image Gen UI placeholder")} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-indigo-100 transition">
               <ImageIcon className="w-4 h-4" />
             </button>
             <button onClick={() => alert("Video Gen UI placeholder")} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-indigo-100 transition">
               <Video className="w-4 h-4" />
             </button>
             <div className="w-px h-6 bg-gray-200 mx-2"></div>
             
             {/* PDF, PPTX, TXT */}
             <button onClick={() => handleExport('pdf')} disabled={exportingTo === 'pdf'} className="flex items-center text-xs font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 bg-white border border-gray-200 shadow-sm rounded-md transition">
               {exportingTo === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <FileDown className="w-3.5 h-3.5 mr-1.5" />} PDF
             </button>
             <button onClick={() => handleExport('pptx')} disabled={exportingTo === 'pptx'} className="flex items-center text-xs font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 bg-white border border-gray-200 shadow-sm rounded-md transition">
               {exportingTo === 'pptx' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <FileDown className="w-3.5 h-3.5 mr-1.5" />} PPTX
             </button>
             <button onClick={() => handleExport('txt')} disabled={exportingTo === 'txt'} className="flex items-center text-xs font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 bg-white border border-gray-200 shadow-sm rounded-md transition">
               {exportingTo === 'txt' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <FileDown className="w-3.5 h-3.5 mr-1.5" />} TXT
             </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
