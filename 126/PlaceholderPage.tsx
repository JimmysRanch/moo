interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="min-h-full bg-background text-foreground p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-card rounded-lg p-12 border border-border text-center">
          <p className="text-muted-foreground">
            Content for {title.toLowerCase()} will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
