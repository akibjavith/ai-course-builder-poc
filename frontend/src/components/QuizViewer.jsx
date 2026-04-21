import React, { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function QuizViewer({ questions, quizData, title, lightMode = false }) {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Normalize data source
  const data = questions || quizData;

  if (!data || data.length === 0) return null;

  const currentQ = data[currentQuestionIdx];

  const handleSelect = (idx) => {
    if (showExplanation) return;
    setSelectedAnswer(idx);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    if (currentQuestionIdx < data.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  return (
    <div className={`${lightMode ? 'bg-white' : 'glass'} p-6 rounded-xl space-y-4 animate-fade-in`}>
      <div className="flex justify-between items-center mb-4">
        <h4 className={`text-xl font-bold ${lightMode ? 'text-indigo-900' : 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400'}`}>
           {title || 'Knowledge Assessment'} — Question {currentQuestionIdx + 1} of {data.length}
        </h4>
      </div>
      
      <p className={`text-lg font-medium mb-6 ${lightMode ? 'text-gray-800' : 'text-gray-200'}`}>
        {currentQ.question}
      </p>

      <div className="space-y-3">
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedAnswer === idx;
          
          // AI can return 'answer' as a string or 'correct_answer' as index
          const isCorrect = (typeof currentQ.correct_answer === 'number' && idx === currentQ.correct_answer) || 
                            (currentQ.answer === opt) ||
                            (String(currentQ.correct_answer) === opt);
          
          let btnClass = "w-full text-left p-4 rounded-lg border transition-all duration-200 ";
          
          if (!showExplanation) {
             if (lightMode) {
               btnClass += "border-gray-200 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:border-indigo-300";
             } else {
               btnClass += "border-gray-600 bg-gray-800/50 hover:bg-gray-700/80 text-gray-300 hover:border-gray-400";
             }
          } else {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-500/20 text-green-700 font-bold";
            } else if (isSelected && !isCorrect) {
              btnClass += "border-red-500 bg-red-500/20 text-red-700 font-bold";
            } else {
              btnClass += "border-gray-200 bg-gray-50 text-gray-400 opacity-50";
            }
          }

          return (
            <button 
              key={idx}
              onClick={() => handleSelect(idx)}
              className={btnClass}
            >
              <div className="flex items-center justify-between">
                <span>{opt}</span>
                {showExplanation && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                {showExplanation && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
              </div>
            </button>
          );
        })}
      </div>

      {showExplanation && currentQ.explanation && (
        <div className={`mt-6 p-4 rounded-lg border animate-fade-in ${lightMode ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-900/40 border-indigo-500/30'}`}>
          <p className={`text-sm ${lightMode ? 'text-indigo-800' : 'text-indigo-200'}`}><span className="font-bold">Explanation: </span>{currentQ.explanation}</p>
        </div>
      )}

      {showExplanation && currentQuestionIdx < data.length - 1 && (
        <button 
          onClick={handleNext}
          className="mt-6 w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 font-bold text-white shadow-lg hover:shadow-indigo-500/25 transition transform hover:-translate-y-0.5"
        >
          Next Question
        </button>
      )}
    </div>
  );
}
