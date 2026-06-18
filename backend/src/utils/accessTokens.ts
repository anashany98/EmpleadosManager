import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET must be defined.');
}

export const ACCESS_TOKEN_EXPIRES_IN = '15m';

export const signAccessToken = (user: { id: string; sessionVersion: number }) => jwt.sign(
        { id: user.id, sessionVersion: user.sessionVersion },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
