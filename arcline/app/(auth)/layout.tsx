export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-10 block text-center text-xl font-bold tracking-tight">
          arc<span className="text-brand-teal">line</span>
        </a>
        {children}
      </div>
    </div>
  )
}
