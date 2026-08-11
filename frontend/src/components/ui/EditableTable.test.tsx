import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditableTable, type Column } from './EditableTable';

interface Row {
    id: string;
    name: string;
    hours: number;
    category: 'A' | 'B';
    notes?: string;
}

const sampleRows: Row[] = [
    { id: '1', name: 'Alice', hours: 10, category: 'A', notes: 'ok' },
    { id: '2', name: 'Bob',   hours: 5,  category: 'A' },
    { id: '3', name: 'Carol', hours: 20, category: 'B' },
];

const sampleColumns: Column<Row>[] = [
    { key: 'name',     header: 'Name',     type: 'text' },
    { key: 'hours',    header: 'Hours',    type: 'number', decimals: 1 },
    { key: 'category', header: 'Category', type: 'select', options: [{ value: 'A', label: 'Cat A' }, { value: 'B', label: 'Cat B' }] },
    { key: 'notes',    header: 'Notes',    type: 'text' },
];

function renderTable(overrides: Partial<Parameters<typeof EditableTable<Row>>[0]> = {}) {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onAddRow = vi.fn();
    const onDeleteRow = vi.fn();
    const utils = render(
        <EditableTable<Row>
            rows={sampleRows}
            columns={sampleColumns}
            rowKey={(r) => r.id}
            onChange={onChange}
            onSave={onSave}
            onAddRow={onAddRow}
            onDeleteRow={onDeleteRow}
            {...overrides}
        />,
    );
    return { ...utils, onChange, onSave, onAddRow, onDeleteRow };
}

