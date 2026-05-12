// DEBUG ONLY SCRIPT - Never run in production!
// This script tests API endpoints locally.

import axios from 'axios';

const TEST_IDENTIFIER = process.env.DEBUG_TEST_IDENTIFIER || '49480953h';
const TEST_PASSWORD = process.env.DEBUG_TEST_PASSWORD;

if (!TEST_PASSWORD) {
    console.error('ERROR: DEBUG_TEST_PASSWORD environment variable is required');
    console.error('Usage: DEBUG_TEST_PASSWORD=YourPassword npx ts-node scripts/debug_api.ts');
    process.exit(1);
}

async function main() {
    try {
        console.log('Testing Health...');
        const health = await axios.get('http://localhost:3000/api/health');
        console.log('Health:', health.data);

        console.log('Testing Login...');
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            identifier: TEST_IDENTIFIER,
            password: TEST_PASSWORD
        });
        console.log('Login Success:', response.status);
    } catch (error: any) {
        console.error('Login Failed Status:', error.response?.status);
        console.error('Login Failed Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

main();