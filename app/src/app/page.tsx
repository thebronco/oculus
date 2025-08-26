'use client';

import { useState, useEffect } from 'react';

interface SurveyQuestion {
  question_id: number;
  category: string;
  sub_category: string;
  question: string;
  question_tool_tip: string;
}

interface AnswerOption {
  answer_id: number;
  answer_type: 'radiobutton' | 'checkbox';
  answer: string;
  answer_order: number;
}

interface SurveyData {
  question: SurveyQuestion;
  answers: AnswerOption[];
}

export default function SurveyPage() {
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      // This will be your API Gateway endpoint
      const response = await fetch('/api/survey-question');
      if (!response.ok) {
        throw new Error('Failed to fetch survey data');
      }
      const data = await response.json();
      setSurveyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (answerId: number, isChecked: boolean) => {
    if (surveyData?.question && surveyData.question.sub_category === 'Asset Management') {
      // For checkbox questions (Asset Management)
      if (isChecked) {
        setSelectedAnswers(prev => [...prev, answerId]);
      } else {
        setSelectedAnswers(prev => prev.filter(id => id !== answerId));
      }
    } else {
      // For radio button questions
      setSelectedAnswers([answerId]);
    }
  };

  const handleSubmit = async () => {
    if (selectedAnswers.length === 0) {
      alert('Please select at least one answer');
      return;
    }

    try {
      // This will be your submit endpoint
      const response = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: surveyData?.question.question_id,
          selected_answers: selectedAnswers,
        }),
      });

      if (response.ok) {
        alert('Answer submitted successfully!');
        setSelectedAnswers([]);
      } else {
        throw new Error('Failed to submit answer');
      }
    } catch (err) {
      alert('Error submitting answer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Survey</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchSurveyData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No survey data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NIST CSF Security Assessment</h1>
          <p className="text-gray-600">Evaluate your organization's cybersecurity posture</p>
        </div>

        {/* Survey Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Question Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {surveyData.question.category}
              </span>
              <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {surveyData.question.sub_category}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {surveyData.question.question}
            </h2>
            {surveyData.question.question_tool_tip && (
              <p className="text-sm text-gray-600 italic">
                💡 {surveyData.question.question_tool_tip}
              </p>
            )}
          </div>

          {/* Answer Options */}
          <div className="space-y-3 mb-8">
            {surveyData.answers.map((answer) => (
              <label key={answer.answer_id} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type={surveyData.question.sub_category === 'Asset Management' ? 'checkbox' : 'radio'}
                  name="answer"
                  value={answer.answer_id}
                  checked={selectedAnswers.includes(answer.answer_id)}
                  onChange={(e) => handleAnswerChange(answer.answer_id, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">{answer.answer}</span>
              </label>
            ))}
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={selectedAnswers.length === 0}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Submit Answer
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Question 1 of 1 • {selectedAnswers.length} answer(s) selected
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by NIST Cybersecurity Framework</p>
        </div>
      </div>
    </div>
  );
}
