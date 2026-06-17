import { PrivyProvider } from '@privy-io/react-auth'
import App from '../App.jsx'
import { BootErrorBoundary } from './BootErrorBoundary.jsx'
import { AtlasAppProvider, AtlasDemoAppProvider } from '../lib/atlasAppContext.jsx'
import { privyConfig } from '../lib/privyConfig.js'

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim() || ''
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID?.trim() || ''
const hasPrivyAppId = Boolean(privyAppId)
const missingPrivyMessage =
  'Privy is not configured yet. Atlas loaded in read-only mode.'

export function AtlasRoot() {
  if (!hasPrivyAppId) {
    return (
      <AtlasDemoAppProvider initialStatusMessage={missingPrivyMessage}>
        <App />
      </AtlasDemoAppProvider>
    )
  }

  return (
    <BootErrorBoundary
      fallback={(error) => (
        <AtlasDemoAppProvider
          initialStatusMessage="Atlas recovered into read-only mode after a startup auth error."
          initialError={error?.message || 'Atlas could not initialize Privy with the current config.'}
        >
          <App />
        </AtlasDemoAppProvider>
      )}
    >
      <PrivyProvider appId={privyAppId} clientId={privyClientId || undefined} config={privyConfig}>
        <AtlasAppProvider>
          <App />
        </AtlasAppProvider>
      </PrivyProvider>
    </BootErrorBoundary>
  )
}
