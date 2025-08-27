import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use the correct API Gateway URL directly
    const apiGatewayUrl = 'https://gkvybwktj6.execute-api.us-east-1.amazonaws.com/prod';

    // Fetch survey data from your Lambda function
    const response = await fetch(`${apiGatewayUrl}/survey/nist-csf`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to match the expected structure
    if (data.questions && data.questions.length > 0) {
      const firstQuestion = data.questions[0];
      
      // Transform the question data to match the expected interface
      const transformedData = {
        question: {
          question_id: firstQuestion.id,
          category: firstQuestion.category,
          sub_category: firstQuestion.category, // Using category as sub_category for now
          question: firstQuestion.question,
          question_tool_tip: '', // Add tooltip if available in your Lambda response
        },
        answers: firstQuestion.options.map((option: string, index: number) => ({
          answer_id: index + 1,
          answer_type: 'radiobutton' as const,
          answer: option,
          answer_order: index + 1,
        }))
      };
      
      return NextResponse.json(transformedData);
    } else {
      throw new Error('No questions available');
    }
  } catch (error) {
    console.error('Error fetching survey data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey data' },
      { status: 500 }
    );
  }
}
