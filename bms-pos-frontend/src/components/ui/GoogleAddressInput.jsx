import React, { useState, useEffect, useRef } from 'react';

const GoogleAddressInput = ({ value, onChange }) => {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const wrapperRef = useRef(null);

    // Sincronizar si cambia el valor externo
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    // Cerrar sugerencias al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Búsqueda con debounce en OpenStreetMap (Nominatim)
    useEffect(() => {
        if (!query || query.trim().length < 3) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Restringido a Venezuela (countrycodes=ve) con formato JSON
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ve&addressdetails=1&limit=5`;
                const response = await fetch(url, {
                    headers: {
                        'Accept-Language': 'es'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data);
                    setShowDropdown(true);
                }
            } catch (err) {
                console.error("Error consultando direcciones:", err);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (item) => {
        const fullAddress = item.display_name;
        setQuery(fullAddress);
        onChange(fullAddress);
        setShowDropdown(false);
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        onChange(val);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
            <input
                type="text"
                required
                value={query}
                onChange={handleChange}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                placeholder="Ej: Calle 9, Cabudare..."
                className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 pl-10 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all shadow-inner"
            />
            {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Menú de Sugerencias */}
            {showDropdown && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-[200] max-h-56 overflow-y-auto">
                    {suggestions.map((item, index) => (
                        <li
                            key={index}
                            onClick={() => handleSelect(item)}
                            className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors flex items-start gap-2"
                        >
                            <span className="mt-0.5 text-slate-400">📌</span>
                            <span className="truncate">{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default GoogleAddressInput;