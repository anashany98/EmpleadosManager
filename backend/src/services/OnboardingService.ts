import { prisma } from '../lib/prisma';
import { DocumentTemplateService } from './DocumentTemplateService';

interface OnboardingOptions {
    documents: {
        nda: boolean;
        rgpd: boolean;
        model145: boolean;
        contract?: boolean; // Future
    };
    inventory: {
        uniformIds: string[];
        epiIds: string[];
        techItemId?: string;
        deviceName?: string; // If techItemId is not provided
        serialNumber?: string;
    };
    authorName: string;
}

export const OnboardingService = {
    startOnboarding: async (employeeId: string, options: OnboardingOptions) => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { company: true }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        const results = {
            documents: [] as string[],
            errors: [] as string[]
        };

        // 1. Generate Legal Documents
        if (options.documents.nda) {
            try {
                await DocumentTemplateService.generateNDA(employeeId, options.authorName);
                results.documents.push('NDA');
            } catch (error: any) {
                results.errors.push(`Error generando NDA: ${error.message}`);
            }
        }

        if (options.documents.rgpd) {
            try {
                await DocumentTemplateService.generateRGPD(employeeId, options.authorName);
                results.documents.push('RGPD');
            } catch (error: any) {
                results.errors.push(`Error generando RGPD: ${error.message}`);
            }
        }

        if (options.documents.model145) {
            try {
                await DocumentTemplateService.generateModel145(employeeId, options.authorName);
                results.documents.push('Modelo 145');
            } catch (error: any) {
                results.errors.push(`Error generando Modelo 145: ${error.message}`);
            }
        }

        // 2. Generate Inventory Documents (if items selected)
        // Uniforms
        if (options.inventory.uniformIds && options.inventory.uniformIds.length > 0) {
            try {
                // Fetch items to get names/sizes if needed, but generateUniform expects {id, name, size}
                // We need to fetch details from DB because frontend might just send IDs?
                // Or maybe frontend sends full objects. Let's assume frontend sends IDs for security/validation
                // but DocumentTemplateService expects {id, name, size}.

                // Let's allow the service to handle just IDs if we wanted, but currently it expects full objects or we fetch them here.
                // Fetching from DB is safer.
                const itemsRequest = await prisma.inventoryItem.findMany({
                    where: { id: { in: options.inventory.uniformIds } }
                });

                const itemsPayload = itemsRequest.map(i => ({
                    id: i.id,
                    name: i.name,
                    size: i.size || ''
                }));

                if (itemsPayload.length > 0) {
                    await DocumentTemplateService.generateUniform(employeeId, itemsPayload, options.authorName);
                    results.documents.push('Entrega Uniforme');
                }
            } catch (error: any) {
                results.errors.push(`Error generando Entrega Uniforme: ${error.message}`);
            }
        }

        // EPIs
        if (options.inventory.epiIds && options.inventory.epiIds.length > 0) {
            try {
                const itemsRequest = await prisma.inventoryItem.findMany({
                    where: { id: { in: options.inventory.epiIds } }
                });

                const itemsPayload = itemsRequest.map(i => ({
                    id: i.id,
                    name: i.name,
                    size: i.size || ''
                }));

                if (itemsPayload.length > 0) {
                    await DocumentTemplateService.generateEPI(employeeId, itemsPayload, options.authorName);
                    results.documents.push('Entrega EPIs');
                }
            } catch (error: any) {
                results.errors.push(`Error generando Entrega EPIs: ${error.message}`);
            }
        }

        // Tech
        if (options.inventory.techItemId) {
            try {
                const techItem = await prisma.inventoryItem.findUnique({
                    where: { id: options.inventory.techItemId }
                });

                if (techItem) {
                    await DocumentTemplateService.generateTechDevice(
                        employeeId,
                        techItem.name,
                        options.inventory.serialNumber || 'S/N Desconocido',
                        options.authorName,
                        techItem.id
                    );
                    results.documents.push('Entrega Tecnología');
                }
            } catch (error: any) {
                results.errors.push(`Error generando Entrega Tecnología: ${error.message}`);
            }
        } else if (options.inventory.deviceName) {
            // Manual tech entry
            try {
                await DocumentTemplateService.generateTechDevice(
                    employeeId,
                    options.inventory.deviceName,
                    options.inventory.serialNumber || '',
                    options.authorName
                );
                results.documents.push('Entrega Tecnología (Manual)');
            } catch (error: any) {
                results.errors.push(`Error generando Entrega Tecnología Manual: ${error.message}`);
            }
        }

        return results;
    }
};
