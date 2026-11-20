import type { ReactNode } from 'react'
import { BlobBackdrop, GooFilters } from '../../components/ui/Blobs'

/** Marco de las pantallas de auth: fondo surface, centrado, logo + wordmark. */
export function AuthShell({ children, below }: { children: ReactNode; below: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center gap-3 overflow-hidden bg-surface px-4 py-8 text-on-surface">
      <GooFilters />
      <BlobBackdrop />
      <div className="w-full max-w-[350px] rounded-xs border-outline-variant sm:border sm:px-10 sm:pt-8 sm:pb-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/logo.svg" alt="" width={56} height={56} />
          <span className="wordmark text-5xl">keepsy</span>
        </div>
        {children}
      </div>
      <div className="w-full max-w-[350px] rounded-xs border-outline-variant py-5 text-center type-body-m sm:border">{below}</div>
    </main>
  )
}
