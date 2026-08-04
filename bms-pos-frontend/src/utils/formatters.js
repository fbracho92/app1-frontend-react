// src/utils/formatters.js
export const formatBs = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00';
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatUSD = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const capitalizeWords = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
};

export const validateIdNumber = (value) => {
    if (!value) return '';
    const upperValue = value.toUpperCase();
    const cleaned = upperValue.replace(/[^VEJGT\d-]/g, '');
    if (!cleaned) return '';
    let formatted = '';
    if ('VEJGT'.includes(cleaned[0])) {
        formatted += cleaned[0];
    } else {
        return '';
    }
    const numberPart = cleaned.substring(1).replace(/-/g, '');
    if (cleaned.length > 1) {
        formatted += '-' + numberPart;
    } else {
        formatted = cleaned;
    }
    if (formatted.includes('-')) {
        const parts = formatted.split('-');
        formatted = parts[0] + '-' + parts[1].replace(/[^\d]/g, '');
    }
    return formatted.substring(0, 15);
};

export const validatePhone = (value) => {
    if (!value) return '';
    const cleaned = value.replace(/[^+\d\s()-]/g, '');
    return cleaned.substring(0, 18);
};

export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};