import { AppNav } from './_components/AppNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {children}
      <AppNav />
    </div>
  )
}
