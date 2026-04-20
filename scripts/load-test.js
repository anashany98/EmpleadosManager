#!/usr/bin/env node
/**
 * Load Testing Script for EmpleadosManager
 * Simulates 4-6 concurrent users for 5 minutes
 * 
 * Usage: node load-test.js [duration_seconds] [concurrent_users]
 * Example: node load-test.js 300 6
 */

const http = require('http');
const https = require('https');

const CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:16161',
    duration: parseInt(process.argv[2]) || 300, // 5 minutes
    concurrentUsers: parseInt(process.argv[3]) || 6,
    endpoints: [
        { path: '/api/health', method: 'GET', weight: 30 }, // Health checks (frequent)
        { path: '/api/employees?page=1&limit=10', method: 'GET', weight: 20 }, // List employees
        { path: '/api/auth/me', method: 'GET', weight: 15 }, // User profile
        { path: '/api/calendar', method: 'GET', weight: 10 }, // Calendar
        { path: '/api/payroll?page=1&limit=10', method: 'GET', weight: 10 }, // Payroll
        { path: '/api/timesheet', method: 'GET', weight: 10 }, // Timesheet
        { path: '/api/documents', method: 'GET', weight: 5 }, // Documents
    ]
};

// Metrics
const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    errors: {},
    startTime: Date.now()
};

function getRandomEndpoint() {
    const totalWeight = CONFIG.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of CONFIG.endpoints) {
        random -= endpoint.weight;
        if (random <= 0) return endpoint;
    }
    return CONFIG.endpoints[0];
}

function makeRequest() {
    const endpoint = getRandomEndpoint();
    const url = new URL(endpoint.path, CONFIG.baseUrl);
    const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: endpoint.method,
        timeout: 10000
    };

    const startTime = Date.now();
    
    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        const responseTime = Date.now() - startTime;
        metrics.totalRequests++;
        metrics.responseTimes.push(responseTime);
        
        if (res.statusCode >= 200 && res.statusCode < 400) {
            metrics.successfulRequests++;
        } else {
            metrics.failedRequests++;
            const errorKey = `${res.statusCode}`;
            metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
        }
        
        res.resume(); // Consume response data
    });

    req.on('error', (error) => {
        metrics.totalRequests++;
        metrics.failedRequests++;
        metrics.errors['CONNECTION_ERROR'] = (metrics.errors['CONNECTION_ERROR'] || 0) + 1;
    });

    req.on('timeout', () => {
        req.destroy();
        metrics.totalRequests++;
        metrics.failedRequests++;
        metrics.errors['TIMEOUT'] = (metrics.errors['TIMEOUT'] || 0) + 1;
    });

    req.end();
}

function simulateUser() {
    // Each user makes requests every 2-5 seconds
    const interval = 2000 + Math.random() * 3000;
    
    const timer = setInterval(() => {
        if (Date.now() - metrics.startTime > CONFIG.duration * 1000) {
            clearInterval(timer);
            return;
        }
        makeRequest();
    }, interval);
    
    // Make first request immediately
    makeRequest();
}

function printResults() {
    const duration = (Date.now() - metrics.startTime) / 1000;
    const rps = metrics.totalRequests / duration;
    const avgResponseTime = metrics.responseTimes.length > 0 
        ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
        : 0;
    const p95ResponseTime = metrics.responseTimes.length > 0
        ? metrics.responseTimes.sort((a, b) => a - b)[Math.floor(metrics.responseTimes.length * 0.95)]
        : 0;
    const p99ResponseTime = metrics.responseTimes.length > 0
        ? metrics.responseTimes.sort((a, b) => a - b)[Math.floor(metrics.responseTimes.length * 0.99)]
        : 0;
    const errorRate = metrics.totalRequests > 0 
        ? (metrics.failedRequests / metrics.totalRequests * 100).toFixed(2) 
        : 0;

    console.log('\n📊 Load Test Results');
    console.log('='.repeat(50));
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Concurrent Users: ${CONFIG.concurrentUsers}`);
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Successful: ${metrics.successfulRequests}`);
    console.log(`Failed: ${metrics.failedRequests}`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
    console.log(`Error Rate: ${errorRate}%`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`P95 Response Time: ${p95ResponseTime.toFixed(0)}ms`);
    console.log(`P99 Response Time: ${p99ResponseTime.toFixed(0)}ms`);
    
    if (Object.keys(metrics.errors).length > 0) {
        console.log('\n❌ Errors:');
        Object.entries(metrics.errors).forEach(([error, count]) => {
            console.log(`  ${error}: ${count}`);
        });
    }

    // Pass/Fail criteria
    console.log('\n✅ Pass/Fail Criteria:');
    const criteria = [
        { name: 'Error Rate < 5%', pass: parseFloat(errorRate) < 5 },
        { name: 'Avg Response < 2000ms', pass: avgResponseTime < 2000 },
        { name: 'P95 Response < 5000ms', pass: p95ResponseTime < 5000 },
        { name: 'RPS > 10', pass: rps > 10 }
    ];

    criteria.forEach(c => {
        console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`);
    });

    const allPassed = criteria.every(c => c.pass);
    console.log(`\n${allPassed ? '🎉 ALL CRITERIA PASSED' : '⚠️ SOME CRITERIA FAILED'}`);
}

// Run test
console.log(`🚀 Starting load test...`);
console.log(`   Duration: ${CONFIG.duration}s`);
console.log(`   Concurrent Users: ${CONFIG.concurrentUsers}`);
console.log(`   Base URL: ${CONFIG.baseUrl}`);

// Start users
for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    simulateUser();
}

// Print results after duration
setTimeout(() => {
    printResults();
    process.exit(0);
}, CONFIG.duration * 1000);
