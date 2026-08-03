import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    className?: string;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Buscar...',
    debounceMs = 300,
    className = ''
}: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);

    // Sync with external value
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Debounced onChange with URL sync
    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(localValue);
            setIsLoading(false);

            // Update URL with search param
            if (localValue) {
                searchParams.set('search', localValue);
            } else {
                searchParams.delete('search');
            }
            setSearchParams(searchParams, { replace: true });
        }, debounceMs);

        return () => {
            clearTimeout(timer);
        };
    }, [localValue, debounceMs, onChange, searchParams, setSearchParams]);

    const handleClear = () => {
        setLocalValue('');
        onChange('');
        searchParams.delete('search');
        setSearchParams(searchParams, { replace: true });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsLoading(true);
        setLocalValue(e.target.value);
    };

    return (
        <div className={`relative ${className}`}>
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
            />
            <input
                type="text"
                placeholder={placeholder}
                value={localValue}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow placeholder:text-slate-400"
                aria-label={placeholder}
            />
            {isLoading && localValue && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            {localValue && !isLoading && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label="Limpiar búsqueda"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

export default SearchInput;