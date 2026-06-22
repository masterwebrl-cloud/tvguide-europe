import { Handler } from '@netlify/functions';

interface EPGRequest {
  country?: string;
  channel?: string;
  date?: string;
}

interface Program {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  genre: string;
  channel: string;
}

const handler: Handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { country = 'uk', channel, date } = JSON.parse(event.body || '{}') as EPGRequest;

    // Mock EPG data - replace with actual API calls
    const mockPrograms: Program[] = [
      {
        id: '1',
        title: 'Morning News',
        startTime: '08:00',
        endTime: '09:00',
        description: 'Daily news and current affairs',
        genre: 'News',
        channel: 'BBC One',
      },
      {
        id: '2',
        title: 'Afternoon Drama',
        startTime: '14:00',
        endTime: '15:30',
        description: 'Contemporary drama series',
        genre: 'Drama',
        channel: 'BBC One',
      },
      {
        id: '3',
        title: 'Evening Entertainment',
        startTime: '19:00',
        endTime: '21:00',
        description: 'Popular entertainment show',
        genre: 'Entertainment',
        channel: 'ITV',
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: mockPrograms,
        meta: {
          country,
          channel,
          date: date || new Date().toISOString().split('T')[0],
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch EPG data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
