import type { CanvasElement, ElementType } from './types';

export type { CanvasElement, ElementType };

export interface ElementDescriptor {
    type: ElementType;
    label: string;
    icon: string;
}

export const ELEMENT_LIBRARY: ElementDescriptor[] = [
    { type: 'text', label: 'Texto', icon: 'Type' },
    { type: 'variable', label: 'Variable', icon: 'Variable' },
    { type: 'box', label: 'Caja', icon: 'Square' },
    { type: 'line', label: 'Línea', icon: 'Minus' },
    { type: 'image', label: 'Imagen', icon: 'Image' }
];
