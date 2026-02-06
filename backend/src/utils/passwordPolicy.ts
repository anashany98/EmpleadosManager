export const validatePassword = (password: string): { ok: boolean; message?: string } => {
    if (!password || password.length < 10) {
        return { ok: false, message: 'La contraseña debe tener al menos 10 caracteres.' };
    }
    if (/\s/.test(password)) {
        return { ok: false, message: 'La contraseña no puede contener espacios.' };
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
        return { ok: false, message: 'La contraseña debe incluir mayúsculas y minúsculas.' };
    }
    if (!/[0-9]/.test(password)) {
        return { ok: false, message: 'La contraseña debe incluir números.' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return { ok: false, message: 'La contraseña debe incluir al menos un símbolo.' };
    }
    return { ok: true };
};

