import { WakaTimeStatus } from '../lib/WakaTimeStatus.js';

export const config = {
    runtime: 'edge'
};

export default async function handler(request) {
    // Allow both GET and POST for GitHub Actions
    if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    try {
        const statusUpdater = new WakaTimeStatus();
        const result = await statusUpdater.updateStatus();

        return new Response(
            JSON.stringify({ success: result }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
