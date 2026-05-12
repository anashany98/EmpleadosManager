// DEBUG ONLY SCRIPT - Never run in production!
// This script tests API endpoints without external dependencies.

import http from 'http';

const TEST_IDENTIFIER = process.env.DEBUG_TEST_IDENTIFIER || '49480953h';
const TEST_PASSWORD = process.env.DEBUG_TEST_PASSWORD;

if (!TEST_PASSWORD) {
    console.error('ERROR: DEBUG_TEST_PASSWORD environment variable is required');
    console.error('Usage: DEBUG_TEST_PASSWORD=YourPassword npx ts-node scripts/debug_api_nodeps.ts');
    process.exit(1);
}

function postRequest(path: string, body: any) {
    const data = JSON.stringify(body);
    const options = {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
            console.log(`[${path}] Status: ${res.statusCode}`);
            console.log(`[${path}] Body:`, responseBody);
        });
    });

    req.on('error', (error) => {
        console.error(`[${path}] Error:`, error);
    });

    req.write(data);
    req.end();
}

console.log('Testing Login...');
postRequest('/api/auth/login', {
    identifier: TEST_IDENTIFIER,
    password: TEST_PASSWORD
});