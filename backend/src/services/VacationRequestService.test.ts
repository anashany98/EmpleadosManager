import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { saveVacationAttachment, validateVacationRequest } from './VacationRequestService';
import { StorageService } from './StorageService';

vi.mock('../lib/prisma', () => ({
    prisma: {
        vacation: {
            findFirst: vi.fn(),
            findMany: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        employeeVacationBalance: {
            findUnique: vi.fn(),
            upsert: vi.fn()
        }
    }
}));

vi.mock('./HolidayService', () => ({
    HolidayService: {
        getBusinessDaysCount: vi.fn(() => 5)
    }
}));

vi.mock('./StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn().mockResolvedValue({ key: 'stored/file.pdf' })
    }
}));

vi.mock('./NotificationService', () => ({
    NotificationService: {
        notifyAdmins: vi.fn()
    }
}));

vi.mock('./EmailService', () => ({
    EmailService: {
        sendMail: vi.fn()
    }
}));

describe('VacationRequestService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-1',
            year: 2027,
            annualQuotaDays: 30,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        (prisma.vacation.findMany as any).mockResolvedValue([]);
    });

    it('rejects overlapping requests', async () => {
        (prisma.vacation.findFirst as any).mockResolvedValue({ id: 'vacation-1' });

        await expect(
            validateVacationRequest('emp-1', new Date('2027-03-10'), new Date('2027-03-12'), 'VACATION')
        ).rejects.toMatchObject({ message: expect.stringContaining('solapa') });
    });

    it('rejects vacation requests that exceed the yearly quota', async () => {
        (prisma.vacation.findFirst as any).mockResolvedValue(null);
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-1',
            entryDate: new Date('2025-01-01'),
            createdAt: new Date('2025-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-1',
            year: 2027,
            annualQuotaDays: 5,
            carriedOverDays: 0,
            importedUsedDays: 0
        });
        (prisma.vacation.findMany as any).mockResolvedValue([
            {
                type: 'VACATION',
                startDate: '2027-01-10',
                endDate: '2027-01-16',
                status: 'APPROVED'
            }
        ]);

        await expect(
            validateVacationRequest('emp-1', new Date('2027-03-10'), new Date('2027-03-12'), 'VACATION')
        ).rejects.toMatchObject({ message: expect.stringContaining('Excede cupo') });
    });

    it('accounts for carried days and imported used days when validating vacations', async () => {
        (prisma.vacation.findFirst as any).mockResolvedValue(null);
        (prisma.employee.findUnique as any).mockResolvedValue({
            id: 'emp-1',
            entryDate: new Date('2020-01-01'),
            createdAt: new Date('2020-01-01')
        });
        (prisma.employeeVacationBalance.findUnique as any).mockResolvedValue({
            employeeId: 'emp-1',
            year: 2027,
            annualQuotaDays: 30,
            carriedOverDays: 4,
            importedUsedDays: 26
        });
        (prisma.vacation.findMany as any).mockResolvedValue([
            {
                type: 'VACATION',
                startDate: '2027-02-03',
                endDate: '2027-02-05',
                status: 'APPROVED'
            },
            {
                type: 'VACATION',
                startDate: '2027-04-10',
                endDate: '2027-04-11',
                status: 'PENDING'
            }
        ]);

        await expect(
            validateVacationRequest('emp-1', new Date('2027-06-01'), new Date('2027-06-05'), 'VACATION')
        ).rejects.toMatchObject({ message: expect.stringContaining('Excede cupo') });
    });

    it('stores the vacation attachment under the employee folder', async () => {
        const file = {
            originalname: 'justificante.pdf',
            buffer: Buffer.from('pdf'),
            mimetype: 'application/pdf'
        } as Express.Multer.File;

        const key = await saveVacationAttachment('emp-1', file);

        expect(StorageService.saveBuffer).toHaveBeenCalledWith(expect.objectContaining({
            folder: 'vacations/emp-1',
            originalName: 'justificante.pdf'
        }));
        expect(key).toBe('stored/file.pdf');
    });
});
