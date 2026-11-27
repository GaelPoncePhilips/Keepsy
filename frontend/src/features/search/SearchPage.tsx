import { useState } from 'react'
import { SearchBar } from '../../components/ui/Controls'
import { useIsDesktop, useMediaQuery } from '../../lib/hooks'
import { ExploreGrid } from '../explore/ExplorePage'
import { SearchResults } from './SearchPanel'

export function SearchPage() {
  const [q, setQ] = useState('')
  const desktop = useIsDesktop()
  // El teclado solo se abre solo con mouse/teclado físico; en el celular lo abre el usuario al tocar.
  const puntero = useMediaQuery('(pointer: fine)')
  return (
    <div className="mx-auto w-full max-w-[935px] md:px-4">
      <div className="sticky top-0 z-20 bg-surface px-3 pt-[calc(8px+env(safe-area-inset-top))] pb-2 md:px-0 md:py-4">
        <SearchBar value={q} onChange={setQ} autoFocus={puntero} />
      </div>
      <SearchResults q={q} />
      {desktop && !q.trim() && (
        <div className="pt-4">
          <h2 className="type-title-m emphasized px-4 pb-2">Explorar</h2>
          <ExploreGrid />
        </div>
      )}
    </div>
  )
}
