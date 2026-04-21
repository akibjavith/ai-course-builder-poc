import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, List, ListOrdered, Heading1, Heading2, 
  Type, AlignLeft, AlignCenter, AlignRight, Underline
} from 'lucide-react';

export default function PremiumRichEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (!value && placeholder) {
        editorRef.current.innerHTML = `<p class="text-gray-400 italic">${placeholder}</p>`;
      } else {
        editorRef.current.innerHTML = value || '<p><br></p>';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    handleInput();
  };

  const handleFocus = () => {
    if (editorRef.current.innerHTML.includes(placeholder)) {
      editorRef.current.innerHTML = '<p><br></p>';
    }
  };

  return (
    <div className="flex flex-col border border-indigo-200 rounded-xl overflow-hidden shadow-sm bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
        <ToolbarButton icon={<Heading1 size={16} />} onClick={() => execCommand('formatBlock', 'H2')} title="Heading 1" />
        <ToolbarButton icon={<Heading2 size={16} />} onClick={() => execCommand('formatBlock', 'H3')} title="Heading 2" />
        <ToolbarButton icon={<Type size={16} />} onClick={() => execCommand('formatBlock', 'P')} title="Paragraph" />
        
        <div className="w-px h-6 bg-gray-200 mx-1" />
        
        <ToolbarButton icon={<Bold size={16} />} onClick={() => execCommand('bold')} title="Bold" />
        <ToolbarButton icon={<Italic size={16} />} onClick={() => execCommand('italic')} title="Italic" />
        <ToolbarButton icon={<Underline size={16} />} onClick={() => execCommand('underline')} title="Underline" />
        
        <div className="w-px h-6 bg-gray-200 mx-1" />
        
        <ToolbarButton icon={<List size={16} />} onClick={() => execCommand('insertUnorderedList')} title="Bullet List" />
        <ToolbarButton icon={<ListOrdered size={16} />} onClick={() => execCommand('insertOrderedList')} title="Numbered List" />
        
        <div className="w-px h-6 bg-gray-200 mx-1" />
        
        <ToolbarButton icon={<AlignLeft size={16} />} onClick={() => execCommand('justifyLeft')} title="Align Left" />
        <ToolbarButton icon={<AlignCenter size={16} />} onClick={() => execCommand('justifyCenter')} title="Align Center" />
        <ToolbarButton icon={<AlignRight size={16} />} onClick={() => execCommand('justifyRight')} title="Align Right" />
      </div>

      {/* Editable Area */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={handleFocus}
        className="premium-editor-area p-6 min-h-[350px] focus:outline-none overflow-y-auto bg-white text-gray-800 leading-relaxed"
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
}

function ToolbarButton({ icon, onClick, title }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-2 rounded-md hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all text-gray-500 flex items-center justify-center"
      title={title}
    >
      {icon}
    </button>
  );
}
