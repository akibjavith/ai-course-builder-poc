import React, { useState, useRef } from 'react';
import { PlayCircle, PauseCircle } from 'lucide-react';

export default function TTSPlayer({ audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  if (!audioUrl) return null;

  return (
    <div className="flex items-center space-x-3 mt-4 glass p-3 rounded-lg inline-flex">
      <button 
        onClick={togglePlay}
        className="text-primary-400 hover:text-primary-300 transition transform hover:scale-110"
        title="Play Audio"
      >
        {isPlaying ? <PauseCircle className="w-8 h-8" /> : <PlayCircle className="w-8 h-8" />}
      </button>
      <div className="text-sm font-medium text-gray-300">
        {isPlaying ? 'Playing Audio...' : 'Listen to Lesson'}
      </div>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onEnded={handleEnded} 
        className="hidden" 
      />
    </div>
  );
}
