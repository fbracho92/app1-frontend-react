// src/constants/appConstants.js
export const API_URL = import.meta.env.VITE_API_URL || 'https://bms-digital-pos-venta-8h7l.onrender.com/api';
export const IVA_RATE = 0.16;

export const EMOJI_OPTIONS = [
    '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥙', '🧆', '🥪', '🫔', '🍝', '🍜', '🍲', '🥣', '🥗', '🥘', '🍣', '🍤', '🍙', '🍚', '🍛', '🦪', '🍢', '🍡', '🥟', '🥠', '🥡', '🍜', '🫓',
    '🥩', '🥓', '🍗', '🍖', '🥚', '🍳', '🐟', '🦞', '🦀', '🦐', '🦑',
    '🍎', '🍏', '🍊', '🍋', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🧅', '🧄', '🍠', '🍄', '🥜', '🌰', '🌽', '🥕', '🥔', '🥐', '🍞', '🥖', '🥨', '🥯', '🧇', '🧀', '🧈', '🥛', '🍼', '🍯', '🥫', '🧂',
    '🍰', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍩', '🍪', '🍦', '🍧', '🍨', '🍿', '🥞',
    '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍌', '🍐',
    '🥤', '🧋', '🫖', '☕️', '🍵', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🧃', '💧', '🧊',
    '🧼', '🧻', '🧴', '🪥', '🧽', '🚿', '🛀', '🧸',
    '🎄', '🎅', '🎁', '🎉', '🎈',
    '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '🔋', '🔌', '💡', '💾', '💿', '⏱️', '⌚', '🎙️', '🎧',
    '🏷️', '🛍️', '💸', '📦', '🛠️', '🧹', '🧺', '🛒', '🔑', '🔗', '📍'
];

export const PAYMENT_METHODS = [
    { name: 'Efectivo Ref', currency: 'Ref' },
    { name: 'Efectivo Bs', currency: 'Bs' },
    { name: 'Zelle', currency: 'Ref' },
    { name: 'Donación', currency: 'Ref' },
    { name: 'Crédito', currency: 'Ref' },
    { name: 'Pago Móvil', currency: 'Bs' },
    { name: 'Punto de Venta', currency: 'Bs' },
];

export const METHODS_REQUIRING_REFERENCE = ['Pago Móvil', 'Punto de Venta', 'Zelle'];
