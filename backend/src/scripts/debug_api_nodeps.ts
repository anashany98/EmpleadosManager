
import http from 'http';

function postRequest(path: string, body: any) {
    const data = JSON.stringify(body);
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
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
    identifier: '49480953h',
    password: 'password123'
});
