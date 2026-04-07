import React, { useEffect, useRef } from 'react';
import { Bot, User, Pencil, Loader2 } from 'lucide-react';

export default function Chatbot({ messages, renderMessageContent, handleEditMessage }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background space-y-6">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
          <div className={`flex max-w-[90%] sm:max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            
            <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 ml-3' : 'bg-primary-600 mr-3'}`}>
              {msg.sender === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
            </div>

            <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`relative px-4 py-3 text-sm ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-md'
                    : 'glass text-gray-200 rounded-2xl rounded-tl-none border-gray-700/50'
                } ${msg.type.startsWith('form') || msg.type === 'card_structure' ? 'w-full !bg-transparent !border-none !p-0 !shadow-none' : ''}`}
              >
                {renderMessageContent(msg)}
              </div>
              
              {msg.sender === 'user' && msg.restoresForm && (
                 <button 
                   onClick={() => handleEditMessage(msg.id, msg.restoresForm)}
                   className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1.5 flex items-center hover:text-indigo-400 transition"
                 >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                 </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
