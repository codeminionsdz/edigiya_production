import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const body = await request.json();

    const { session_id, page_path, referrer } = body;

    if (!session_id || !page_path) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const ipAddress = headersList.get('x-forwarded-for') || 
                      headersList.get('x-client-ip') || 
                      'unknown';

    const userAgent = headersList.get('user-agent') || 'unknown';

    const { error } = await supabase.from('site_visitors').insert([
      {
        session_id,
        page_path,
        referrer: referrer || null,
        user_agent: userAgent,
        ip_address: ipAddress,
      },
    ]);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(
        { error: 'Failed to track visitor' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Track visitor error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
