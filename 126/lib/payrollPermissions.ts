export type PayrollRole = string | null | undefined

export interface PayrollPermissions {
  role: 'front_desk' | 'groomer' | 'bather' | 'manager' | 'owner' | 'admin' | 'unknown'
  canViewPayroll: boolean
  canExportPayroll: boolean
  canManagePayroll: boolean
  canManageSchedules: boolean
  canViewFinance: boolean
  canViewStaffDetails: boolean
}

export function getPayrollPermissions(role: PayrollRole): PayrollPermissions {
  let normalizedRole: PayrollPermissions['role'] = 'unknown'

  if (role === 'staff') {
    normalizedRole = 'front_desk'
  } else if (role === 'front_desk' || role === 'groomer' || role === 'bather' || role === 'manager' || role === 'owner' || role === 'admin') {
    normalizedRole = role
  }
  const canViewPayroll = normalizedRole === 'owner' || normalizedRole === 'admin' || normalizedRole === 'manager'
  const canExportPayroll = canViewPayroll
  const canManagePayroll = normalizedRole === 'owner' || normalizedRole === 'admin'
  const canManageSchedules = canViewPayroll
  const canViewFinance = canViewPayroll
  const canViewStaffDetails = canViewPayroll

  return {
    role: normalizedRole,
    canViewPayroll,
    canExportPayroll,
    canManagePayroll,
    canManageSchedules,
    canViewFinance,
    canViewStaffDetails,
  }
}
