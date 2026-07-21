import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';
import { EncryptionService } from './EncryptionService';
import { createLogger } from './LoggerService';
import { upsertEmployeeVacationBalance } from './VacationBalanceService';

import {
    IMPORT_FIELDS,
    FIELD_MAP,
    EmployeeImportFieldKey,
    ImportOptions,
    EmployeeImportPreview
} from './employeeImport/importTypes';

import { normalizeString, cleanText, hasMeaningfulRowData } from './employeeImport/csvParser';
import { parseInputFile } from './employeeImport/excelFileParser';
import {
    parseMoney,
    parseWeeklyHours,
    normalizeGender,
    normalizeWorkingDayType,
    isUuid,
    parseDate,
    parseBool,
    collectSampleValues
} from './employeeImport/valueParsers';
import {
    normalizeCompanyName,
    findBestExistingValue,
    createTextValueResolver,
    similarityScore
} from './employeeImport/stringSimilarity';
import { buildCurrentMapping } from './employeeImport/columnMapping';
import {
    getMappedRawValue,
    getMappedString,
    buildPreviewRows,
    buildPreviewWarnings,
    isExampleRow
} from './employeeImport/importPreviewBuilder';

// Barrel re-export so existing consumers don't break
export * from './employeeImport/importTypes';

const log = createLogger('EmployeeImportService');

