import { describe, expect, it } from 'vitest';
import {
    getDocumentGenerationRequest,
    resolveDocumentGeneratorTemplates
} from './documentGeneratorUtils';

describe('document generator request builder', () => {
    it('routes canonical template types through the generic template endpoint', () => {
        const request = getDocumentGenerationRequest({
            docType: 'CERTIFICADO_EMPRESA',
            employeeId: 'emp-1',
            authorName: 'Directora'
        });

        expect(request).toEqual({
            endpoint: '/document-templates/generate',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Directora',
                templateType: 'CERTIFICADO_EMPRESA'
            }
        });
    });

    it('keeps model 145 on the official state endpoint', () => {
        const request = getDocumentGenerationRequest({
            docType: 'MODEL_145',
            employeeId: 'emp-1',
            authorName: 'Responsable'
        });

        expect(request).toEqual({
            endpoint: '/documents/generate-145',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Responsable'
            }
        });
    });

    it('keeps uniform generation on the stock-aware document endpoint', () => {
        const request = getDocumentGenerationRequest({
            docType: 'UNIFORM',
            employeeId: 'emp-1',
            authorName: 'Responsable',
            selectedItems: [
                { id: 'item-1', name: 'Camisa', size: 'M' },
                { id: 'item-2', name: 'Pantalon' }
            ]
        });

        expect(request).toEqual({
            endpoint: '/documents/generate-uniform',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Responsable',
                items: [
                    { id: 'item-1', name: 'Camisa', size: 'M', quantity: 1 },
                    { id: 'item-2', name: 'Pantalon', size: '', quantity: 1 }
                ]
            }
        });
    });

    it('keeps tech device generation on the asset-aware endpoint', () => {
        const request = getDocumentGenerationRequest({
            docType: 'TECH_DEVICE',
            employeeId: 'emp-1',
            authorName: 'Responsable',
            selectedTechItem: {
                id: 'tech-1',
                name: 'iPhone 16',
                serialNumber: 'SN-001'
            }
        });

        expect(request).toEqual({
            endpoint: '/documents/generate-tech',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Responsable',
                deviceName: 'iPhone 16',
                serialNumber: 'SN-001',
                itemId: 'tech-1'
            }
        });
    });

    it('routes entrega material through its dedicated endpoint and preserves quantities', () => {
        const request = getDocumentGenerationRequest({
            docType: 'ENTREGA_MATERIAL',
            employeeId: 'emp-1',
            authorName: 'Responsable',
            selectedItems: [
                { id: 'item-1', name: 'Cable HDMI', quantity: 3, detail: '2 metros' },
                { id: 'item-2', name: 'Adaptador USB-C', quantity: 1 }
            ]
        });

        expect(request).toEqual({
            endpoint: '/documents/generate-material',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Responsable',
                items: [
                    { id: 'item-1', name: 'Cable HDMI', quantity: 3, detail: '2 metros' },
                    { id: 'item-2', name: 'Adaptador USB-C', quantity: 1, detail: '' }
                ]
            }
        });
    });

    it('requires an inventory item before generating a tech device document', () => {
        expect(() => getDocumentGenerationRequest({
            docType: 'TECH_DEVICE',
            employeeId: 'emp-1',
            authorName: 'Responsable'
        })).toThrow('Selecciona un dispositivo del inventario');
    });

    it('includes extra data for diet allowance documents', () => {
        const request = getDocumentGenerationRequest({
            docType: 'FIRMA_DIETAS',
            employeeId: 'emp-1',
            authorName: 'Responsable',
            extraData: {
                dietas: {
                    concepto: 'Desplazamiento',
                    importe: 120.5,
                    fecha: '2026-04-30',
                    kilometros: 300
                }
            }
        });

        expect(request).toEqual({
            endpoint: '/document-templates/generate',
            payload: {
                employeeId: 'emp-1',
                authorName: 'Responsable',
                templateType: 'FIRMA_DIETAS',
                extraContext: {
                    dietas: {
                        concepto: 'Desplazamiento',
                        importe: 120.5,
                        fecha: '2026-04-30',
                        kilometros: 300
                    }
                }
            }
        });
    });
});

describe('document generator template catalog', () => {
    it('resolves one visible card per standard type, prefers company templates, and keeps canonical labels', () => {
        const { standardTemplates, customTemplates } = resolveDocumentGeneratorTemplates(
            {
                data: [
                    { type: 'NDA', name: 'Confidencialidad base' },
                    { type: 'RGPD', name: 'RGPD base' }
                ]
            },
            {
                data: [
                    {
                        id: 'nda-global',
                        type: 'NDA',
                        name: 'Confidencialidad global',
                        companyId: null,
                        isDefault: true,
                        updatedAt: '2026-04-01T10:00:00.000Z'
                    },
                    {
                        id: 'nda-company',
                        type: 'NDA',
                        name: 'Acuerdo empresa',
                        companyId: 'company-1',
                        updatedAt: '2026-04-10T10:00:00.000Z'
                    },
                    {
                        id: 'epi-company',
                        type: 'EPI',
                        name: 'Acuerdo de confidencialidad',
                        companyId: 'company-1',
                        updatedAt: '2026-04-11T10:00:00.000Z'
                    },
                    {
                        id: 'rgpd-company',
                        type: 'RGPD',
                        name: 'Acuerdo de confidencialidad',
                        companyId: 'company-1',
                        updatedAt: '2026-04-12T10:00:00.000Z'
                    },
                    {
                        id: 'model-145-stored',
                        type: 'MODEL_145',
                        name: 'Modelo 145 custom',
                        companyId: 'company-1',
                        updatedAt: '2026-04-15T10:00:00.000Z'
                    },
                    {
                        id: 'custom-1',
                        type: 'CUSTOM_CERT',
                        name: 'Certificado libre',
                        companyId: 'company-1',
                        updatedAt: '2026-04-20T10:00:00.000Z'
                    }
                ]
            }
        );

        expect(standardTemplates.find((template) => template.type === 'NDA')).toMatchObject({
            type: 'NDA',
            name: 'Confidencialidad',
            source: 'company',
            hasStoredTemplate: true
        });
        expect(standardTemplates.find((template) => template.type === 'RGPD')).toMatchObject({
            type: 'RGPD',
            name: 'Clausula RGPD'
        });
        expect(standardTemplates.find((template) => template.type === 'EPI')).toMatchObject({
            type: 'EPI',
            name: 'Entrega EPI'
        });
        expect(standardTemplates.find((template) => template.type === 'MODEL_145')).toMatchObject({
            type: 'MODEL_145',
            name: 'Modelo 145 oficial',
            source: 'official',
            hasStoredTemplate: false
        });
        expect(customTemplates).toEqual([
            {
                type: 'CUSTOM_CERT',
                name: 'Certificado libre',
                source: 'company',
                hasStoredTemplate: true
            }
        ]);
    });
});
