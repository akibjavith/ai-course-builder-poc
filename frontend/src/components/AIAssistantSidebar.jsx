import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, RefreshCw, Minus, X, Send, Sparkles, Wand2, PencilLine, CheckCircle2, Loader2, MessageSquareText, ChevronDown, Maximize2 } from 'lucide-react';
import { chatWithAI } from '../api';

export default function AIAssistantSidebar({ details, onApply, onClose }) {
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
  const [currentScope, setCurrentScope] = useState('Step 2: Course Details');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
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
        Suggest Title, Description, Audience, Difficulty, and Objectives. 
        Always wrap your final suggestion in [METADATA]{...}[/METADATA]. 
        Ensure the suggestion is a clean JSON matching the CourseDetails schema.`
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
           
           setMessages(prev => [...prev, { 
             id: Date.now() + 1, 
             sender: 'ai', 
             type: 'suggestion', 
             data: {
               title: metadata.title || '',
               description: metadata.description || '',
               target_audience: metadata.target_audience || '',
               difficulty: metadata.difficulty || 'beginner',
               learning_objectives: Array.isArray(metadata.learning_objectives) ? metadata.learning_objectives : []
             } 
           }]);
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
    <div className={`flex flex-col bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-500 transition-all ${isMinimized ? 'h-[72px]' : 'h-full flex-1'}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-50 p-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-sm text-gray-900 tracking-tight flex items-center gap-2">
            AI Assistant
            <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">BETA</span>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMessages([{ id: 1, sender: 'ai', text: "Let's start over! What subject are we working on?", type: 'text' }])} className="p-2 hover:bg-gray-50 rounded-lg transition text-gray-400" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button className="p-2 hover:bg-gray-50 rounded-lg transition text-gray-400" title="Maximize">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg transition text-gray-400" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Scope Dropdown */}
          <div className="px-4 py-3 bg-white border-b border-gray-50">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Current Scope</label>
             <div className="relative">
                <button 
                  onClick={() => setShowScopeDropdown(!showScopeDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-600"
                >
                  {currentScope}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showScopeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showScopeDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 overflow-hidden">
                    {['Step 2: Course Details', 'Step 3: Course Structure', 'Step 4: Course Content'].map(scope => (
                       <button 
                         key={scope}
                         onClick={() => { setCurrentScope(scope); setShowScopeDropdown(false); }}
                         className={`w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-gray-50 ${currentScope === scope ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-600'}`}
                       >
                         {scope}
                         {currentScope === scope && <CheckCircle2 className="w-3 h-3 inline float-right mt-0.5" />}
                       </button>
                    ))}
                  </div>
                )}
             </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white scroll-smooth no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                <div className={`flex max-w-[95%] gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.sender === 'user' ? 'bg-indigo-600 border-indigo-600' : 'bg-indigo-50 border-indigo-100'}`}>
                    {msg.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-600" />}
                  </div>
                  
                  {msg.type === 'text' ? (
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100'}`}>
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                      <p className="text-[11px] text-gray-500 font-medium mb-3">Here's a suggested course outline and details based on your request:</p>
                      
                      <div className="space-y-2 border-l-2 border-indigo-100 pl-4 py-1">
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-gray-900 flex-shrink-0">Course Title:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600"
                            value={msg.data?.title}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'title', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-gray-900 flex-shrink-0">Description:</span>
                          <textarea 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600 resize-none h-auto min-h-[40px]"
                            value={msg.data?.description}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'description', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-gray-900 flex-shrink-0">Target Audience:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600"
                            value={msg.data?.target_audience}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'target_audience', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-gray-900 flex-shrink-0">Difficulty:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600"
                            value={msg.data?.difficulty}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'difficulty', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="font-bold text-gray-900 flex-shrink-0">Duration:</span>
                          <input 
                            className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600"
                            value={msg.data?.duration || '6 hours'}
                            onChange={(e) => handleUpdateSuggestion(msg.id, 'duration', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1 mt-2">
                          <span className="text-[11px] font-bold text-gray-900 block">Learning Objectives:</span>
                          {(msg.data?.learning_objectives || []).map((obj, i) => (
                             <div key={i} className="flex gap-2 text-[11px]">
                               <span className="text-gray-400 mt-0.5">{i+1}.</span>
                               <input 
                                 className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-600"
                                 value={obj}
                                 onChange={(e) => handleUpdateObjective(msg.id, i, e.target.value)}
                               />
                             </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-[9px] text-gray-400 italic">AI suggestions may be inaccurate.</p>

                      <div className="pt-2 flex gap-2">
                         <button 
                            onClick={() => onApply(msg.data)}
                            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition"
                         >
                            Apply to Form
                         </button>
                         <button className="flex-1 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-gray-50 transition">
                            Edit Suggestions
                         </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                   <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                   <span className="text-[11px] text-gray-400 font-bold tracking-wide">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-50">
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2 pr-3 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              <input 
                className="flex-1 bg-transparent border-none px-3 py-2 text-[13px] outline-none placeholder:text-gray-400" 
                placeholder="Ask anything about your course..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`p-2 rounded-xl transition ${input.trim() ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-4">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Examples:</span>
               <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {['Improve description', 'Add more objectives', 'Suggest target audience'].map(pill => (
                    <button 
                      key={pill}
                      onClick={() => handleSend(pill)}
                      className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition"
                    >
                      {pill}
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
