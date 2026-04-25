import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, Envelope, MapPin, User } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageLoadingState } from "@/components/PageLoadingState"
import { useClient } from '@/hooks/data/useClients'
import { clientFromDb } from '@/lib/mappers/clientMapper'

export function ContactInfo() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { data: dbClient, isPending: isClientLoading } = useClient(clientId)
  const client = useMemo(() => dbClient ? clientFromDb(dbClient) : undefined, [dbClient])
  const contactInfo = {
    name: client?.name ?? "Client",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: {
      street: client?.address?.street ?? "",
      city: client?.address?.city ?? "",
      state: client?.address?.state ?? "",
      zipCode: client?.address?.zip ?? ""
    }
  }

  if (isClientLoading) {
    return <PageLoadingState label="Loading client contact info…" />
  }

  if (!client) {
    return (
      <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
        <div className="max-w-[800px] mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200 mb-4"
            onClick={() => navigate(`/clients/${clientId}`)}
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Client Not Found</h1>
            <p className="text-muted-foreground">The client you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[800px] mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200"
            onClick={() => navigate(`/clients/${clientId}`)}
          >
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <User size={28} className="text-primary" weight="fill" />
              Contact Information
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{contactInfo.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Phone size={24} className="text-primary" weight="fill" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Phone Number
                </h3>
                <p className="text-2xl font-bold">{contactInfo.phone || "Not provided"}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    onClick={() => contactInfo.phone && (window.location.href = `tel:${contactInfo.phone}`)}
                    disabled={!contactInfo.phone}
                  >
                    <Phone size={16} className="mr-2" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="font-semibold"
                    onClick={() => navigate(`/messages?clientId=${clientId}`)}
                    disabled={!contactInfo.phone}
                  >
                    Open Conversation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-semibold"
                    onClick={() => contactInfo.phone && (window.location.href = `sms:${contactInfo.phone}`)}
                    disabled={!contactInfo.phone}
                  >
                    Text via Device
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Envelope size={24} className="text-primary" weight="fill" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Email Address
                </h3>
                <p className="text-2xl font-bold break-all">{contactInfo.email || "Not provided"}</p>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-3"
                  onClick={() => contactInfo.email && (window.location.href = `mailto:${contactInfo.email}`)}
                  disabled={!contactInfo.email}
                >
                  <Envelope size={16} className="mr-2" />
                  Send Email
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <MapPin size={24} className="text-primary" weight="fill" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Physical Address
                </h3>
                <div className="text-lg font-semibold space-y-1">
                  <p>{contactInfo.address.street || "Not provided"}</p>
                  <p>
                    {[contactInfo.address.city, contactInfo.address.state, contactInfo.address.zipCode]
                      .filter(Boolean)
                      .join(", ") || "Not provided"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-3"
                  onClick={() => {
                    if (!contactInfo.address.street && !contactInfo.address.city && !contactInfo.address.state && !contactInfo.address.zipCode) {
                      return
                    }
                    const addressString = `${contactInfo.address.street}, ${contactInfo.address.city}, ${contactInfo.address.state} ${contactInfo.address.zipCode}`
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(addressString)}`, '_blank')
                  }}
                  disabled={!contactInfo.address.street && !contactInfo.address.city && !contactInfo.address.state && !contactInfo.address.zipCode}
                >
                  <MapPin size={16} className="mr-2" />
                  Open in Maps
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
