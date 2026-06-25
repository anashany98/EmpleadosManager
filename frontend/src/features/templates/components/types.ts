import type { CanvasElement as BaseCanvasElement, ElementType } from '../templateBases';

export type CanvasElement = BaseCanvasElement;
export type { ElementType };

export const ELEMENT_TYPES: ElementType[] = ['text', 'variable', 'box', 'line', 'image'];
