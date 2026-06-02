import { AppError } from './AppError';
import { createLogger } from '../services/LoggerService';

const log = createLogger('FileSecurity');

// Known malicious file signatures (magic bytes)
const MALICIOUS_SIGNATURES: Array<{ name: string; signature: number[]; offset: number }> = [
    // Windows executables (PE headers)
    { name: 'PE_EXE', signature: [0x4D, 0x5A], offset: 0 }, // MZ
    // Linux executables (ELF)
    { name: 'ELF', signature: [0x7F, 0x45, 0x4C, 0x46], offset: 0 }, // .ELF
    // Shell scripts
    { name: 'SHELL_SCRIPT', signature: [0x23, 0x21], offset: 0 }, // #!
    // Batch files
    { name: 'BATCH', signature: [0x40, 0x65, 0x63, 0x68, 0x6F], offset: 0 }, // @echo
    // PHP
    { name: 'PHP', signature: [0x3C, 0x3F, 0x70, 0x68, 0x70], offset: 0 }, // <?php
    // JavaScript with eval
    { name: 'JS_EVAL', signature: [0x65, 0x76, 0x61, 0x6C, 0x28], offset: 0 }, // eval(
    // HTML script injection
    { name: 'HTML_SCRIPT', signature: [0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74], offset: 0 }, // <script
];

// Valid magic bytes for allowed file types
const VALID_MAGIC_BYTES: Record<string, Array<{ signature: number[]; offset: number }>> = {
    'application/pdf': [
        { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 } // %PDF
    ],
    'image/jpeg': [
        { signature: [0xFF, 0xD8, 0xFF], offset: 0 }
    ],
    'image/png': [
        { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 } // ZIP (XLSX is ZIP-based)
    ],
    'application/vnd.ms-excel': [
        { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0 } // OLE2
    ],
    'application/msword': [
        { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0 } // OLE2
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 } // ZIP (DOCX is ZIP-based)
    ],
    'text/csv': [
        // CSV doesn't have a magic byte signature, validate via content
        { signature: [], offset: 0 }
    ]
};

/**
 * Check if file contains known malicious signatures
 */
export function checkForMaliciousSignatures(buffer: Buffer): string | null {
    for (const malware of MALICIOUS_SIGNATURES) {
        if (buffer.length < malware.offset + malware.signature.length) {
            continue;
        }
        
        let match = true;
        for (let i = 0; i < malware.signature.length; i++) {
            if (buffer[malware.offset + i] !== malware.signature[i]) {
                match = false;
                break;
            }
        }
        
        if (match) {
            return malware.name;
        }
    }
    
    return null;
}

/**
 * Validate file magic bytes match expected MIME type
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const expectedSignatures = VALID_MAGIC_BYTES[mimeType];
    
    if (!expectedSignatures) {
        // Unknown MIME type - allow but log warning
        log.warn({ mimeType }, 'Unknown MIME type, skipping magic byte validation');
        return true;
    }
    
    for (const expected of expectedSignatures) {
        if (buffer.length < expected.offset + expected.signature.length) {
            continue;
        }
        
        let match = true;
        for (let i = 0; i < expected.signature.length; i++) {
            if (buffer[expected.offset + i] !== expected.signature[i]) {
                match = false;
                break;
            }
        }
        
        if (match) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check for suspicious file content patterns
 */
