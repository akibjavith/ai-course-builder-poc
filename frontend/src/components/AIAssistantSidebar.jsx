import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, RefreshCw, Minus, X, Send, Sparkles, Wand2, PencilLine, CheckCircle2, Loader2, MessageSquareText, ChevronDown, Maximize2, Zap } from 'lucide-react';
import { chatWithAI } from '../api';

export default function AIAssistantSidebar({ details, courseData, onApply, onClose, scope = 'Course Details', initialInput = '' }) {
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

  useEffect(() => {
    if (initialInput) {
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

      const systemMsg = { 
        role: 'system', 
        content: `You are a friendly and expert instructional design assistant. Your goal is to help the user build high-quality courses step-by-step.

        PERSONALITY:
        - Be encouraging, professional, and helpful.
        - If the user greets you (e.g., "Hi", "Hello"), respond warmly and acknowledge their current progress in the course (look at CURRENT CONTEXT and CURRENT SCOPE).
        - You are a partner in the creative process, not just a tool.

        HOW TO RESPOND:
        1. FOR COURSE ACTIONS (Refine, Add, Generate): Provide ONLY the [METADATA] block. Do NOT add any conversational text. Be a silent processing engine for these specific actions.
        2. FOR GENERAL CHAT/GREETINGS: Provide ONLY conversational text. Do NOT add a [METADATA] block unless specifically asked for a course update.
        3. STRUCTURED DATA: Wrap JSON in [METADATA] blocks: [METADATA]{...}[/METADATA].
        
        CRITICAL RULES FOR METADATA:
        - ALWAYS RETURN THE FULL AND COMPLETE OBJECT IN [METADATA]. 
        - IF A FIELD IS ALREADY PROVIDED IN "CURRENT CONTEXT" AND YOU ARE NOT CHANGING IT, YOU MUST STILL INCLUDE IT EXACTLY AS IS. 
        - YOU ARE STRICTLY FORBIDDEN FROM RETURNING EMPTY STRINGS ("") OR PLACEHOLDERS FOR FIELDS THAT ALREADY HAVE CONTENT.
        
        CURRENT CONTEXT: ${JSON.stringify(details)}. 
        ${(scope.includes('Structure') || scope.includes('Content')) ? `CRITICAL: USE THE FOLLOWING STRUCTURE ONLY: ${JSON.stringify(courseData?.structure || {})}` : ''}
        CURRENT SCOPE: ${scope}.

        FORMATTING RULES:
        - Use PLAIN TEXT only. DO NOT use markdown symbols like ** or # for bolding or headers.
        - Use DOUBLE LINE BREAKS (\n\n) between different sections and points for clear spacing.
        - Use bullet points (-) for lists.
        - CONCISENESS: If the user triggered an action via a button (e.g., 'Add Objective', 'Refine Details'), keep your conversational text to ONE short sentence. Only provide long explanations for general chat or open-ended questions.

        SCHEMAS:
        - Course Details (Step 2): { "title": "...", "description": "...", "target_audience": "...", "difficulty": "...", "duration": "...", "learning_objectives": ["..."] }
        - Course Structure (Step 3): { "modules": [{ "title": "...", "chapters": [{"title": "..."}] }] }
        - Course Content (Step 4): { "prompts": [{ "module": "...", "title": "...", "prompt": "..." }] } OR { "prompt": "..." } for a single lesson.`
      };

      const resp = await chatWithAI([systemMsg, ...chatHistory]);
      const aiReply = resp.reply || '';
      
      // 1. Try to find complete tags
      let metadataMatch = aiReply.match(/\[METADATA\]([\s\S]*?)\[\/METADATA\]/);
      let metadataStr = metadataMatch ? metadataMatch[1] : null;
      let textPart = '';

      if (metadataMatch) {
        textPart = aiReply.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, '').trim();
      } else {
        // 2. Fallback: Look for [METADATA] prefix and extract the JSON block
        const prefixMatch = aiReply.match(/\[METADATA\]\s*(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (prefixMatch) {
          metadataStr = prefixMatch[1];
          const lastBrace = Math.max(metadataStr.lastIndexOf('}'), metadataStr.lastIndexOf(']'));
          if (lastBrace !== -1) {
            const actualJson = metadataStr.substring(0, lastBrace + 1);
            metadataStr = actualJson;
            textPart = aiReply.replace(/\[METADATA\][\s\S]*/, '').trim();
          }
        } else {
          // 3. Last resort: Just look for any JSON block
          const jsonMatch = aiReply.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch) {
            metadataStr = jsonMatch[0];
            textPart = aiReply.replace(metadataStr, '').trim();
          }
        }
      }
      
      if (metadataStr) {
         try {
            const metadata = JSON.parse(metadataStr);
            
            // Safety Guard: If AI returns empty fields that are present in context, fill them back in
            if (scope.includes("Details")) {
              const lastDetails = [...messages].reverse().find(m => m.type === 'suggestion_details')?.data;
              
              if ((!metadata.title || metadata.title.length < 2)) {
                metadata.title = details?.title || lastDetails?.title || '';
              }
              if ((!metadata.description || metadata.description.length < 5)) {
                metadata.description = details?.description || lastDetails?.description || '';
              }
              if ((!metadata.target_audience || metadata.target_audience.length < 2)) {
                metadata.target_audience = details?.target_audience || lastDetails?.target_audience || '';
              }
              if (!metadata.difficulty) metadata.difficulty = details?.difficulty || lastDetails?.difficulty || 'beginner';
              if (!metadata.duration) metadata.duration = details?.duration || lastDetails?.duration || '';
              
              if ((!metadata.learning_objectives || metadata.learning_objectives.length === 0)) {
                metadata.learning_objectives = details?.learning_objectives || lastDetails?.learning_objectives || [];
              } else if (Array.isArray(metadata.learning_objectives)) {
                metadata.learning_objectives = metadata.learning_objectives.filter(obj => obj && obj.trim().length > 0);
              }
            }
            
            // Aggressively clean textPart: remove code blocks and JSON-like strings
            // Clean textPart: remove metadata tags but keep normal text
            const cleanText = textPart
              .replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/g, '') 
              .replace(/\[METADATA\]/g, '')
              .replace(/\[\/METADATA\]/g, '')
              .trim();
            
            if (cleanText && cleanText.length > 2) {
              setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: cleanText, type: 'text' }]);
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
            } else if (scope.includes("Structure")) {
              const modules = Array.isArray(metadata.modules) ? metadata.modules : 
                              Array.isArray(metadata.course_structure) ? metadata.course_structure : [];
              
              const normalizedModules = modules.map(m => ({
                ...m,
                chapters: Array.isArray(m.chapters) ? m.chapters : 
                          Array.isArray(m.lessons) ? m.lessons : 
                          Array.isArray(m.topics) ? m.topics : []
              }));

              setMessages(prev => [...prev, { 
                id: Date.now() + 2, 
                sender: 'ai', 
                type: 'suggestion_structure', 
                data: {
                  modules: normalizedModules
                } 
              }]);
            } else {
              const prompts = Array.isArray(metadata.prompts) ? metadata.prompts : 
                              Array.isArray(metadata.content_strategy) ? metadata.content_strategy : [];

              setMessages(prev => [...prev, { 
                id: Date.now() + 5, 
                sender: 'ai', 
                type: 'suggestion_content', 
                data: {
                  strategy: Array.isArray(metadata.strategy) ? metadata.strategy : [],
                  prompts: prompts,
                  prompt: typeof metadata.prompt === 'string' ? metadata.prompt : null,
                  isSingle: !!metadata.prompt
                } 
              }]);
            }
         } catch(e) {
           // Fallback Parser: Try to extract title/description from plain text if JSON fails
           const titleMatch = aiReply.match(/\*\*Title:\*\*\s*(.*?)(?:\*\*|$)/);
           const descMatch = aiReply.match(/\*\*Description:\*\*\s*(.*?)(?:\*\*|$)/);
           
           if (titleMatch || descMatch) {
             const fallbackData = {
               title: titleMatch?.[1]?.trim() || details?.title || '',
               description: descMatch?.[1]?.trim() || details?.description || '',
               target_audience: details?.target_audience || '',
               difficulty: details?.difficulty || 'beginner',
               duration: details?.duration || '',
               learning_objectives: details?.learning_objectives || []
             };

             setMessages(prev => [...prev, { 
               id: Date.now() + 10, 
               sender: 'ai', 
               type: 'suggestion_details', 
               data: fallbackData 
             }]);
           } else {
             setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: aiReply.replace(/\[METADATA\]/g, '').replace(/\[\/METADATA\]/g, '').trim(), type: 'text' }]);
           }
         }
      } else {
        // Even if no metadata block found, try the fallback parser on the whole reply
        const titleMatch = aiReply.match(/\*\*Title:\*\*\s*(.*?)(?:\*\*|$)/);
        const descMatch = aiReply.match(/\*\*Description:\*\*\s*(.*?)(?:\*\*|$)/);
        
        if (titleMatch || descMatch) {
          const fallbackData = {
            title: titleMatch?.[1]?.trim() || details?.title || '',
            description: descMatch?.[1]?.trim() || details?.description || '',
            target_audience: details?.target_audience || '',
            difficulty: details?.difficulty || 'beginner',
            duration: details?.duration || '',
            learning_objectives: details?.learning_objectives || []
          };

          setMessages(prev => [...prev, { 
            id: Date.now() + 10, 
            sender: 'ai', 
            type: 'suggestion_details', 
            data: fallbackData 
          }]);
        } else {
          setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: aiReply.replace(/\[METADATA\]/g, '').replace(/\[\/METADATA\]/g, '').trim(), type: 'text' }]);
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

  return (
    <div className={`flex flex-col bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-500 transition-all flex-shrink-0 ${isMinimized ? 'h-[72px] w-[320px]' : 'h-[800px] w-[400px]'}`}>
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
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}`}>
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
                          {(msg.data?.learning_objectives || [])
                            .filter(obj => obj && obj.trim().length > 0)
                            .map((obj, i) => (
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
                            onClick={() => handleSend("Refine these details to be more specific and engaging.", "Refine Details")}
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
                              {modIdx + 1}. {mod.title || mod.module_title}
                              <span className="text-[9px] font-medium text-slate-400">{(mod.chapters || mod.lessons || []).length} lessons</span>
                            </h4>
                            <div className="pl-3 space-y-1">
                              {(mod.chapters || mod.lessons || []).map((chap, chapIdx) => (
                                <div key={chapIdx} className="text-[10px] text-slate-500 flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                                  {chap.title || chap.lesson_title}
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
                            onClick={() => {
                              const currentModules = msg.data?.modules || [];
                              const objectives = details?.learning_objectives || [];
                              const prompt = `Review the current course structure: ${JSON.stringify(currentModules)} and the learning objectives: ${JSON.stringify(objectives)}. Optimize the logical flow, ensuring a smooth progression. You may re-order, split, or merge modules to better align with the objectives. RETURN THE FULL OPTIMIZED STRUCTURE.`;
                              handleSend(prompt, "Refine Structure");
                            }}
                            className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition"
                         >
                            Refine Structure
                         </button>
                      </div>
                    </div>
                  )}

                  {msg.type === 'suggestion_content' && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4 animate-in zoom-in-95 duration-300 w-full">
                      {msg.data?.strategy?.length > 0 && (
                        <>
                          <p className="text-[11px] text-slate-500 font-medium mb-3">Based on the lesson title and content, here are my suggestions:</p>
                          <div className="overflow-hidden border border-slate-100 rounded-xl">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="p-2 text-[10px] font-bold text-slate-600 uppercase">Content Type</th>
                                  <th className="p-2 text-[10px] font-bold text-slate-600 uppercase">Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {msg.data.strategy.map((item, i) => (
                                  <tr key={i} className="border-b border-slate-50 last:border-none">
                                    <td className="p-2 text-[10px] font-bold text-sky-600">{item.type}</td>
                                    <td className="p-2 text-[10px] text-slate-500 leading-tight">{item.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}

                      {(msg.data?.prompts?.length > 0 || msg.data?.prompt) && (
                        <>
                          <p className="text-[11px] text-slate-500 font-medium mb-3">
                            {msg.data?.prompt ? "I have generated a refined prompt for your lesson:" : "I have generated a detailed content strategy for all modules:"}
                          </p>
                          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 no-scrollbar border-l-2 border-sky-100 pl-4 py-1">
                            {msg.data?.prompt ? (
                               <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                                 <div className="flex items-center gap-2">
                                   <span className="text-[9px] font-black text-sky-600 uppercase tracking-tighter">Refined Prompt</span>
                                 </div>
                                 <p className="text-[10px] text-slate-500 italic leading-relaxed whitespace-pre-wrap">"{msg.data.prompt}"</p>
                               </div>
                            ) : (
                              (() => {
                                let currentModule = "";
                                return (msg.data?.prompts || []).map((p, i) => {
                                  if (!p) return null;
                                  const showModuleHeader = p.module && p.module !== currentModule;
                                  if (showModuleHeader) currentModule = p.module;

                                  return (
                                    <div key={i} className="space-y-2">
                                      {showModuleHeader && (
                                        <div className="pt-2 pb-1">
                                          <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-1 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                            {p.module}
                                          </h5>
                                        </div>
                                      )}
                                      <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 ml-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-black text-sky-600 uppercase tracking-tighter">Lesson</span>
                                          <h4 className="text-[10px] font-bold text-slate-900">{p.title || p.lesson || 'Untitled Lesson'}</h4>
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic leading-relaxed whitespace-pre-wrap">"{p.prompt || 'No prompt content generated.'}"</p>
                                      </div>
                                    </div>
                                  );
                                });
                              })()
                            )}
                          </div>
                          <div className="pt-2 grid grid-cols-2 gap-2">
                             <button 
                                onClick={() => onApply(msg.data?.prompt ? { prompt: msg.data.prompt } : { prompts: msg.data.prompts })}
                                className="bg-sky-600 text-white px-4 py-3 rounded-xl text-[10px] font-bold hover:bg-sky-700 transition flex items-center justify-center gap-2 shadow-lg shadow-sky-100"
                             >
                                <Zap className="w-3 h-3" /> {msg.data?.prompt ? "Apply Prompt" : "Apply All"}
                             </button>
                             <button 
                                onClick={() => {
                                  if (msg.data?.prompt) {
                                    handleSend("Regenerate this specific lesson prompt with more practical details.", "Regenerate Prompt");
                                  } else {
                                    handleSend("Regenerate the content strategy with a more practical/hands-on focus.", "Regenerate Strategy");
                                  }
                                }}
                                className="bg-white border-2 border-slate-100 text-slate-600 px-4 py-3 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2"
                             >
                                <RefreshCw className="w-3 h-3" /> Regenerate
                             </button>
                          </div>
                        </>
                      )}

                       {!msg.data?.prompts?.length && !msg.data?.prompt && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 mt-4">
                           <button 
                              onClick={() => handleSend("Improve the prompt for the current lesson.", "Improve Prompt")}
                              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition"
                           >
                              <PencilLine className="w-3 h-3" /> Improve Prompt
                           </button>
                           <button 
                              onClick={() => onApply({ type: msg.data?.strategy?.[0]?.type?.toLowerCase() })}
                              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition"
                           >
                              <Zap className="w-3 h-3" /> Apply Selection
                           </button>
                        </div>
                      )}
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
               {scope.includes("Details") && (
                 <>
                   {(() => {
                     const lastSuggestion = [...messages].reverse().find(m => m.type === 'suggestion_details')?.data;
                     const activeTitle = details?.title || lastSuggestion?.title || '';
                     const activeDesc = details?.description || lastSuggestion?.description || '';
                     const hasSuggestion = messages.some(m => m.type === 'suggestion_details');
                     
                     const handleRefineObjectives = () => {
                       const currentObjectives = lastSuggestion?.learning_objectives || details?.learning_objectives || [];
                       const validObjectives = currentObjectives.filter(obj => obj && obj.trim().length > 0);
                       const prompt = `Refine objectives: ${JSON.stringify(validObjectives)}. Title: "${activeTitle}", Desc: "${activeDesc}". YOU MUST RETURN THE [METADATA] BLOCK with Target Audience.`;
                       handleSend(prompt, "Refine Objectives");
                     };

                     const handleAddObjectives = () => {
                       const currentObjectives = lastSuggestion?.learning_objectives || details?.learning_objectives || [];
                       const validObjectives = currentObjectives.filter(obj => obj && obj.trim().length > 0);

                       if (validObjectives.length >= 15) {
                         setMessages(prev => [
                           ...prev, 
                           { id: Date.now(), sender: 'user', text: 'Add Objectives', type: 'text' },
                           { id: Date.now() + 1, sender: 'ai', text: 'You have reached the maximum limit of 15 learning objectives.', type: 'text' }
                         ]);
                         return;
                       }
                       
                       const prompt = `Add 3 objectives to: ${JSON.stringify(validObjectives)}. Title: "${activeTitle}", Desc: "${activeDesc}". YOU MUST RETURN THE [METADATA] BLOCK with Target Audience.`;
                       handleSend(prompt, "Add Objectives");
                     };
                     
                     if (!hasSuggestion) {
                       return <button onClick={() => handleSend(`Suggest a course title, description, target audience, and 5-6 objectives for "${activeTitle || 'a new subject'}". YOU MUST RETURN THE [METADATA] BLOCK.`, "Suggest Title")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Suggest Title</button>;
                     }
                     
                     return (
                       <>
                         <button onClick={handleRefineObjectives} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Refine Objectives</button>
                         <button onClick={handleAddObjectives} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Add Objectives</button>
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
                       const prompt = `Keep the existing modules exactly as they are: ${JSON.stringify(currentModules)}. Suggest exactly 2 new, distinct modules to follow these that add more value to the course based on the course objectives. RETURN A FULL, COMBINED LIST containing all the existing modules PLUS the 2 new ones.`;
                       handleSend(prompt, "Add Modules");
                     };

                     const handleRefineTopics = () => {
                       const prompt = `Keep the Module titles exactly as they are: ${JSON.stringify(currentModules.map(m => m.title || m.module_title))}. For each module, refine the chapter/lesson titles to be more practical, hands-on, and engaging. Return the FULL structure with updated lesson titles. DO NOT add or remove modules.`;
                       handleSend(prompt, "Refine Topics");
                     };

                     if (!hasSuggestion) {
                       return <button onClick={() => handleSend("Generate a complete course structure.", "Suggest Structure")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Suggest Structure</button>;
                     }

                     return (
                       <>
                         <button onClick={handleAddModules} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Add Modules</button>
                         <button onClick={handleRefineTopics} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Refine Topics</button>
                       </>
                     );
                   })()}
                 </>
               )}

               {scope.includes("Content") && (
                 <>
                   {!messages.some(m => m.type === 'suggestion_content') ? (
                     <button onClick={() => handleSend("Generate high-quality prompts for all modules and lessons.", "Generate All Prompts")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Generate All Prompts</button>
                   ) : (
                     <>
                       <button onClick={() => handleSend("Make prompts more practical.", "Practical Focus")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Practical Focus</button>
                       <button onClick={() => handleSend("Make prompts more academic.", "Academic Focus")} className="text-[10px] font-bold text-slate-400 hover:text-sky-600 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100">Academic Focus</button>
                     </>
                   )}
                 </>
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
