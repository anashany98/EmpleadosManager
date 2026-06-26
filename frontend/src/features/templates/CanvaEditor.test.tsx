import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

vi.mock('../../api/client', () => {
    return {
        api: {
            get: vi.fn(),
            post: vi.fn()
        },
        BASE_URL: 'http://localhost'
    };
});

vi.mock('html2canvas', () => ({
    default: vi.fn()
}));

import { api } from '../../api/client';
import CanvaEditor from './CanvaEditor';

const mockApi = api as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
};

const listResponse = [
    { type: 'NDA', name: 'Acuerdo de Confidencialidad' },
    { type: 'CERTIFICADO_EMPRESA', name: 'Certificado Empresa' }
];

const storedResponse: unknown[] = [];

const employeesResponse = [
    { id: 'emp-1', dni: '00000000A', nombreCompleto: 'Ana Hany', puesto: 'Ingeniera', fechaAlta: '2024-01-01', tipoContrato: 'Indefinido' }
];

const variablesResponse = {
    exampleContext: {
        'empleado.nombreCompleto': 'Ana Hany',
        'empleado.dni': '00000000A',
        'empleado.puesto': 'Ingeniera',
        'firma.fecha': '23/06/2026'
    }
};

beforeEach(() => {
    mockApi.get.mockImplementation((url: string) => {
        if (url === '/document-templates/list') return Promise.resolve(listResponse);
        if (url === '/document-templates/stored') return Promise.resolve(storedResponse);
        if (url === '/employees') return Promise.resolve(employeesResponse);
        if (url.startsWith('/document-templates/variables')) return Promise.resolve(variablesResponse);
        return Promise.resolve({});
    });
    mockApi.post.mockResolvedValue({ id: 'saved-1', type: 'NDA', name: 'Acuerdo de Confidencialidad' });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    toast.dismiss();
});

describe('CanvaEditor', () => {
    it('loads templates and renders the editor with default elements', async () => {
        render(<CanvaEditor />);

        await waitFor(() => {
            expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
        });

        // Template cards are rendered as buttons with title attribute
        const templateButtons = screen.getAllByRole('button').filter(
            (btn) => btn.getAttribute('title') && btn.getAttribute('title')!.length > 0
        );
        expect(templateButtons.length).toBeGreaterThan(0);

        const stage = screen.getByTestId('canvas-stage');
        expect(within(stage).getAllByTestId(/canvas-element-/).length).toBeGreaterThan(0);
    });

    it('warns the user when the backend is unreachable and falls back to local catalog', async () => {
        mockApi.get.mockRejectedValue(new Error('network'));

        render(<CanvaEditor />);

        // The toast renders in a portal; the "Local" badge is always visible
        await waitFor(() => {
            expect(screen.getByText('Local')).toBeInTheDocument();
        });
    });

    it('toggles the dirty banner after a user mutation', async () => {
        render(<CanvaEditor />);

        await waitFor(() => {
            expect(mockApi.get).toHaveBeenCalledWith('/document-templates/list');
        });

        await waitFor(() => {
            expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('toolbar-add-text'));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/cambios sin guardar/i);
        });
    });

    it('detects unknown variables referenced in text elements', async () => {
        mockApi.get.mockImplementation((url: string) => {
            if (url === '/document-templates/list') return Promise.resolve(listResponse);
            if (url === '/document-templates/stored') return Promise.resolve(storedResponse);
            if (url === '/employees') return Promise.resolve(employeesResponse);
            return Promise.resolve({});
        });

        render(<CanvaEditor />);

        await waitFor(() => {
            expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('toolbar-add-text'));

        const panel = await screen.findByTestId('properties-panel');
        expect(panel).toBeInTheDocument();

        const textInput = await screen.findByTestId('text-input');
        fireEvent.change(textInput, { target: { value: 'Hola {{no.existe}} y {{empleado.dni}}' } });

        await waitFor(() => {
            expect(screen.getByTestId('variable-status-no.existe')).toHaveTextContent(/Sin definir/i);
        });
        expect(screen.getByTestId('variable-status-empleado.dni')).toHaveTextContent(/OK/i);
    });

    it('persists the template on save and clears the dirty state', async () => {
        render(<CanvaEditor />);

        await waitFor(() => {
            expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('toolbar-add-text'));

        const banner = await screen.findByRole('status');
        expect(banner).toHaveTextContent(/cambios sin guardar/i);

        fireEvent.click(screen.getByTestId('save-button'));

        await waitFor(() => {
            expect(mockApi.post).toHaveBeenCalledWith('/document-templates/save', expect.objectContaining({
                type: expect.any(String),
                content: expect.any(String),
                variables: expect.any(Array)
            }));
        });

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    it('duplicates the current template under another type', async () => {
        render(<CanvaEditor />);

        await waitFor(() => {
            expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('open-duplicate-dialog'));

        const dialog = await screen.findByTestId('duplicate-dialog');
        const targetSelect = dialog.querySelector('select') as HTMLSelectElement;
        const targetValue = Array.from(targetSelect.options).find(
            (option) => option.value && option.value !== targetSelect.value
        )?.value;
        expect(targetValue).toBeDefined();
        fireEvent.change(targetSelect, { target: { value: targetValue! } });

        fireEvent.click(within(dialog).getByTestId('duplicate-confirm'));

        await waitFor(() => {
            expect(mockApi.post).toHaveBeenCalledWith('/document-templates/save', expect.objectContaining({
                type: targetValue
            }));
        });
    });
});
