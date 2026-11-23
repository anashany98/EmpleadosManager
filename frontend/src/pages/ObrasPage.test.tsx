import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { ConfirmProvider } from '../context/ConfirmContext';
import ObrasPage from './ObrasPage';

vi.mock('../api/client', () => ({ api: { get: vi.fn(), patch: vi.fn() }, getErrorMessage: vi.fn() }));

it('edits the code of an existing obra and shows the saved code', async () => {
    const obra = { id: 'obra-1', code: 'OLD', name: 'Obra de prueba', status: 'ACTIVE', active: true };
    vi.mocked(api.get).mockImplementation(async endpoint => ({
        data: endpoint === '/obras' ? [obra] : []
    }));
    vi.mocked(api.patch).mockImplementation(async () => {
        obra.code = 'NEW';
        return { data: obra };
    });

    render(<MemoryRouter><ConfirmProvider><ObrasPage /></ConfirmProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    const code = screen.getByRole('textbox', { name: /Código/ });
    expect(code).toBeEnabled();
    fireEvent.change(code, { target: { value: 'NEW' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('NEW')).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith('/obras/obra-1', expect.objectContaining({ code: 'NEW' }));
});
