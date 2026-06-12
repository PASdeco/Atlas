import { useContext } from 'react'
import { AtlasAppContext } from './atlasAppContextBase.js'

export function useAtlasApp() {
  const context = useContext(AtlasAppContext)

  if (!context) {
    throw new Error('useAtlasApp must be used inside AtlasAppProvider.')
  }

  return context
}
