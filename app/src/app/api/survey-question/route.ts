import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get API Gateway URL from environment variable
    const apiGatewayUrl = process.env.API_GATEWAY_URL;
    
    if (!apiGatewayUrl) {
      return NextResponse.json(
        { error: 'API Gateway URL not configured' },
        { status: 500 }
      );
    }

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
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching survey data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey data' },
      { status: 500 }
    );
  }
}
