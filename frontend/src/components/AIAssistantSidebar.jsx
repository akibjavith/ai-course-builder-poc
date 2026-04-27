import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, RefreshCw, Minus, X, Send, Sparkles, Wand2, PencilLine, CheckCircle2, Loader2, MessageSquareText, ChevronDown, Maximize2 } from 'lucide-react';
import { chatWithAI } from '../api';

export default function AIAssistantSidebar({ details, onApply, onClose, scope = 'Course Details' }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: details?.title 
        ? `I see you've already started: "${details.title}". How can I help you refine these details?`
        : "Hi! I'm your AI Course Assistant. I can help you brainstorm your course title, description, and objectives. What subject are we working on today?",
      type: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [isMinimized, setIsMinimized] = useState(false);

  const scrollToBottom = () => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isMinimized]);

  const handleSend = async (overrideInput) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { id: Date.now(), sender: 'user', text: textToSend, type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const chatHistory = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text || ''
      }));
      chatHistory.push({ role: 'user', content: textToSend });

      const systemMsg = { 
        role: 'system', 
        content: `You are a course creation assistant. CURRENT CONTEXT: ${JSON.stringify(details)}. 
        CURRENT SCOPE: ${scope}.

        If scope is "Course Details": Suggest Title, Description, Audience, Difficulty, and Objectives. 
        If scope is "Step 3: Course Structure": Suggest a list of Modules, each containing multiple Chapters (lessons).

        Always wrap your final suggestion in [METADATA]{...}[/METADATA]. 
        Ensure the suggestion is a clean JSON matching the appropriate schema.
        For Structure, schema: { "modules": [{ "title": "...", "chapters": [{"title": "..."}] }] }`
      };

      const resp = await chatWithAI([systemMsg, ...chatHistory]);
      const aiReply = resp.reply || '';
      
      const metadataMatch = aiReply.match(/\[METADATA\]([\s\S]*?)\[\/METADATA\]/);
      
      if (metadataMatch) {
         try {
           const metadata = JSON.parse(metadataMatch[1]);
           const textPart = aiReply.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, '').trim();
           
           if (textPart) {
             setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: textPart, type: 'text' }]);
           }
           
           if (scope.includes("Details")) {
             setMessages(prev => [...prev, { 
               id: Date.now() + 1, 
               sender: 'ai', 
               type: 'suggestion_details', 
               data: {
                 title: metadata.title || '',
                 description: metadata.description || '',
                 target_audience: metadata.target_audience || '',
                 difficulty: metadata.difficulty || 'beginner',
                 duration: metadata.duration || '',
                 learning_objectives: Array.isArray(metadata.learning_objectives) ? metadata.learning_objectives : []
               } 
             }]);
           } else {
             setMessages(prev => [...prev, { 
               id: Date.now() + 1, 
               sender: 'ai', 
               type: 'suggestion_structure', 
               data: {
                 modules: Array.isArray(metadata.modules) ? metadata.modules : []
               } 
             }]);
           }
         } catch(e) {
           setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: aiReply, type: 'text' }]);
         }
      } else {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: aiReply, type: 'text' }]);
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

  return (
    <div className={`flex flex-col bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-500 transition-all ${isMinimized ? 'h-[72px] w-[320px]' : 'h-[750px] flex-1'}`}>
      {/* Header */}
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
          {/* Scope Label (Static) */}
          <div className="px-4 py-3 bg-white border-b border-slate-50">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Current Scope</label>
             <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-600 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-sky-100 shadow-sm">
                <Sparkles className="w-3 h-3" />
                {scope}
             </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white scroll-smooth no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                <div className={`flex max-w-[95%] gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.sender === 'user' ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-100'}`}>
                    {msg.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-sky-600" />}
                  </div>
                  
                  {msg.type === 'text' && (
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}`}>
                      {msg.text}
                    </div>
                  )}

                  {msg.type === 'suggestion_details' && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                      <p className="text-[11px] text-slate-500 font-medium mb-3">Here's a suggested course outline and details based on your request:</p>
                      
                      <div className="space-y-2 border-l-2 border-sky-100 pl-4 py-1">
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-slate-900 flex-shrink-0">Course Title:</span>
                          <input 
                            id={`input-title-${msg.id}`}
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-semibold text-slate-600"
                            value={msg.data?.title}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'title', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-slate-900 flex-shrink-0">Description:</span>
                          <div 
                            contentEditable
                            suppressContentEditableWarning
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-600 outline-none whitespace-pre-wrap min-h-[40px]"
                            onBlur={(e) => handleUpdateSuggestion(msg.id, 'description', e.target.innerText)}
                          >
                            {msg.data?.description}
                          </div>
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-slate-900 flex-shrink-0">Target Audience:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-semibold text-slate-600"
                            value={msg.data?.target_audience}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'target_audience', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-slate-900 flex-shrink-0">Difficulty:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-semibold text-slate-600"
                            value={msg.data?.difficulty}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'difficulty', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-slate-900 flex-shrink-0">Duration:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-semibold text-slate-600"
                            value={msg.data?.duration || '6 hours'}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'duration', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1 mt-2">
                          <span className="text-[11px] font-bold text-slate-900 block">Learning Objectives:</span>
                          {(msg.data?.learning_objectives || []).map((obj, i) => (
                             <div key={i} className="flex gap-2 text-[11px]">
                               <span className="text-slate-400 mt-0.5">{i+1}.</span>
                               <input 
                                 className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-600"
                                 value={obj}
                                 onChange={(e) => handleUpdateObjective(msg.id, i, e.target.value)}
                               />
                             </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2 border-t border-slate-50 mt-4">
                         <button 
                            onClick={() => onApply(msg.data)}
                            className="flex-1 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2"
                         >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Apply Details
                         </button>
                         <button 
                            onClick={() => handleSend("Refine these details to be more specific and engaging.")}
                            className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition"
                         >
                            Refine Details
                         </button>
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
                              <span className="text-[9px] font-medium text-slate-400">{mod.chapters?.length} lessons</span>
                            </h4>
                            <div className="pl-3 space-y-1">
                              {mod.chapters?.map((chap, chapIdx) => (
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
                         <button 
                            onClick={() => onApply(msg.data)}
                            className="flex-1 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2"
                         >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Add to Structure
                         </button>
                         <button 
                            onClick={() => handleSend("Suggest a more detailed structure with additional modules.")}
                            className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition"
                         >
                            Refine Structure
                         </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
               {scope.includes("Details") ? (
                 <>
                   <button onClick={() => handleSend("Suggest a better title and description.")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Suggest Title</button>
                   <button onClick={() => handleSend("Refine learning objectives.")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Refine Objectives</button>
                 </>
               ) : (
                 <>
                   <button onClick={() => handleSend("Suggest more modules.")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Add More Modules</button>
                   <button onClick={() => handleSend("Suggest lesson topics.")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Suggest Topics</button>
                 </>
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
