import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, RefreshCw, Minus, X, Send, Sparkles, Wand2, PencilLine, CheckCircle2, Loader2, MessageSquareText, ChevronDown, Maximize2, Zap } from 'lucide-react';
import { chatWithAI } from '../api';

export default function AIAssistantSidebar({ details, courseData, onApply, onClose, scope = 'Course Details', initialInput = '', availableSubjects = [], onGenerateAllContent }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: details?.courseName 
        ? `I see you've already started: "${details.courseName}". How can I help you refine these details?`
        : "Hi! I'm your AI Course Assistant. I can help you brainstorm your course name, description, and requirements. What subject are we working on today?",
      type: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const processedInputRef = useRef(null);

  const [isMinimized, setIsMinimized] = useState(false);

  const scrollToBottom = () => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isMinimized]);

  useEffect(() => {
    if (initialInput) {
      const inputKey = typeof initialInput === 'object' ? initialInput.text : initialInput;
      if (processedInputRef.current === inputKey) {
        return; // Already processed this initial input, skip!
      }
      processedInputRef.current = inputKey;

      if (typeof initialInput === 'object') {
        if (initialInput.fillInput) setInput(initialInput.text);
        handleSend(initialInput.text, initialInput.display);
      } else {
        setInput(initialInput);
        handleSend(initialInput);
      }
    }
  }, [initialInput]);

  const handleSend = async (overrideInput = null, displayMessage = null) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { 
      id: Date.now(), 
      sender: 'user', 
      text: displayMessage || textToSend, 
      hiddenPrompt: overrideInput ? textToSend : null,
      type: 'text' 
    };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideInput) setInput('');
    setLoading(true);
    try {
      const chatHistory = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.hiddenPrompt || m.text || ''
      }));
      chatHistory.push({ role: 'user', content: textToSend });

      const resp = await chatWithAI(chatHistory, scope, details, courseData, availableSubjects);
      
      const reply = resp.reply || '';
      const metadata = resp.metadata;
      const type = resp.type;

      if (reply && reply.trim().length > 0) {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: reply.trim(), type: 'text' }]);
      }

      if (metadata && type) {
        if (type === 'details') {
          setMessages(prev => [...prev, { 
            id: Date.now() + 1, 
            sender: 'ai', 
            type: 'suggestion_details', 
            data: metadata 
          }]);
        } else if (type === 'structure') {
          setMessages(prev => [...prev, { 
            id: Date.now() + 2, 
            sender: 'ai', 
            type: 'suggestion_structure', 
            data: metadata 
          }]);
        } else if (type === 'content') {
          setMessages(prev => [...prev, { 
            id: Date.now() + 5, 
            sender: 'ai', 
            type: 'suggestion_content', 
            data: metadata 
          }]);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: "Sorry, I'm having trouble connecting right now.", type: 'text' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSuggestion = (msgId, field, value) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return { ...m, data: { ...m.data, [field]: value } };
      }
      return m;
    }));
  };

  const handleUpdateObjective = (msgId, objIdx, value) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const newObjs = [...(m.data?.learning_objectives || [])];
        newObjs[objIdx] = value;
        return { ...m, data: { ...m.data, learning_objectives: newObjs } };
      }
      return m;
    }));
  };

  const handleApplyAISuggestion = (suggestion) => {
    onApply(suggestion);
  };

  return (
    <div className={`flex flex-col bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-500 transition-all flex-shrink-0 ${isMinimized ? 'h-[72px] w-[320px]' : 'h-[800px] w-[400px]'}`}>
      <div className="bg-white border-b border-gray-50 p-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-2">
            AI Assistant
            <span className="bg-sky-50 text-sky-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">BETA</span>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMessages([{ id: 1, sender: 'ai', text: "Let's start over! What subject are we working on?", type: 'text' }])} className="p-2 hover:bg-slate-50 rounded-lg transition text-slate-400" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-2 hover:bg-slate-50 rounded-lg transition text-slate-400" 
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg transition text-slate-400" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="px-4 py-3 bg-white border-b border-slate-50">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Current Scope</label>
             <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-600 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-sky-100 shadow-sm">
                <Sparkles className="w-3 h-3" />
                {scope}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white scroll-smooth no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                <div className={`flex max-w-[95%] gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.sender === 'user' ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-100'}`}>
                    {msg.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-sky-600" />}
                  </div>
                  
                  {msg.type === 'text' && (
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}`}>
                      {msg.text}
                    </div>
                  )}

                  {msg.type === 'suggestion_details' && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                      <p className="text-[11px] text-slate-500 font-medium mb-3">Draft Course Details:</p>
                      <div className="grid grid-cols-2 gap-4 border-l-2 border-sky-100 pl-4 py-1">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Course Type:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.courseType} onChange={(e) => handleUpdateSuggestion(msg.id, 'courseType', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Subject Name:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.subject} onChange={(e) => handleUpdateSuggestion(msg.id, 'subject', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px] col-span-2">
                          <span className="font-bold text-slate-900">Course Name:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.courseName} onChange={(e) => handleUpdateSuggestion(msg.id, 'courseName', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px] col-span-2">
                          <span className="font-bold text-slate-900">Course Description:</span>
                          <textarea className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-medium text-slate-600 outline-none resize-none" rows={3} value={msg.data?.description} onChange={(e) => handleUpdateSuggestion(msg.id, 'description', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Course Price:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.price} onChange={(e) => handleUpdateSuggestion(msg.id, 'price', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Course Duration (Days):</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.duration} onChange={(e) => handleUpdateSuggestion(msg.id, 'duration', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px] col-span-2">
                          <span className="font-bold text-slate-900">Requirements:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.requirements} onChange={(e) => handleUpdateSuggestion(msg.id, 'requirements', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Course Level:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.level} onChange={(e) => handleUpdateSuggestion(msg.id, 'level', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Course Language:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.language} onChange={(e) => handleUpdateSuggestion(msg.id, 'language', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Scripting Language:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.scriptingLanguage} onChange={(e) => handleUpdateSuggestion(msg.id, 'scriptingLanguage', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-900">Evaluator:</span>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-slate-600 outline-none" value={msg.data?.evaluator} onChange={(e) => handleUpdateSuggestion(msg.id, 'evaluator', e.target.value)} />
                        </div>
                      </div>
                      <div className="pt-2 flex gap-2 border-t border-slate-50 mt-4">
                         <button onClick={() => handleApplyAISuggestion(msg.data)} className="flex-1 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Apply Details</button>
                         <button onClick={() => handleSend("Refine these details to be more professional.", "Refine Details")} className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition">Refine Details</button>
                      </div>
                    </div>
                  )}

                  {msg.type === 'suggestion_structure' && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                      <p className="text-[11px] text-slate-500 font-medium mb-3">Here's a suggested course structure based on your current progress:</p>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar border-l-2 border-sky-100 pl-4 py-1">
                        {(msg.data?.modules || []).map((mod, modIdx) => (
                          <div key={modIdx} className="space-y-1">
                            <h4 className="text-[11px] font-bold text-slate-900 flex items-center gap-2">
                              {modIdx + 1}. {mod.title}
                              <span className="text-[9px] font-medium text-slate-400">{(mod.chapters || []).length} lessons</span>
                            </h4>
                            <div className="pl-3 space-y-1">
                              {(mod.chapters || []).map((chap, chapIdx) => (
                                <div key={chapIdx} className="text-[10px] text-slate-500 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                                  {chap.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 flex gap-2 border-t border-slate-50 mt-4">
                         <button onClick={() => onApply(msg.data)} className="flex-1 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Apply Structure</button>
                         <button onClick={() => handleSend("Optimize the logical flow of the course structure. YOU MUST RETURN THE ENTIRE UPDATED COURSE STRUCTURE WITHIN A [METADATA]...[/METADATA] BLOCK MATCHING THE STRUCTURE SCHEMA.", "Refine Structure")} className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition">Refine Structure</button>
                      </div>
                    </div>
                  )}

                  {msg.type === 'suggestion_content' && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                       <p className="text-[11px] text-slate-500 font-medium mb-1">
                         {msg.data?.prompt ? "I've generated a refined prompt for your lesson:" : "I've generated detailed prompts for all lessons:"}
                       </p>
                       
                       <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 border-l-2 border-sky-100 pl-4 py-1 custom-scrollbar">
                         {msg.data?.prompt ? (
                            <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{msg.data.title || 'Lesson Prompt'}</h4>
                                {msg.data.module && <span className="text-[8px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded uppercase">{msg.data.module}</span>}
                              </div>
                              <p className="text-[11px] text-slate-600 italic leading-relaxed whitespace-pre-wrap">"{msg.data.prompt}"</p>
                            </div>
                         ) : (
                            (msg.data?.prompts || []).map((p, i) => (
                              <div key={i} className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{p.title || p.lesson || 'Untitled Lesson'}</h4>
                                  {p.module && <span className="text-[8px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded uppercase">{p.module}</span>}
                                </div>
                                <p className="text-[11px] text-slate-600 italic leading-relaxed whitespace-pre-wrap">"{p.prompt}"</p>
                              </div>
                            ))
                         )}
                       </div>

                       <div className="pt-2 grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => onApply(msg.data?.prompt ? msg.data : { prompts: msg.data.prompts })} 
                            className="bg-sky-600 text-white px-4 py-3 rounded-xl text-[10px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2 shadow-lg shadow-sky-100 active:scale-95"
                          >
                            <Zap className="w-3 h-3" /> {msg.data?.prompt ? 'Apply Prompt' : 'Apply All'}
                          </button>
                          <button onClick={() => handleSend("Regenerate.", "Regenerate")} className="bg-white border-2 border-slate-100 text-slate-600 px-4 py-3 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2 active:scale-95">
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="flex max-w-[95%] gap-3 flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border bg-sky-50 border-sky-100">
                    <Bot className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span className="text-slate-500 font-medium">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-50">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask anything about your course..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-4 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-sky-100 focus:border-sky-300 transition-all outline-none"
              />
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="absolute right-2 p-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition disabled:opacity-50 disabled:bg-slate-300 shadow-md shadow-sky-100"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
               {scope.includes("Details") && (
                 <>
                   {(() => {
                     const lastSuggestion = [...messages].reverse().find(m => m.type === 'suggestion_details')?.data;
                     const activeName = details?.courseName || lastSuggestion?.courseName || '';
                     const hasSuggestion = messages.some(m => m.type === 'suggestion_details');
                     
                     if (!hasSuggestion) {
                       return <button onClick={() => handleSend(`Suggest a course name, description, subject, requirements, level, and duration for "${activeName || 'a new subject'}". YOU MUST RETURN THE [METADATA] BLOCK.`, "Suggest Details")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Suggest Details</button>;
                     }
                     
                     return (
                       <>
                         <button onClick={() => handleSend("Refine the requirements and description.", "Refine Details")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Refine Details</button>
                       </>
                     );
                   })()}
                 </>
               )}
               
               {scope.includes("Structure") && (
                 <>
                   {(() => {
                     const lastSuggestion = [...messages].reverse().find(m => m.type === 'suggestion_structure')?.data;
                     const currentModules = lastSuggestion?.modules || courseData?.structure?.modules || [];
                     const hasSuggestion = messages.some(m => m.type === 'suggestion_structure');
 
                     const handleAddModules = () => {
                       if (currentModules.length >= 10) {
                         setMessages(prev => [
                           ...prev,
                           { id: Date.now(), sender: 'user', text: 'Add Modules', type: 'text' },
                           { id: Date.now() + 1, sender: 'ai', text: 'The course has reached the recommended limit of 10 modules. Try refining the existing topics instead.', type: 'text' }
                         ]);
                         return;
                       }
                        const prompt = currentModules.length === 0 
                          ? `The current structure is empty. Please generate a complete course structure with exactly 2 new, distinct modules (each containing 3-4 lessons) based on the course details. YOU MUST RETURN THE ENTIRE UPDATED COURSE STRUCTURE WITHIN A [METADATA]...[/METADATA] BLOCK MATCHING THE STRUCTURE SCHEMA.`
                          : `Keep the existing modules exactly as they are: ${JSON.stringify(currentModules)}. Suggest exactly 2 new, distinct modules to follow these that add more value to the course based on the course objectives. YOU MUST RETURN THE ENTIRE UPDATED COURSE STRUCTURE CONTAINING ALL THE EXISTING MODULES PLUS THE 2 NEW ONES WITHIN A [METADATA]...[/METADATA] BLOCK MATCHING THE STRUCTURE SCHEMA.`;
                        handleSend(prompt, "Add Modules");
                      };

                      const handleRefineTopics = () => {
                        const prompt = `Keep the Module titles exactly as they are: ${JSON.stringify(currentModules.map(m => m.title || m.module_title))}. For each module, refine the chapter/lesson titles to be more practical, hands-on, and engaging. DO NOT add or remove modules. YOU MUST RETURN THE ENTIRE UPDATED COURSE STRUCTURE WITH THE REFINE TOPICS WITHIN A [METADATA]...[/METADATA] BLOCK MATCHING THE STRUCTURE SCHEMA.`;
                        handleSend(prompt, "Refine Topics");
                      };
 
                     if (!hasSuggestion) {
                        return <button onClick={() => handleSend("Generate a complete course structure.", "Suggest Structure")} className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow">Suggest Structure</button>;
                      }
 
                     return (
                       <>
                         <button onClick={handleAddModules} className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow">Add Modules</button>
                         <button onClick={handleRefineTopics} className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow">Refine Topics</button>
                       </>
                     );
                   })()}
                 </>
               )}
 
                {scope.includes("Content") && (
                  <div className="flex flex-wrap gap-2">
                    <button 
                       onClick={() => {
                          const prompt = `Please generate high-quality, practical, and EXTREMELY detailed AI content generation prompts for ALL lessons in this course. 

                          QUALITY STANDARD:
                          For every single lesson, the prompt must be a comprehensive guide that is exactly 100 to 150 words long. 
                          Example of quality: "Write a comprehensive chapter on the fundamentals of Python variables. You must cover naming conventions, dynamic typing, and memory allocation in deep detail. Use a 'Storage Box' analogy to make it easy for beginners to understand. Include exactly 3 hands-on coding exercises where the user has to declare different types of variables, and provide a 5-question multiple choice quiz on Python naming rules at the end. Ensure the tone is encouraging and professional."

                          CRITICAL RULE: Do NOT provide short or generic single-line summaries. If a course has 10 lessons, you must provide 10 long, highly detailed prompts, each being 100-150 words.

                          Course Context:
                          - Title: "${details?.courseName || details?.title}"
                          - Description: "${details?.description}"

                          RETURN THE FULL LIST:
                          Format: { "prompts": [ { "module": "...", "title": "...", "prompt": "..." } ] }`;
                          handleSend(prompt, "Generate All Prompts");
                       }} 
                       className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow"
                     >
                       <Bot className="w-3 h-3 text-sky-500" />
                       <span>Generate All Prompts</span>
                     </button>

                     <button 
                       onClick={onGenerateAllContent}
                       className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow"
                     >
                       <Zap className="w-3 h-3 text-sky-500 animate-pulse" />
                       <span>Generate All Content</span>
                     </button>

                     {messages.some(m => m.type === 'suggestion_content') && (
                       <>
                         <button onClick={() => handleSend("Make prompts more practical.", "Practical Focus")} className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow">Practical Focus</button>
                         <button onClick={() => handleSend("Make prompts more academic.", "Academic Focus")} className="text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:scale-95 active:bg-sky-100 transition-all border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow">Academic Focus</button>
                       </>
                     )}
                   </div>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
