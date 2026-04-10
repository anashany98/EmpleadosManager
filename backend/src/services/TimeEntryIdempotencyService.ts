import { prisma } from '../lib/prisma';

type DedupedBy = 'clientRequestId' | 'timestamp' | null;

export interface CreateIdempotentTimeEntryInput {
    employeeId: string;
    type: string;
    timestamp: Date;
    latitude?: number | null;
    longitude?: number | null;
    location?: string | null;
    device?: string | null;
    clientRequestId?: string | null;
}

export interface CreateIdempotentTimeEntryResult<TEntry> {
    entry: TEntry;
    deduplicated: boolean;
    dedupedBy: DedupedBy;
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
    );
}

async function findByClientRequestId(clientRequestId: string) {
    return prisma.timeEntry.findUnique({
        where: { clientRequestId }
    });
}

async function findByLegacyTimestamp(employeeId: string, timestamp: Date) {
    return prisma.timeEntry.findFirst({
        where: {
            employeeId,
            timestamp
        }
    });
}

export const TimeEntryIdempotencyService = {
    async create(input: CreateIdempotentTimeEntryInput): Promise<CreateIdempotentTimeEntryResult<any>> {
        const normalizedClientRequestId = input.clientRequestId?.trim() || null;

        if (normalizedClientRequestId) {
            const existingByRequest = await findByClientRequestId(normalizedClientRequestId);
            if (existingByRequest) {
                return {
                    entry: existingByRequest,
                    deduplicated: true,
                    dedupedBy: 'clientRequestId'
                };
            }
        } else {
            const existingByTimestamp = await findByLegacyTimestamp(input.employeeId, input.timestamp);
            if (existingByTimestamp) {
                return {
                    entry: existingByTimestamp,
                    deduplicated: true,
                    dedupedBy: 'timestamp'
                };
            }
        }

        try {
            const entry = await prisma.timeEntry.create({
                data: {
                    employeeId: input.employeeId,
                    type: input.type,
                    timestamp: input.timestamp,
                    latitude: input.latitude ?? null,
                    longitude: input.longitude ?? null,
                    location: input.location ?? null,
                    device: input.device ?? null,
                    clientRequestId: normalizedClientRequestId
                }
            });

            return {
                entry,
                deduplicated: false,
                dedupedBy: null
            };
        } catch (error) {
            if (normalizedClientRequestId && isUniqueConstraintError(error) && error.code === 'P2002') {
                const existingByRequest = await findByClientRequestId(normalizedClientRequestId);
                if (existingByRequest) {
                    return {
                        entry: existingByRequest,
                        deduplicated: true,
                        dedupedBy: 'clientRequestId'
                    };
                }
            }

            throw error;
        }
    }
};
