import { describe, expect, it } from 'vitest';
import { getSocketAccessToken, normalizeLockPayload } from './handler';

describe('websocket handler helpers', () => {
    describe('getSocketAccessToken', () => {
        it('prefers handshake auth token for legacy clients', () => {
            const token = getSocketAccessToken({
                handshake: {
                    auth: { token: 'legacy-token' },
                    headers: { cookie: 'access_token=cookie-token' }
                }
            } as any);

            expect(token).toBe('legacy-token');
        });

        it('reads access_token from cookies for HttpOnly production auth', () => {
            const token = getSocketAccessToken({
                handshake: {
                    auth: {},
                    headers: { cookie: 'csrf_token=abc; access_token=cookie%20token; theme=dark' }
                }
            } as any);

            expect(token).toBe('cookie token');
        });
    });

    describe('normalizeLockPayload', () => {
        it('keeps compatibility with legacy numeric employee ids', () => {
            expect(normalizeLockPayload(42)).toEqual({
                employeeId: '42',
                resourceId: '42',
                resourceType: 'employee'
            });
        });

        it('accepts object lock payloads from the frontend', () => {
            expect(normalizeLockPayload({
                resourceId: 'emp-1',
                resourceType: 'employee',
                employeeId: 'emp-1'
            })).toEqual({
                employeeId: 'emp-1',
                resourceId: 'emp-1',
                resourceType: 'employee'
            });
        });
    });
});
