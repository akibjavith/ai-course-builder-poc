import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function FlashcardViewer({ flashcards }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrev = () => {
     setIsFlipped(false);
     setTimeout(() => {
       setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
     }, 150);
  };

  return (
    <div className="flex flex-col items-center space-y-6 max-w-md mx-auto w-full mb-8">
      <div 
        className="relative w-full h-64 perspective cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`w-full h-full duration-500 preserve-3d absolute top-0 left-0 ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden glass-dark rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg border border-indigo-500/30">
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 bg-indigo-900/30 px-3 py-1 rounded-full">Question</h3>
            <p className="text-xl font-bold text-white leading-relaxed">{currentCard.question}</p>
            <div className="absolute bottom-4 flex items-center text-gray-400 text-xs mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               <RefreshCw className="w-3 h-3 mr-1" /> Click to flip
            </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 glass-dark rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg border border-purple-500/30 bg-purple-900/40">
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 bg-purple-900/30 px-3 py-1 rounded-full">Answer</h3>
            <p className="text-lg font-medium text-white leading-relaxed">{currentCard.answer}</p>
          </div>
          
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button onClick={handlePrev} className="px-4 py-2 rounded-lg glass text-sm font-bold text-gray-300 hover:text-white transition">Prev</button>
        <span className="text-xs font-medium text-gray-400">{currentIndex + 1} / {flashcards.length}</span>
        <button onClick={handleNext} className="px-4 py-2 rounded-lg glass text-sm font-bold text-gray-300 hover:text-white transition">Next</button>
      </div>
    </div>
  );
}