describe('<EditableTable>', () => {
    it('renders one input per row per editable column', () => {
        renderTable();
        // 3 rows × 4 editable cols (select is a combobox, not textbox) = 9 textboxes
        expect(screen.getAllByRole('textbox')).toHaveLength(3 * 3);
        // 3 select elements (one per row)
        expect(screen.getAllByRole('combobox')).toHaveLength(3);
        // Headers
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Hours')).toBeInTheDocument();
        expect(screen.getByText('Category')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();
        // Row values
        expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Carol')).toBeInTheDocument();
    });

    it('formats number values with the configured decimals (es-ES)', () => {
        renderTable();
        // decimals: 1 → "10,0", "5,0", "20,0"
        expect(screen.getByDisplayValue('10,0')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5,0')).toBeInTheDocument();
        expect(screen.getByDisplayValue('20,0')).toBeInTheDocument();
    });

    it('parses comma as decimal separator (Spanish format)', () => {
        const { onChange } = renderTable();
        const hoursInput = screen.getByDisplayValue('10,0');
        fireEvent.change(hoursInput, { target: { value: '12,5' } });
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[1]).toBe('hours');
        expect(lastCall[2]).toBe(12.5);
    });

    it('strips thousands dots and parses comma as decimal', () => {
        const { onChange } = renderTable();
        const hoursInput = screen.getByDisplayValue('10,0');
        fireEvent.change(hoursInput, { target: { value: '1.234,56' } });
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[2]).toBe(1234.56);
    });

    it('rejects non-numeric input by keeping the raw string', () => {
        const { onChange } = renderTable();
        const hoursInput = screen.getByDisplayValue('10,0');
        fireEvent.change(hoursInput, { target: { value: 'abc' } });
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // parseInput returns the raw string for non-numeric
        expect(lastCall[2]).toBe('abc');
    });

    it('calls onChange with typed text value', () => {
        const { onChange } = renderTable();
        const nameInput = screen.getByDisplayValue('Alice');
        fireEvent.change(nameInput, { target: { value: 'Alicia' } });
        expect(onChange).toHaveBeenCalledWith('1', 'name', 'Alicia');
    });

    it('shows empty state when rows is empty', () => {
        renderTable({ rows: [], emptyMessage: 'Nada que mostrar' });
        // EmptyState renders the title in an h3 (and a sr-only span)
        const matches = screen.getAllByText('Nada que mostrar');
        expect(matches.length).toBeGreaterThan(0);
    });

    it('shows loading state when loading=true', () => {
        renderTable({ rows: [], loading: true });
        expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
    });

    it('shows add-row button when onAddRow is provided', () => {
        const { onAddRow } = renderTable();
        const btn = screen.getByRole('button', { name: /Añadir fila/i });
        fireEvent.click(btn);
        expect(onAddRow).toHaveBeenCalled();
    });

    it('renders a delete button per row when onDeleteRow is provided', () => {
        const { onDeleteRow } = renderTable();
        const buttons = screen.getAllByRole('button', { name: /Eliminar fila/i });
        expect(buttons).toHaveLength(3);
        fireEvent.click(buttons[1]);
        expect(onDeleteRow).toHaveBeenCalledWith('2');
    });

    it('readOnly hides inputs and disables add/delete', () => {
        renderTable({ readOnly: true });
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.queryAllByRole('combobox')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Añadir fila/i })).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: /Eliminar fila/i })).toHaveLength(0);
        // Values still shown as text
        expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('renders readonly columns as plain text even when not readOnly', () => {
        const cols: Column<Row>[] = [
            { key: 'name',  header: 'Name',  type: 'text' },
            { key: 'hours', header: 'Hours', type: 'readonly' },
        ];
        render(<EditableTable<Row> rows={sampleRows} columns={cols} rowKey={(r) => r.id} />);
        expect(screen.getAllByRole('textbox')).toHaveLength(3);
        // Hours displayed as text (formatted with default decimals 0 → "10", "5", "20")
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('renders a select for select-typed columns with the right value', () => {
        renderTable();
        const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
        expect(selects.length).toBe(3);
        expect(selects[0].value).toBe('A');
        expect(selects[2].value).toBe('B');
    });

    it('renders group headers when groupBy is provided', () => {
        renderTable({ groupBy: (r) => r.category });
        // Group headers: "▾ A" and "▾ B" (use getAllByText since "A" alone matches Alice too)
        const headers = screen.getAllByText(/^▾/);
        expect(headers.length).toBe(2);
        expect(headers[0]).toHaveTextContent('A');
        expect(headers[1]).toHaveTextContent('B');
    });

    it('renders totals row when totals is provided', () => {
        renderTable({ totals: { name: 'TOTAL', hours: 35 } });
        expect(screen.getByText('TOTAL')).toBeInTheDocument();
        // hours column has decimals: 1 → 35 → "35,0"
        expect(screen.getByText('35,0')).toBeInTheDocument();
    });

    it('validate: marks cell with error and prevents save', async () => {
        const cols: Column<Row>[] = [
            { key: 'name',  header: 'Name',  type: 'text' },
            { key: 'hours', header: 'Hours', type: 'number', validate: (v) => (typeof v === 'number' && v < 0 ? 'Negativo' : null) },
        ];
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(
            <EditableTable<Row>
                rows={[{ id: '1', name: 'X', hours: 5, category: 'A' }]}
                columns={cols}
                rowKey={(r) => r.id}
                onSave={onSave}
                saveDelayMs={10}
            />,
        );
        const hoursInput = screen.getByDisplayValue('5');
        fireEvent.change(hoursInput, { target: { value: '-3' } });
        fireEvent.blur(hoursInput);
        await waitFor(() => {
            // The error message is in the title attribute on the icon
            const icon = document.querySelector('[title="Negativo"]');
            expect(icon).toBeInTheDocument();
        });
        // onSave should NOT be called
        await new Promise((r) => setTimeout(r, 50));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onSave after blur + debounce', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(
            <EditableTable<Row>
                rows={sampleRows}
                columns={sampleColumns}
                rowKey={(r) => r.id}
                onSave={onSave}
                saveDelayMs={30}
            />,
        );
        const nameInput = screen.getByDisplayValue('Alice');
        fireEvent.change(nameInput, { target: { value: 'Alicia' } });
        fireEvent.blur(nameInput);
        await waitFor(() => {
            expect(onSave).toHaveBeenCalled();
        });
        const [rk, row] = onSave.mock.calls[0];
        expect(rk).toBe('1');
        expect(row.name).toBe('Alicia');
    });

    it('marks cell as aria-invalid when onSave throws', async () => {
        const onSave = vi.fn().mockRejectedValue(new Error('Boom'));
        render(
            <EditableTable<Row>
                rows={sampleRows}
                columns={sampleColumns}
                rowKey={(r) => r.id}
                onSave={onSave}
                saveDelayMs={10}
            />,
        );
        const input = screen.getByDisplayValue('Alice');
        fireEvent.change(input, { target: { value: 'X' } });
        fireEvent.blur(input);
        await waitFor(() => {
            const ariaInvalid = document.querySelector('[aria-invalid="true"]');
            expect(ariaInvalid).toBeInTheDocument();
        });
    });

    it('uses a custom render function when provided', () => {
        const cols: Column<Row>[] = [
            { key: 'name',  header: 'Name',  type: 'text' },
            { key: 'hours', header: 'Hours', type: 'readonly', render: (v) => <strong data-testid="custom">{String(v)}h</strong> },
        ];
        render(<EditableTable<Row> rows={sampleRows} columns={cols} rowKey={(r) => r.id} />);
        const customs = screen.getAllByTestId('custom');
        expect(customs).toHaveLength(3);
        expect(customs[0]).toHaveTextContent('10h');
    });
});
