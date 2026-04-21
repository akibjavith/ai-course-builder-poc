import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, UploadCloud, CheckCircle, Loader2, Database, Globe, Trash2, Plus, RefreshCw, Pencil, Link, Video } from 'lucide-react';
import { 
  uploadDoc, uploadChapterMedia, generateCourseOutline, generateLessonContent, 
  generateVoiceScript, generateImagePrompt, generateImage, storeCourse,
  generateCourseTitle, uploadThumbnail, fetchWebDocument, fetchYouTubeDocument
} from '../api';
import OutlineForm from './OutlineForm';
import Chatbot from './Chatbot';

export default function InteractiveCourseCreator({ courseData, updateCourseData, onNext }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      type: 'bot_text',
      content: "Hi there! I'm your AI Course Builder assistant. Let's create something great. What should we name your course, and what's it about?",
    },
    { id: 2, sender: 'bot', type: 'form_title_desc' }
  ]);

  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [title, setTitle] = useState(courseData?.details?.title || '');
  const [description, setDescription] = useState(courseData?.details?.description || '');
  const [audience, setAudience] = useState(courseData?.details?.target_audience || '');
  const [difficulty, setDifficulty] = useState(courseData?.details?.difficulty || 'beginner');
  const [courseFormat, setCourseFormat] = useState(courseData?.details?.course_format || 'video');
  
  // Tab states for upload
  const [activeUploadTab, setActiveUploadTab] = useState('file');
  const [file, setFile] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [courseImageFile, setCourseImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // States for final chapters rendering
  // (Removed editingChapters state from here)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, courseData.structure]);

  const removeMessageByType = (type) => {
    setMessages((prev) => prev.filter(m => m.type !== type));
  };

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }]);
  };

  const submitTitleDesc = async () => {
    if (!description) {
      alert("Description is required.");
      return;
    }
    
    let finalTitle = title;
    if (!title) {
        addMessage({ sender: 'bot', type: 'bot_text', content: "Generating a perfect title for you..." });
        try {
            const resp = await generateCourseTitle(description);
            finalTitle = resp.title;
            // Title constraint: <= 50 chars
            if (finalTitle.length > 50) finalTitle = finalTitle.substring(0, 47) + "...";
            setTitle(finalTitle);
        } catch (e) {
            console.error(e);
            finalTitle = "My AI Generated Course";
            setTitle(finalTitle);
        }
    }

    updateCourseData('details', { ...courseData.details, title: finalTitle, description });
    
    removeMessageByType('form_title_desc');
    addMessage({ sender: 'user', type: 'user_text', content: `**Title:** ${finalTitle}\n**Description:** ${description}`, restoresForm: 'form_title_desc' });

    setTimeout(() => {
      addMessage({ sender: 'bot', type: 'bot_text', content: "Got it! Who is the target audience and what is the difficulty level for this course?" });
      addMessage({ sender: 'bot', type: 'form_audience_diff' });
    }, 500);
  };

  const handleEditMessage = (msgId, restoresForm) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1 || !restoresForm) return;
    const sliced = messages.slice(0, idx);
    setMessages([...sliced, { id: Date.now(), sender: 'bot', type: restoresForm }]);
  };

  const submitAudienceDiff = () => {
    if (!audience || !difficulty) return;
    updateCourseData('details', { 
      ...courseData.details, 
      target_audience: audience, 
      difficulty, 
      course_format: courseFormat,
      duration: "Flexible" 
    });
    
    removeMessageByType('form_audience_diff');
    addMessage({ sender: 'user', type: 'user_text', content: `**Audience:** ${audience}\n**Difficulty:** ${difficulty}\n**Format:** ${courseFormat}`, restoresForm: 'form_audience_diff' });

    setTimeout(() => {
       addMessage({ sender: 'bot', type: 'bot_text', content: "Got it! Would you like to upload a custom Course Profile Image? If you skip, I'll generate a stunning one for you using AI." });
       addMessage({ sender: 'bot', type: 'form_course_image' });
    }, 500);
  };

  const skipCourseImage = async () => {
     removeMessageByType('form_course_image');
     addMessage({ sender: 'user', type: 'user_text', content: "Auto-generate one for me.", restoresForm: 'form_course_image' });
     
     const loaderId = Date.now();
     setMessages(prev => [...prev, { id: loaderId, sender: 'bot', type: 'bot_loading' }]);
     
     try {
       const promptResp = await generateImagePrompt({ lesson_text: `${title} - ${description}` });
       // Assuming generateImage returns a DALL-E/similar URL
       const imgResp = await generateImage({ prompt: promptResp.prompt });
       // We fetch/download it and upload via our backend to persist it
       // Wait, for this demo we'll assume generateImage already handles saving or we use the URL directly 
       // but typically we'd send it to uploadThumbnail if it returned binary. 
       // If it returns a URL, let's just save the URL.
       updateCourseData('details', { ...courseData.details, thumbnail_url: imgResp.image_url });
     } catch(e) {
       console.error("AI Image Generation failed:", e);
     }
     
     setMessages(prev => prev.filter(m => m.id !== loaderId));
     askForDocument();
  };

  const handleUploadImage = async () => {
     if (!courseImageFile) return;
     setUploadingImage(true);
     try {
        const res = await uploadThumbnail(courseImageFile);
        updateCourseData('details', { ...courseData.details, thumbnail_url: res.url });
        removeMessageByType('form_course_image');
        addMessage({ sender: 'user', type: 'user_text', content: "Uploaded custom course image.", restoresForm: 'form_course_image' });
        askForDocument();
     } catch (err) {
        alert("Failed to upload image. " + (err.message));
     } finally {
        setUploadingImage(false);
     }
  };

  const askForDocument = () => {
    setTimeout(() => {
      addMessage({ sender: 'bot', type: 'bot_text', content: "Perfect! Lastly, do you have any specific source documents you'd like me to base this course on? You can upload a file, paste a Web URL, or link a YouTube Video!" });
      addMessage({ sender: 'bot', type: 'form_upload' });
    }, 500);
  };

  const handleUploadAndGenerate = async () => {
    setUploading(true);
    try {
      if (activeUploadTab === 'file' && file) {
        await uploadDoc(file);
        addMessage({ sender: 'user', type: 'user_text', content: `Uploaded ${file.name}. Please use internal document knowledge.`, restoresForm: 'form_upload' });
      } else if (activeUploadTab === 'web' && webUrl) {
        await fetchWebDocument(webUrl);
        addMessage({ sender: 'user', type: 'user_text', content: `Fetched web content from ${webUrl}.`, restoresForm: 'form_upload' });
      } else if (activeUploadTab === 'youtube' && youtubeUrl) {
        await fetchYouTubeDocument(youtubeUrl);
        addMessage({ sender: 'user', type: 'user_text', content: `Fetched transcript from ${youtubeUrl}.`, restoresForm: 'form_upload' });
      } else {
        setUploading(false);
        return;
      }
      
      updateCourseData('sourceType', 'internal');
      removeMessageByType('form_upload');
      askForOutlineSkeleton();
    } catch (err) {
      alert("Failed to fetch document: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const skipUploadAndGenerate = async () => {
    updateCourseData('sourceType', 'external');
    removeMessageByType('form_upload');
    addMessage({ sender: 'user', type: 'user_text', content: "No documents to upload. Please use external knowledge.", restoresForm: 'form_upload' });
    askForOutlineSkeleton();
  };

  const askForOutlineSkeleton = () => {
    setTimeout(() => {
      addMessage({ sender: 'bot', type: 'bot_text', content: "Awesome! Let's generate the outline. How many modules and chapters would you like?" });
      addMessage({ sender: 'bot', type: 'form_outline_skeleton' });
    }, 500);
  };

  // Callback from OutlineForm
  const handleOutlineGenerated = (modules, settings) => {
    updateCourseData('structure', { modules, settings });
    removeMessageByType('form_outline_skeleton');
    addMessage({ sender: 'user', type: 'user_text', content: `Generated outline skeleton.`, restoresForm: 'form_outline_skeleton' });
    addMessage({ sender: 'bot', type: 'bot_text', content: "Here's the structure. Review or edit, then click Confirm." });
    addMessage({ sender: 'bot', type: 'card_structure' });
  };


  const handleAddModule = () => {
    const modules = [...(courseData.structure?.modules || []), { title: 'New Module', chapters: [] }];
    updateCourseData('structure', { modules });
  };
  const handleRemoveModule = (modIdx) => {
    const modules = courseData.structure.modules.filter((_, i) => i !== modIdx);
    updateCourseData('structure', { modules });
  };
  const handleModuleTitleChange = (modIdx, val) => {
    const modules = [...courseData.structure.modules];
    modules[modIdx].title = val;
    updateCourseData('structure', { modules });
  };
  const handleAddChapter = (modIdx) => {
    const modules = [...courseData.structure.modules];
    modules[modIdx].chapters.push({ title: 'New Chapter' });
    updateCourseData('structure', { modules });
  };
  const handleRemoveChapter = (modIdx, chapIdx) => {
    const modules = [...courseData.structure.modules];
    modules[modIdx].chapters = modules[modIdx].chapters.filter((_, i) => i !== chapIdx);
    updateCourseData('structure', { modules });
  };
  const handleChapterTitleChange = (modIdx, chapIdx, val) => {
    const modules = [...courseData.structure.modules];
    modules[modIdx].chapters[chapIdx].title = val;
    updateCourseData('structure', { modules });
  };

  const handleConfirmStructure = () => {
    removeMessageByType('card_structure');
    addMessage({ sender: 'user', type: 'user_text', content: `Structure confirmed! Ready to build chapters.`, restoresForm: 'card_structure' });
    onNext();
  };

  const handleRegenerateOutline = () => {
    removeMessageByType('card_structure');
    addMessage({ sender: 'bot', type: 'form_outline_skeleton' });
  };

  // Removed handleSaveChapterContent and handlePublishCourse from here



  const renderMessageContent = (msg) => {
    if (msg.type === 'bot_text') {
      return <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
    }
    
    if (msg.type === 'user_text') {
      const parts = msg.content.split('**');
      return (
        <p className="text-white leading-relaxed whitespace-pre-wrap">
          {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
        </p>
      );
    }

    if (msg.type === 'bot_loading') {
      return (
        <div className="flex items-center space-x-2 text-indigo-600">
          <Loader2 className="animate-spin h-5 w-5" />
          <span>Generating magic...</span>
        </div>
      );
    }

    if (msg.type === 'form_title_desc') {
      return (
        <div className="space-y-4 w-full md:w-96 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
              Course Title <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded ml-2 font-semibold">Optional</span>
            </label>
            <input 
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} 
              placeholder="Leave blank for AI generation (max 50 chars)"
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoFocus
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea 
              value={description} onChange={(e) => setDescription(e.target.value)} 
              rows={3}
              placeholder="What will students learn?"
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <button 
            onClick={submitTitleDesc}
            disabled={!description}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md py-2.5 font-bold text-sm hover:from-indigo-600 hover:to-indigo-700 border-none shadow-sm disabled:opacity-50 transition transform active:scale-[0.98]"
          >
            Submit Details
          </button>
        </div>
      );
    }

    if (msg.type === 'form_audience_diff') {
      return (
        <div className="space-y-4 w-full md:w-96 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <input 
              type="text" value={audience} onChange={(e) => setAudience(e.target.value)} 
              placeholder="e.g. Frontend Developers"
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
            <select 
              value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Format</label>
            <select 
              value={courseFormat} onChange={(e) => setCourseFormat(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="video">🎥 Video Course (AI Avatars)</option>
              <option value="image">🖼️ Image + Text Slate</option>
              <option value="html">🌐 HTML Rich Lesson</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Objectives (comma separated)</label>
            <input 
              type="text" 
              value={courseData.details?.learning_objectives?.join(", ") || ""} 
              onChange={(e) => updateCourseData('details', { ...courseData.details, learning_objectives: e.target.value.split(',').map(s=>s.trim()) })} 
              placeholder="e.g. Learn React, Master Hooks"
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          <button 
            onClick={submitAudienceDiff}
            disabled={!audience}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md py-2.5 font-bold text-sm hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition shadow-sm transform active:scale-[0.98]"
          >
            Submit Audience Info
          </button>
        </div>
      );
    }

    if (msg.type === 'form_course_image') {
      return (
        <div className="space-y-4 w-full md:w-96 rounded-lg bg-indigo-50/50 p-4 border border-indigo-100 backdrop-blur-sm">
          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 flex flex-col items-center justify-center bg-white/70 text-center text-sm">
            <UploadCloud className="h-10 w-10 text-indigo-400 mb-3" />
            <input 
               type="file" 
               accept="image/png, image/jpeg" 
               onChange={(e) => setCourseImageFile(e.target.files[0])}
               className="w-full file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <div className="flex flex-col space-y-2 pt-2">
            <button 
              onClick={handleUploadImage}
              disabled={!courseImageFile || uploadingImage}
              className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md py-2.5 font-bold text-sm shadow-sm flex items-center justify-center disabled:opacity-50"
            >
              {uploadingImage ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...</> : 'Upload Thumbnail'}
            </button>
            <button 
              onClick={skipCourseImage}
              className="w-full bg-white border border-gray-300 text-gray-700 rounded-md py-2 font-bold text-sm hover:bg-gray-50 transition shadow-sm"
            >
              Skip & Auto-Generate
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'form_upload') {
      return (
        <div className="space-y-4 w-full md:w-96 rounded-lg bg-indigo-50/50 p-4 border border-indigo-100 backdrop-blur-sm">
          <div className="flex space-x-1 bg-white p-1 rounded-md shadow-sm mb-4">
             <button onClick={()=>setActiveUploadTab('file')} className={`flex-1 flex justify-center py-1.5 text-xs font-bold rounded ${activeUploadTab === 'file' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                <UploadCloud className="w-3.5 h-3.5 mr-1" /> File
             </button>
             <button onClick={()=>setActiveUploadTab('web')} className={`flex-1 flex justify-center py-1.5 text-xs font-bold rounded ${activeUploadTab === 'web' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Globe className="w-3.5 h-3.5 mr-1" /> Web URL
             </button>
             <button onClick={()=>setActiveUploadTab('youtube')} className={`flex-1 flex justify-center py-1.5 text-xs font-bold rounded ${activeUploadTab === 'youtube' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Video className="w-3.5 h-3.5 mr-1" /> YouTube
             </button>
          </div>

          <div className="bg-white/70 border border-indigo-100 rounded-lg p-5 flex flex-col justify-center text-center">
            {activeUploadTab === 'file' && (
              <>
                 <input type="file" accept=".pdf,.docx,.txt,.csv" onChange={(e) => setFile(e.target.files[0])} className="text-sm w-full file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700"/>
              </>
            )}
            {activeUploadTab === 'web' && (
              <div className="flex relative items-center">
                 <Link className="absolute left-3 w-4 h-4 text-gray-400" />
                 <input type="url" value={webUrl} onChange={e=>setWebUrl(e.target.value)} placeholder="https://example.com" className="w-full pl-9 pr-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            )}
            {activeUploadTab === 'youtube' && (
              <div className="flex relative items-center">
                 <Video className="absolute left-3 w-4 h-4 text-gray-400" />
                 <input type="url" value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} placeholder="YouTube Video URL" className="w-full pl-9 pr-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-2 pt-2">
            <button 
              onClick={handleUploadAndGenerate}
              disabled={uploading || (activeUploadTab==='file'&&!file) || (activeUploadTab==='web'&&!webUrl) || (activeUploadTab==='youtube'&&!youtubeUrl)}
              className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md py-2.5 font-bold text-sm shadow-sm disabled:opacity-50 flex justify-center items-center"
            >
              {uploading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Processing...</> : 'Import Context'}
            </button>
            <button onClick={skipUploadAndGenerate} className="w-full bg-white border border-gray-300 text-gray-700 rounded-md py-2 font-bold text-sm hover:bg-gray-50 transition shadow-sm">
              Skip Import
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'form_outline_skeleton') {
      return (
         <OutlineForm description={courseData.details.description} onOutlineGenerated={handleOutlineGenerated} />
      );
    }

    if (msg.type === 'card_structure') {
      const { structure } = courseData;
      return (
        <div className="w-full md:min-w-[500px] bg-white border border-indigo-200 shadow-md rounded-xl overflow-hidden mt-2 backdrop-blur-md">
           <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
             <h3 className="font-semibold text-indigo-900 flex items-center text-sm">Course Structure Outline</h3>
           </div>
           
           <div className="p-4 bg-gray-50 space-y-4 max-h-[500px] overflow-y-auto">
             {!structure?.modules?.length ? (
               <p className="text-center text-gray-500 text-sm py-4">No structure found.</p>
             ) : (
                structure.modules.map((mod, modIdx) => (
                  <div key={modIdx} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm transition hover:shadow-md">
                    <div className="flex justify-between items-center mb-3">
                      <input 
                        type="text" value={mod.title} onChange={(e) => handleModuleTitleChange(modIdx, e.target.value)}
                        className="font-bold text-gray-800 text-sm border-b border-transparent hover:border-gray-300 focus:outline-none p-1 w-full mr-4 bg-transparent"
                      />
                      <button onClick={() => handleRemoveModule(modIdx)} className="text-red-400 hover:text-red-600 p-1 rounded transition"><Trash2 className="h-4 w-4" /></button>
                    </div>

                    <div className="pl-4 space-y-2 border-l-2 border-indigo-100 ml-1 pb-1">
                      {mod.chapters.map((chap, chapIdx) => (
                        <div key={chapIdx} className="flex items-center justify-between group bg-gray-50/50 rounded p-1 -ml-2 pl-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mr-2 flex-shrink-0"></div>
                          <input 
                            type="text" value={chap.title} onChange={(e) => handleChapterTitleChange(modIdx, chapIdx, e.target.value)}
                            className="text-sm font-medium border-b border-transparent hover:border-gray-300 focus:outline-none p-1 w-full mr-2 bg-transparent text-gray-700"
                          />
                          <button onClick={() => handleRemoveChapter(modIdx, chapIdx)} className="text-gray-400 group-hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <button onClick={() => handleAddChapter(modIdx)} className="mt-2 text-xs flex items-center text-indigo-500 font-bold hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition -ml-2">
                        <Plus className="h-3 w-3 mr-1" /> Add Chapter
                      </button>
                    </div>
                  </div>
                ))
             )}
             <button onClick={handleAddModule} className="inline-flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-bold text-gray-500 bg-white hover:bg-gray-50 hover:text-indigo-600 transition">
               <Plus className="h-4 w-4 mr-1" /> Add Module
             </button>
           </div>
           
           <div className="bg-white px-4 py-3 border-t border-gray-100 flex justify-between items-center">
             <button onClick={handleRegenerateOutline} className="text-sm font-bold text-gray-500 hover:text-indigo-600 transition flex items-center bg-gray-50 px-3 py-2 rounded shadow-sm border border-gray-200">
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Outline
             </button>
             <button onClick={handleConfirmStructure} className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold px-5 py-2.5 rounded-lg hover:from-indigo-600 hover:to-indigo-700 shadow-sm flex items-center transition">
               <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Edit Content
             </button>
           </div>
        </div>
      );
    }
    return null;
  };

  // Removed editingChapters render block


  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white/90 backdrop-blur-sm">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 flex items-center shadow-sm">
        <Bot className="text-indigo-100 w-8 h-8 mr-3" />
        <div>
           <h2 className="text-lg font-bold text-white">Course Creation Assistant</h2>
           <p className="text-indigo-200 text-xs font-medium">I'll help you prepare your course in seconds.</p>
        </div>
      </div>

      <Chatbot 
        messages={messages} 
        renderMessageContent={renderMessageContent} 
        handleEditMessage={handleEditMessage} 
      />
    </div>
  );
}
