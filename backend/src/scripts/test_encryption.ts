
import { EncryptionService } from '../services/EncryptionService';
import dotenv from 'dotenv';
dotenv.config();

try {
    const original = '12345678W';
    const encrypted = EncryptionService.encrypt(original);
    console.log('Encrypted:', encrypted);
    const decrypted = EncryptionService.decrypt(encrypted);
    console.log('Decrypted:', decrypted);

    if (original === decrypted) {
        console.log('✅ Encryption Service works.');
    } else {
        console.error('❌ Mismatch!');
    }
} catch (error) {
    console.error('❌ Error testing encryption:', error);
}