async function createAutoCompany(name: string, auditUserId?: string) {
    let attempts = 0;

    while (attempts < 5) {
        attempts += 1;
        const cif = `AUTO-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

        try {
            const company = await prisma.company.create({
                data: {
                    name,
                    cif,
                    country: 'España'
                }
            });

            await AuditService.log('CREATE', 'COMPANY', company.id, {
                info: 'Auto-created from employee import',
                name: company.name,
                cif: company.cif
            }, auditUserId);

            return company;
        } catch (error: any) {
            if (error?.code === 'P2002' && attempts < 5) {
                continue;
            }
            throw error;
        }
    }

    throw new Error(`No se pudo crear la empresa automaticamente para "${name}".`);
}

async function buildCompanyResolver(options: ImportOptions, mapping: Partial<Record<EmployeeImportFieldKey, string>>) {
    if (options.forceCompanyId || !mapping.companyName) {
        return {
            async resolve() {
                return { companyId: options.forceCompanyId };
            }
        };
    }

    const knownCompanies = await prisma.company.findMany({
        select: { id: true, name: true, cif: true },
        orderBy: { name: 'asc' }
    });

    return {
        async resolve(rawCompanyName: string) {
            const companyName = cleanText(rawCompanyName);
            if (!companyName) return { companyId: undefined };

            const normalizedCompanyName = normalizeCompanyName(companyName);
            const exactBusinessMatch = knownCompanies.find((company) => normalizeCompanyName(company.name) === normalizedCompanyName);
            if (exactBusinessMatch) {
                return { companyId: exactBusinessMatch.id };
            }

            let matchedCompany = knownCompanies.reduce<{ id: string; name: string; cif: string } | null>((best, company) => {
                const score = similarityScore(normalizeCompanyName(company.name), normalizedCompanyName);
                if (score < 0.78) return best;
                if (!best) return company;
                return similarityScore(normalizeCompanyName(best.name), normalizedCompanyName) >= score ? best : company;
            }, null);
            if (!matchedCompany) {
                const bestMatch = findBestExistingValue(companyName, knownCompanies.map((company) => company.name), 0.78);
                if (bestMatch) {
                    matchedCompany = knownCompanies.find((company) => company.name === bestMatch) || null;
                }
            }

            if (matchedCompany) {
                return { companyId: matchedCompany?.id };
            }

            const createdCompany = await createAutoCompany(companyName, options.auditUserId);
            knownCompanies.push(createdCompany);
            return { companyId: createdCompany.id };
        }
    };
}

async function buildExistingFieldResolvers(options: ImportOptions) {
    const whereClause: any = { active: true };
    if (options.forceCompanyId) {
        whereClause.companyId = options.forceCompanyId;
    }

    const [departments, categories] = await Promise.all([
        prisma.employee.findMany({
            where: { ...whereClause, department: { not: null } },
            select: { department: true },
            distinct: ['department']
        }),
        prisma.employee.findMany({
            where: { ...whereClause, category: { not: null } },
            select: { category: true },
            distinct: ['category']
        })
    ]);

    return {
        departmentResolver: createTextValueResolver(departments.map((row) => row.department || ''), 0.8),
        categoryResolver: createTextValueResolver(categories.map((row) => row.category || ''), 0.8)
    };
}

export const EmployeeImportService = {
    previewFile: async (
        buffer: Buffer,
        options: ImportOptions = {},
        providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
    ): Promise<EmployeeImportPreview> => {
        log.info({ bufferSize: buffer.length, options }, 'Preparing employee import preview');

        const parsed = await parseInputFile(buffer);
        const { currentMapping, suggestions } = buildCurrentMapping(parsed, providedMapping);
        const previewRows = buildPreviewRows(parsed.rows, currentMapping);
        const warnings = buildPreviewWarnings(parsed, currentMapping, previewRows, suggestions, options);
        const mappedHeaders = new Set(Object.values(currentMapping));

        return {
            source: parsed.source,
            headers: parsed.headers,
            totalRows: parsed.rows.length,
            availableFields: IMPORT_FIELDS.map((field) => ({
                key: field.key,
                label: field.label,
                group: field.group,
                required: !!field.required,
                description: field.description
            })),
            currentMapping,
            suggestions,
            columns: parsed.headers.map((header) => ({
                header,
                sampleValues: collectSampleValues(parsed.rows, header),
                assignedFieldKey: (Object.entries(currentMapping).find(([, mappedHeader]) => mappedHeader === header)?.[0] as EmployeeImportFieldKey | undefined) || null
            })),
            previewRows,
            warnings,
            unmappedHeaders: parsed.headers.filter((header) => !mappedHeaders.has(header)),
            stats: {
                mappedFields: Object.keys(currentMapping).length,
                unmappedHeaders: parsed.headers.filter((header) => !mappedHeaders.has(header)).length,
                rowsWithWarnings: previewRows.filter((row) => row.warnings.length > 0).length
            }
        };
    },

    processFile: async (
        buffer: Buffer,
        options: ImportOptions = {},
        providedMapping?: Partial<Record<EmployeeImportFieldKey, string>>
    ) => {
        log.info({ bufferSize: buffer.length, options }, 'Starting employee import');

        const parsed = await parseInputFile(buffer);
        const { currentMapping } = buildCurrentMapping(parsed, providedMapping);
        const companyResolver = await buildCompanyResolver(options, currentMapping);
        const { departmentResolver, categoryResolver } = await buildExistingFieldResolvers(options);
        const importYear = new Date().getFullYear();

        let importedCount = 0;
        const errors: string[] = [];
        const processedDnis = new Set<string>();

        const validRows: Array<{ row: Record<string, any>; index: number }> = [];

        for (let index = 0; index < parsed.rows.length; index += 1) {
            const row = parsed.rows[index];
            const rowNumber = index + 2;

            if (!hasMeaningfulRowData(row)) continue;

            const dni = getMappedString(row, currentMapping, 'dni').toUpperCase();
            const fullNameInput = getMappedString(row, currentMapping, 'fullName');
            const firstNameInput = getMappedString(row, currentMapping, 'firstName');
            const lastNameInput = getMappedString(row, currentMapping, 'lastName');
            const fullName = cleanText(fullNameInput || [firstNameInput, lastNameInput].filter(Boolean).join(' '));
            const privateNotes = getMappedString(row, currentMapping, 'privateNotes');

            if (isExampleRow(dni, fullName, privateNotes)) continue;

            if (!dni) {
                errors.push(`Fila ${rowNumber}: falta DNI / NIE.`);
                continue;
            }

            if (processedDnis.has(dni)) {
                errors.push(`Fila ${rowNumber} (${dni}): DNI duplicado dentro del archivo, se omite.`);
                continue;
            }
            processedDnis.add(dni);

            if (!fullName) {
                errors.push(`Fila ${rowNumber}: falta nombre del empleado.`);
                continue;
            }

            validRows.push({ row, index });
        }

        const CHUNK_SIZE = 100;
        for (let chunkStart = 0; chunkStart < validRows.length; chunkStart += CHUNK_SIZE) {
            const chunk = validRows.slice(chunkStart, chunkStart + CHUNK_SIZE);

            try {
                await prisma.$transaction(async (tx) => {
                    for (const { row, index } of chunk) {
                        const rowNumber = index + 2;
                        const dni = getMappedString(row, currentMapping, 'dni').toUpperCase();
                        const fullNameInput = getMappedString(row, currentMapping, 'fullName');
                        const firstNameInput = getMappedString(row, currentMapping, 'firstName');
                        const lastNameInput = getMappedString(row, currentMapping, 'lastName');
                        const fullName = cleanText(fullNameInput || [firstNameInput, lastNameInput].filter(Boolean).join(' '));

                        try {
                            const resolvedCompany = await companyResolver.resolve(getMappedString(row, currentMapping, 'companyName'));
                            const phone = getMappedString(row, currentMapping, 'phone');
                            const companyPhone = getMappedString(row, currentMapping, 'companyPhone');
                            const socialSecurityNumber = getMappedString(row, currentMapping, 'socialSecurityNumber');
                            const iban = getMappedString(row, currentMapping, 'iban');
                            const managerId = getMappedString(row, currentMapping, 'managerId');
                            const annualGrossSalary = parseMoney(getMappedRawValue(row, currentMapping, 'annualGrossSalary'));
                            const monthlyGrossSalary = parseMoney(getMappedRawValue(row, currentMapping, 'monthlyGrossSalary'));
                            const vacationAnnualQuota = parseMoney(getMappedRawValue(row, currentMapping, 'vacationAnnualQuota'));
                            const vacationCarryOver = parseMoney(getMappedRawValue(row, currentMapping, 'vacationCarryOver'));
                            const vacationImportedUsed = parseMoney(getMappedRawValue(row, currentMapping, 'vacationImportedUsed'));
                            const weeklyHours = parseWeeklyHours(getMappedRawValue(row, currentMapping, 'weeklyHours'));
                            const firstName = firstNameInput || fullName;
                            const lastName = lastNameInput || null;
                            const contactName = getMappedString(row, currentMapping, 'emergencyContactName');
                            const contactPhone = getMappedString(row, currentMapping, 'emergencyContactPhone');
                            const contactRelationship = getMappedString(row, currentMapping, 'emergencyContactRelationship');

                            const employeeData: any = {
                                dni,
                                name: fullName,
                                firstName,
                                lastName,
                                email: getMappedString(row, currentMapping, 'email') || null,
                                phone: phone || null,
                                companyPhone: companyPhone || null,
                                address: getMappedString(row, currentMapping, 'address') || null,
                                city: getMappedString(row, currentMapping, 'city') || null,
                                postalCode: getMappedString(row, currentMapping, 'postalCode') || null,
                                province: getMappedString(row, currentMapping, 'province') || null,
                                country: getMappedString(row, currentMapping, 'country') || 'España',
                                subaccount465: getMappedString(row, currentMapping, 'subaccount465') || null,
                                socialSecurityNumber: socialSecurityNumber ? EncryptionService.encrypt(socialSecurityNumber) : null,
                                iban: iban ? EncryptionService.encrypt(iban) : null,
                                gender: normalizeGender(getMappedRawValue(row, currentMapping, 'gender')) ?? undefined,
                                dniExpiration: parseDate(getMappedRawValue(row, currentMapping, 'dniExpiration')),
                                birthDate: parseDate(getMappedRawValue(row, currentMapping, 'birthDate')),
                                entryDate: parseDate(getMappedRawValue(row, currentMapping, 'entryDate')),
                                callDate: parseDate(getMappedRawValue(row, currentMapping, 'callDate')),
                                contractInterruptionDate: parseDate(getMappedRawValue(row, currentMapping, 'contractInterruptionDate')),
                                lowDate: parseDate(getMappedRawValue(row, currentMapping, 'lowDate')),
                                department: departmentResolver.resolve(getMappedString(row, currentMapping, 'department')) || null,
                                category: categoryResolver.resolve(getMappedString(row, currentMapping, 'category')) || null,
                                jobTitle: getMappedString(row, currentMapping, 'jobTitle') || null,
                                contractType: getMappedString(row, currentMapping, 'contractType') || null,
                                agreementType: getMappedString(row, currentMapping, 'agreementType') || null,
                                registeredIn: getMappedString(row, currentMapping, 'registeredIn') || null,
                                lowReason: getMappedString(row, currentMapping, 'lowReason') || null,
                                monthlyGrossSalary,
                                annualGrossSalary,
                                drivingLicense: parseBool(getMappedRawValue(row, currentMapping, 'drivingLicense')) ?? undefined,
                                drivingLicenseType: getMappedString(row, currentMapping, 'drivingLicenseType') || null,
                                drivingLicenseExpiration: parseDate(getMappedRawValue(row, currentMapping, 'drivingLicenseExpiration')),
                                companyId: resolvedCompany.companyId,
                                managerId: managerId && isUuid(managerId) ? managerId : null,
                                workingDayType: normalizeWorkingDayType(getMappedRawValue(row, currentMapping, 'workingDayType')),
                                weeklyHours,
                                privateNotes: getMappedString(row, currentMapping, 'privateNotes') || null,
                                active: true
                            };

                            if (contactName || contactPhone) {
                                (employeeData as any).emergencyContacts = {
                                    create: [{
                                        name: contactName || 'Contacto',
                                        phone: contactPhone || '',
                                        relationship: contactRelationship || null
                                    }]
                                };
                            }

                            const existing = await tx.employee.findUnique({ where: { dni } });

                            if (existing) {
                                await tx.emergencyContact.deleteMany({ where: { employeeId: existing.id } });
                                const { companyId, managerId, ...restData } = employeeData as Record<string, any>;
                                const relationData: Record<string, any> = { ...restData };
                                if (companyId !== undefined) relationData.company = companyId ? { connect: { id: companyId } } : { disconnect: true };
                                if (managerId !== undefined) relationData.manager = managerId ? { connect: { id: managerId } } : { disconnect: true };
                                const updated = await tx.employee.update({
                                    where: { id: existing.id },
                                    data: {
                                        ...relationData,
                                        emergencyContacts: contactName || contactPhone ? {
                                            create: [{
                                                name: contactName || 'Contacto',
                                                phone: contactPhone || '',
                                                relationship: contactRelationship || null
                                            }]
                                        } : undefined
                                    }
                                });
                                await upsertEmployeeVacationBalance(updated, importYear, {
                                    annualQuotaDays: vacationAnnualQuota,
                                    carriedOverDays: vacationCarryOver,
                                    importedUsedDays: vacationImportedUsed
                                }, tx);
                                await tx.auditLog.create({
                                    data: {
                                        action: 'UPDATE',
                                        entity: 'EMPLOYEE',
                                        entityId: existing.id,
                                        metadata: JSON.stringify({ info: 'Import Bulk Update', name: fullName }),
                                        userId: options.auditUserId
                                    }
                                });
                            } else {
                                const created = await tx.employee.create({
                                    data: employeeData
                                });
                                await upsertEmployeeVacationBalance(created, importYear, {
                                    annualQuotaDays: vacationAnnualQuota,
                                    carriedOverDays: vacationCarryOver,
                                    importedUsedDays: vacationImportedUsed
                                }, tx);
                                await tx.auditLog.create({
                                    data: {
                                        action: 'CREATE',
                                        entity: 'EMPLOYEE',
                                        entityId: created.id,
                                        metadata: JSON.stringify({ info: 'Import Bulk Create', name: fullName }),
                                        userId: options.auditUserId
                                    }
                                });
                            }

                            importedCount += 1;
                        } catch (error: any) {
                            const message = error?.message || String(error);
                            log.error({ rowNumber, error: message }, 'Error importing employee row');
                            errors.push(`Fila ${rowNumber} (${dni}): ${message}`);
                            throw error;
                        }
                    }
                }, {
                    maxWait: 30000,
                    timeout: 60000
                });
            } catch (transactionError: any) {
                const msg = transactionError?.message || String(transactionError);
                log.error({ chunkStart, error: msg }, 'Chunk transaction failed, continuing with next chunk');
                errors.push(`Bloque filas ${chunkStart + 2}-${chunkStart + CHUNK_SIZE + 1}: ${msg}`);
            }
        }

        log.info({ importedCount, errorCount: errors.length }, 'Employee import completed');
        return { importedCount, errors };
    }
};