export function checkSuspiciousContent(buffer: Buffer): string[] {
    const issues: string[] = [];
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    
    // Check for excessive null bytes (binary masquerading as text)
    const nullCount = (content.match(/\0/g) || []).length;
    if (nullCount > 100) {
        issues.push('SUSPICIOUS_NULL_BYTES');
    }
    
    // Check for executable patterns in text files
    if (content.includes('<?php') || content.includes('<%')) {
        issues.push('SERVER_SIDE_CODE');
    }
    
    // Check for SQL injection patterns
    if (/UNION\s+SELECT/i.test(content) || /DROP\s+TABLE/i.test(content)) {
        issues.push('SQL_INJECTION_PATTERN');
    }
    
    // Check for command injection patterns
    if (/\$\(|`[^`]*`|eval\(/i.test(content)) {
        issues.push('COMMAND_INJECTION_PATTERN');
    }
    
    return issues;
}

/**
 * Comprehensive file security scan
 */
export async function scanFileSecurity(
    buffer: Buffer,
    originalName: string,
    mimeType: string
): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // 1. Check for malicious signatures
    const malware = checkForMaliciousSignatures(buffer);
    if (malware) {
        issues.push(`MALICIOUS_SIGNATURE_${malware}`);
        log.error({ filename: originalName, malware }, 'Malicious signature detected');
    }
    
    // 2. Validate magic bytes match MIME type
    if (!validateMagicBytes(buffer, mimeType)) {
        issues.push('MAGIC_BYTE_MISMATCH');
        log.warn({ filename: originalName, mimeType }, 'Magic bytes do not match MIME type');
    }
    
    // 3. Check for suspicious content
    const suspicious = checkSuspiciousContent(buffer);
    issues.push(...suspicious);
    
    // 4. Check file size anomalies
    if (buffer.length === 0) {
        issues.push('EMPTY_FILE');
    }
    
    // 5. Check for double extensions (e.g., document.pdf.exe)
    const nameParts = originalName.split('.');
    if (nameParts.length > 2) {
        const suspiciousExtensions = ['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'js', 'ws', 'wsh'];
        const lastExt = nameParts[nameParts.length - 1].toLowerCase();
        if (suspiciousExtensions.includes(lastExt)) {
            issues.push('SUSPICIOUS_DOUBLE_EXTENSION');
            log.error({ filename: originalName }, 'Suspicious double extension detected');
        }
    }
    
    return {
        safe: issues.length === 0,
        issues
    };
}

/**
 * ClamAV integration placeholder
 * Requires CLAMAV_HOST and CLAMAV_PORT environment variables
 */
export async function scanWithClamAV(buffer: Buffer): Promise<{ clean: boolean; virus?: string }> {
    const clamavHost = process.env.CLAMAV_HOST;
    const clamavPort = process.env.CLAMAV_PORT;
    
    if (!clamavHost || !clamavPort) {
        // ClamAV not configured - skip scan
        log.debug('ClamAV not configured, skipping virus scan');
        return { clean: true };
    }
    
    try {
        // Dynamic import to avoid issues when clamav is not installed
        const net = await import('net');
        
        return new Promise((resolve) => {
            const client = net.createConnection(Number(clamavPort), clamavHost);
            const timeout = setTimeout(() => {
                client.destroy();
                log.error('ClamAV scan timeout');
                resolve({ clean: true }); // Fail open
            }, 30000);
            
            client.on('connect', () => {
                // Send INSTREAM command
                client.write(`zINSTREAM\0`);
                
                // Send file size
                const sizeBuf = Buffer.alloc(4);
                sizeBuf.writeUInt32BE(buffer.length, 0);
                client.write(sizeBuf);
                
                // Send file data
                client.write(buffer);
                
                // Send zero-length chunk to indicate end
                const zeroBuf = Buffer.alloc(4);
                zeroBuf.writeUInt32BE(0, 0);
                client.write(zeroBuf);
            });
            
            client.on('data', (data) => {
                clearTimeout(timeout);
                const response = data.toString();
                
                if (response.includes('OK')) {
                    resolve({ clean: true });
                } else {
                    // Extract virus name from response
                    const match = response.match(/stream: (.+?) FOUND/);
                    const virus = match ? match[1] : 'UNKNOWN';
                    resolve({ clean: false, virus });
                }
                client.destroy();
            });
            
            client.on('error', (err) => {
                clearTimeout(timeout);
                log.error({ error: err }, 'ClamAV connection error');
                resolve({ clean: true }); // Fail open
            });
        });
    } catch (error) {
        log.error({ error }, 'ClamAV scan failed');
        return { clean: true }; // Fail open
    }
}
