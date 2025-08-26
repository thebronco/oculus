import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question_id, selected_answers } = body;

    if (!question_id || !selected_answers || selected_answers.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get API Gateway URL from environment variable
    const apiGatewayUrl = process.env.API_GATEWAY_URL;
    
    if (!apiGatewayUrl) {
      return NextResponse.json(
        { error: 'API Gateway URL not configured' },
        { status: 500 }
      );
    }

    // Submit answer to your Lambda function
    const response = await fetch(`${apiGatewayUrl}/survey/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question_id,
        selected_answers,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
