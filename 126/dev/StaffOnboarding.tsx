import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { parseInvitePayload, type InviteSummary } from './staffOnboardingInvite'

export function StaffOnboarding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteId = searchParams.get('invite') || searchParams.get('token') || ''
  const [invite, setInvite] = useState<InviteSummary | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadInvite() {
      setIsLoading(true)
      setInviteError('')
      setInvite(null)

      if (!inviteId) {
        setInviteError('Missing invite id. Please use the link from your invitation email.')
        setIsLoading(false)
        return
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        const response = await fetch(`/api/staff/invite?id=${encodeURIComponent(inviteId)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const responseText = await response.text()
        const contentType = response.headers.get('content-type') || ''
        const isJsonResponse = contentType.toLowerCase().includes('application/json')
        let payload: { message?: string } | null = null

        if (isJsonResponse) {
          try {
            payload = JSON.parse(responseText)
          } catch {
            payload = null
          }
        }

        if (!response.ok) {
          if (!isJsonResponse) {
            setInviteError(`Invite endpoint returned an invalid response (HTTP ${response.status}): ${responseText.slice(0, 300)}`)
            return
          }
          if (response.status === 404) setInviteError(payload?.message || 'Invite not found. Please request a new invitation.')
          else if (response.status === 410) setInviteError(payload?.message || 'This invite has expired.')
          else if (response.status === 409) setInviteError(payload?.message || 'This invite has already been accepted.')
          else setInviteError(payload?.message || 'Unable to load your invitation right now.')
          return
        }

        if (!isJsonResponse || !payload) {
          setInviteError(`Invite endpoint returned an invalid response (HTTP ${response.status}): ${responseText.slice(0, 300)}`)
          return
        }

        const parsedInvite = parseInvitePayload(payload)
        setInvite(parsedInvite)
      } catch (error) {
        console.error('Failed to load staff invite', error)
        setInviteError('Unable to load invite. Please request a new invite.')
      } finally {
        setIsLoading(false)
      }
    }

    loadInvite()
  }, [inviteId])

  return (
    <div className="h-screen w-full text-foreground relative overflow-hidden bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.35),transparent_60%),radial-gradient(circle_at_50%_110%,rgba(56,189,248,0.55),transparent_70%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(2,6,23,0.98))] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-950/60" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/settings')}
        className="fixed top-4 right-4 z-50 bg-card/80 backdrop-blur-sm border border-border text-xs"
      >
        <ArrowLeft size={14} className="mr-1" />
        Back to App
      </Button>

      <div className="relative z-10 h-full w-full flex items-center justify-center px-4">
        <Card className="w-full max-w-xl rounded-[26px] p-8 text-center bg-slate-900/80 border-sky-200/30 text-white">
          {isLoading && <p className="text-slate-200">Loading invite...</p>}

          {!isLoading && inviteError && (
            <>
              <h1 className="text-2xl font-semibold mb-2">Unable to continue onboarding</h1>
              <p className="text-sm text-slate-200 mb-6">{inviteError}</p>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  Back to App
                </Button>
              </div>
            </>
          )}

          {!isLoading && invite && !inviteError && (
            <>
              <h1 className="text-2xl font-semibold mb-2">Welcome! You&apos;re invited to join the team.</h1>
              <p className="text-sm text-slate-200 mb-1">Email: {invite.email}</p>
              <p className="text-sm text-slate-200 mb-6">Role: {invite.role}</p>
              <Button
                onClick={() => navigate(`/onboarding/staff/profile?invite=${encodeURIComponent(invite.id)}`)}
                className="w-full"
              >
                Continue to Profile Setup
              </Button>
            </>
          )}

          {!isLoading && !invite && !inviteError && (
            <>
              <h1 className="text-2xl font-semibold mb-2">Unable to continue onboarding</h1>
              <p className="text-sm text-slate-200">Unable to load invite. Please request a new invite.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
