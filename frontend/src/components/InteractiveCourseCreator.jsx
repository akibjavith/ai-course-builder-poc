import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, UploadCloud, CheckCircle, Loader2, Database, Globe, Trash2, Plus } from 'lucide-react';
import { uploadDoc, generateStructure } from '../api';

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

  // Form states locally so we don't mess up courseData until confirmed
  const [title, setTitle] = useState(courseData?.details?.title || '');
  const [description, setDescription] = useState(courseData?.details?.description || '');
  const [audience, setAudience] = useState(courseData?.details?.target_audience || '');
  const [difficulty, setDifficulty] = useState(courseData?.details?.difficulty || 'beginner');
  const [file, setFile] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [learningObjectives, setLearningObjectives] = useState(courseData?.details?.learning_objectives || ['']);
  const [duration, setDuration] = useState(courseData?.details?.duration || '');


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

  // Handlers for steps
  const submitTitleDesc = () => {
    if (!title || !description) return;
    updateCourseData('details', { ...courseData.details, title, description });
    
    // Remove the form, show user message
    removeMessageByType('form_title_desc');
    addMessage({ sender: 'user', type: 'user_text', content: `**Title:** ${title}\n**Description:** ${description}` });

    // Next bot question
    setTimeout(() => {
      addMessage({ sender: 'bot', type: 'bot_text', content: "Got it! Who is the target audience, what's the difficulty level, and what is the estimated duration of that course?" });
      addMessage({ sender: 'bot', type: 'form_audience_diff' });
    }, 500);
  };

  const submitAudienceDiff = () => {
    if (!audience || !duration) return;
    updateCourseData('details', { ...courseData.details, target_audience: audience, difficulty, duration });
    
    removeMessageByType('form_audience_diff');
    addMessage({ sender: 'user', type: 'user_text', content: `**Audience:** ${audience}\n**Difficulty:** ${difficulty}\n**Duration:** ${duration}` });

    setTimeout(() => {
      addMessage({ sender: 'bot', type: 'bot_text', content: "Perfect! Lastly, do you have any specific source documents (PDF/DOCX) you'd like me to base this course on? If you upload a file, I'll use it as 'Internal Context'. Otherwise, I'll rely on my 'External AI' knowledge." });
      addMessage({ sender: 'bot', type: 'form_upload' });
    }, 500);
  };

  const skipUploadAndGenerate = async () => {
    updateCourseData('sourceType', 'external');
    removeMessageByType('form_upload');
    addMessage({ sender: 'user', type: 'user_text', content: "No documents to upload. Please use external knowledge." });
    startGeneration('external');
  };

  const handleUploadAndGenerate = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDoc(file);
      setUploadSuccess(true);
      updateCourseData('sourceType', 'internal');
      
      removeMessageByType('form_upload');
      addMessage({ sender: 'user', type: 'user_text', content: `Uploaded ${file.name}. Please use internal document knowledge.` });
      startGeneration('internal');
    } catch (err) {
      alert("Failed to upload document: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const startGeneration = async (sourceType) => {
    addMessage({ sender: 'bot', type: 'bot_text', content: "Excellent! I'm putting together a comprehensive course outline based on everything you've told me so far. One moment..." });
    const loadMsgId = Date.now();
    setMessages(prev => [...prev, { id: loadMsgId, sender: 'bot', type: 'bot_loading' }]);
    
    try {
      const data = await generateStructure(sourceType, courseData.details);
      updateCourseData('structure', data.data);
      
      // Remove loading
      setMessages(prev => prev.filter(m => m.id !== loadMsgId));
      addMessage({ sender: 'bot', type: 'bot_text', content: "Here's the structure I came up with! Feel free to review it, edit module and chapter titles, add or remove them as needed. Once you are happy with it, click 'Confirm & Create Content'." });
      addMessage({ sender: 'bot', type: 'card_structure' });
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== loadMsgId));
      addMessage({ sender: 'bot', type: 'bot_text', content: "Uh oh, something went wrong while generating the structure. You can try hitting 'Confirm & Create Content' below to bypass or refresh to try again." });
      addMessage({ sender: 'bot', type: 'card_structure' }); // Let them manually build it
    }
  };


  // Helpers for Structure editor
  const handleAddModule = () => {
    const modules = [...courseData.structure.modules, { title: 'New Module', chapters: [] }];
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
    // We update the content via onNext
    onNext();
  };


  // RENDERERS
  const renderMessageContent = (msg) => {
    if (msg.type === 'bot_text') {
      return <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
    }
    
    if (msg.type === 'user_text') {
      // Very basic markdown parse for bold
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
            <input 
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. Introduction to React 18"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              value={description} onChange={(e) => setDescription(e.target.value)} 
              rows={3}
              placeholder="What will students learn?"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <button 
            onClick={submitTitleDesc}
            disabled={!title || !description}
            className="w-full bg-indigo-600 text-white rounded-md py-2 font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
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
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <input 
              type="text" value={duration} onChange={(e) => setDuration(e.target.value)} 
              placeholder="e.g. 2 hours"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select 
              value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <button 
            onClick={submitAudienceDiff}
            disabled={!audience || !duration}
            className="w-full bg-indigo-600 text-white rounded-md py-2 font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            Submit Audience Info
          </button>
        </div>
      );
    }

    if (msg.type === 'form_upload') {
      return (
        <div className="space-y-4 w-full md:w-96 rounded-lg bg-indigo-50/50 p-4 border border-indigo-100">
          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 flex flex-col items-center justify-center bg-white text-center">
            <UploadCloud className="h-10 w-10 text-indigo-400 mb-3" />
            <p className="text-sm text-gray-600 mb-4">Upload a PDF or DOCX file to use as course material context.</p>
            <input 
               type="file" 
               accept=".pdf,.docx" 
               onChange={(e) => setFile(e.target.files[0])}
               className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          
          <div className="flex flex-col space-y-3 pt-2">
            <button 
              onClick={handleUploadAndGenerate}
              disabled={!file || uploading}
              className="w-full bg-indigo-600 text-white rounded-md py-2 font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center"
            >
              {uploading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...</> : 'Upload & Generate Structure'}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-indigo-50/50 text-gray-500">Or</span></div>
            </div>

            <button 
              onClick={skipUploadAndGenerate}
              className="w-full bg-white border border-gray-300 text-gray-700 rounded-md py-2 font-medium hover:bg-gray-50 transition shadow-sm"
            >
              Skip Upload & Generate Structure
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'card_structure') {
      const { structure } = courseData;
      return (
        <div className="w-full md:min-w-[500px] bg-white border border-indigo-200 shadow-md rounded-xl overflow-hidden mt-2">
           <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
             <h3 className="font-semibold text-indigo-900 flex items-center">
               Course Structure Outline
             </h3>
           </div>
           
           <div className="p-4 bg-gray-50 space-y-4 max-h-[500px] overflow-y-auto">
             {!structure?.modules?.length ? (
               <p className="text-center text-gray-500 text-sm py-4">No structure found or generation failed. Add modules manually.</p>
             ) : (
                structure.modules.map((mod, modIdx) => (
                  <div key={modIdx} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm transition hover:shadow-md">
                    <div className="flex justify-between items-center mb-3">
                      <input 
                        type="text" 
                        value={mod.title} 
                        onChange={(e) => handleModuleTitleChange(modIdx, e.target.value)}
                        className="font-bold text-gray-800 text-base border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none p-1 w-full mr-4 bg-transparent"
                      />
                      <button onClick={() => handleRemoveModule(modIdx)} className="text-red-400 hover:text-red-600 p-1 rounded transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="pl-4 space-y-2 border-l-2 border-indigo-100 ml-1 pb-1">
                      {mod.chapters.map((chap, chapIdx) => (
                        <div key={chapIdx} className="flex items-center justify-between group bg-gray-50/50 rounded p-1 -ml-2 pl-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mr-2 flex-shrink-0"></div>
                          <input 
                            type="text" 
                            value={chap.title} 
                            onChange={(e) => handleChapterTitleChange(modIdx, chapIdx, e.target.value)}
                            className="text-sm font-medium border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none p-1 w-full mr-2 bg-transparent text-gray-700"
                          />
                          <button onClick={() => handleRemoveChapter(modIdx, chapIdx)} className="text-gray-400 group-hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 rounded transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      
                      <button onClick={() => handleAddChapter(modIdx)} className="mt-2 text-xs flex items-center text-indigo-500 font-medium hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition -ml-2">
                        <Plus className="h-3 w-3 mr-1" /> Add Chapter
                      </button>
                    </div>
                  </div>
                ))
             )}

             <button 
               onClick={handleAddModule}
               className="inline-flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition"
             >
               <Plus className="h-4 w-4 mr-1" /> Add Module
             </button>
           </div>
           
           <div className="bg-white px-4 py-3 border-t border-gray-100 flex justify-end">
             <button 
               onClick={handleConfirmStructure}
               className="bg-indigo-600 text-white font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center transition"
             >
               <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Create Content
             </button>
           </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[500px] border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
      {/* Header */}
      <div className="bg-indigo-600 px-6 py-4 flex items-center">
        <Bot className="text-indigo-100 w-8 h-8 mr-3" />
        <div>
           <h2 className="text-lg font-bold text-white">Course Creation Assistant</h2>
           <p className="text-indigo-200 text-xs">I'll help you prepare your course in seconds.</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[90%] sm:max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${msg.sender === 'user' ? 'bg-indigo-100 ml-3' : 'bg-indigo-600 mr-3'}`}>
                {msg.sender === 'user' ? <User className="h-5 w-5 text-indigo-700" /> : <Bot className="h-5 w-5 text-white" />}
              </div>

              {/* Message Bubble */}
              <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`relative rounded-2xl px-4 py-3 shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                  } ${msg.type.startsWith('form') || msg.type === 'card_structure' ? 'w-full' : ''}`}
                >
                  {renderMessageContent(msg)}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
