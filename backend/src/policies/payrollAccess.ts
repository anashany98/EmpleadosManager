import { AccessTarget, canAccessPolicy } from '../../../shared/authz';
import { AuthUser } from '../types/express';

export interface PayrollTargetLike {
    employeeId: string;
    companyId?: string | null;
}

export function buildPayrollAccessTarget(target: PayrollTargetLike): AccessTarget {
    return {
        employeeId: target.employeeId,
        companyId: target.companyId || null
    };
}

export function canReadPayroll(user: AuthUser, target: PayrollTargetLike): boolean {
    return canAccessPolicy('payroll.read', user, buildPayrollAccessTarget(target));
}

export function canManagePayroll(user: AuthUser, target: PayrollTargetLike): boolean {
    return canAccessPolicy('payroll.manage', user, buildPayrollAccessTarget(target));
}
