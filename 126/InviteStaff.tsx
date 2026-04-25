import { Navigate } from 'react-router-dom'

export function InviteStaff() {
  return <div data-testid="page-invite-staff"><Navigate to="/staff/new" replace /></div>
}
