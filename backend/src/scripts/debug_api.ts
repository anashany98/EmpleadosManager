
import axios from 'axios';

async function main() {
    try {
        console.log('Testing Health...');
        const health = await axios.get('http://localhost:3000/api/health');
        console.log('Health:', health.data);

        console.log('Testing Login...');
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            identifier: '49480953h',
            password: 'password123'
        });
        console.log('Login Success:', response.status);
    } catch (error: any) {
        console.error('Login Failed Status:', error.response?.status);
        console.error('Login Failed Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

main();
