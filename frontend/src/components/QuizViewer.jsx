import React, { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function QuizViewer({ quizData }) {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!quizData || quizData.length === 0) return null;

  const currentQ = quizData[currentQuestionIdx];

  const handleSelect = (idx) => {
    if (showExplanation) return;
    setSelectedAnswer(idx);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    if (currentQuestionIdx < quizData.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  return (
    <div className="glass p-6 rounded-xl space-y-4 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
          Question {currentQuestionIdx + 1} of {quizData.length}
        </h4>
      </div>
      
      <p className="text-lg text-gray-200 font-medium mb-6">
        {currentQ.question}
      </p>

      <div className="space-y-3">
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === currentQ.correct_answer;
          
          let btnClass = "w-full text-left p-4 rounded-lg border transition-all duration-200 ";
          
          if (!showExplanation) {
            btnClass += "border-gray-600 bg-gray-800/50 hover:bg-gray-700/80 text-gray-300 hover:border-gray-400";
          } else {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-500/20 text-green-100";
            } else if (isSelected && !isCorrect) {
              btnClass += "border-red-500 bg-red-500/20 text-red-100";
            } else {
              btnClass += "border-gray-700 bg-gray-800/30 text-gray-500 opacity-50";
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
                {showExplanation && isCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
                {showExplanation && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400" />}
              </div>
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className="mt-6 p-4 rounded-lg bg-indigo-900/40 border border-indigo-500/30 animate-fade-in">
          <p className="text-sm text-indigo-200"><span className="font-bold">Explanation: </span>{currentQ.explanation}</p>
        </div>
      )}

      {showExplanation && currentQuestionIdx < quizData.length - 1 && (
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
