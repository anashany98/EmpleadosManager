import { describe, expect, it } from 'vitest';
import { isAuthThrottlingEnabled } from './authThrottling';

describe('isAuthThrottlingEnabled', () => {
    it('habilita el throttling en produccion por defecto', () => {
        expect(isAuthThrottlingEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it('deshabilita el throttling en desarrollo por defecto', () => {
        expect(isAuthThrottlingEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('permite activarlo manualmente en desarrollo', () => {
        expect(isAuthThrottlingEnabled({ NODE_ENV: 'development', ENABLE_AUTH_THROTTLING: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it('mantiene el throttling activo en produccion aunque el flag no este activado', () => {
        expect(isAuthThrottlingEnabled({ NODE_ENV: 'production', ENABLE_AUTH_THROTTLING: 'false' } as NodeJS.ProcessEnv)).toBe(true);
    });
});
