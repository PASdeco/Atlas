import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  BanknoteArrowUp,
  Bell,
  BrainCircuit,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  FileText,
  FileUp,
  Fingerprint,
  Gavel,
  History,
  House,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPinned,
  Menu,
  MoveRight,
  PieChart,
  Plane,
  Receipt,
  ScanSearch,
  Settings,
  Shield,
  ShieldCheck,
  UploadCloud,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import heroJoy from './assets/atlas/hero-joy.jpg'
import { useAtlasApp } from './lib/useAtlasApp.js'

const wholeNumberFormatter = new Intl.NumberFormat('en-US')
const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const preciseMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const MAX_CLAIM_AMOUNT_USDC = 10

const marketingNavItems = [
  { label: 'Coverage', href: '#coverage' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pool Stats', href: '#pool-stats-home' },
  { label: 'Pricing', href: '#pricing-preview' },
  { label: 'FAQ', href: '#faq' },
]

const coverageCards = [
  {
    icon: Car,
    title: 'Mobility & Auto',
    description:
      'Collision, theft, delayed roadside assistance, and rental interruption resolved in minutes.',
  },
  {
    icon: House,
    title: 'Housing & Living',
    description:
      'Protect deposits, appliances, burst pipes, and surprise repair costs with instant liquidity.',
  },
  {
    icon: Plane,
    title: 'Travel & Luggage',
    description:
      'Missed baggage, delayed flights, and trip disruption protection without call-center loops.',
  },
  {
    icon: MapPinned,
    title: 'Tourism & Experiences',
    description:
      'Events, bookings, and experience refunds when plans break before the memory is ruined.',
  },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Connect & Cover',
    description: 'Deposit your premium in USDC and activate protection in one wallet signature.',
    icon: Wallet,
  },
  {
    step: '02',
    title: 'Something Goes Wrong',
    description: 'File the incident, add evidence, and let Atlas route it instantly.',
    icon: FileUp,
  },
  {
    step: '03',
    title: 'AI Jury Deliberates',
    description: 'Specialized agents evaluate the proof set, policy terms, and pool health.',
    icon: BrainCircuit,
  },
  {
    step: '04',
    title: 'Instant Payout',
    description: 'USDC lands in your wallet before the moment turns into a week-long problem.',
    icon: BanknoteArrowUp,
  },
]

const whyAtlas = [
  {
    icon: Fingerprint,
    title: 'No Human Adjusters',
    description: 'Claims are evaluated by policy-aware AI agents with consistent logic every time.',
  },
  {
    icon: CreditCard,
    title: 'No Volatile Tokens',
    description: 'Coverage, fees, and payouts are all denominated in USDC for clarity and calm.',
  },
  {
    icon: Gavel,
    title: 'No Corporate Greed',
    description: 'A transparent community pool makes incentives visible, auditable, and fair.',
  },
]

const homeStats = [
  {
    label: 'Total Pool Size',
    value: 2847392,
    formatter: (value) => moneyFormatter.format(value),
  },
  {
    label: 'Claims Paid This Month',
    value: 1284,
    formatter: (value) => wholeNumberFormatter.format(value),
  },
  {
    label: 'Average Payout Time',
    value: 47,
    formatter: (value) => `${Math.round(value)} seconds`,
  },
  {
    label: 'Active Members',
    value: 9431,
    formatter: (value) => wholeNumberFormatter.format(value),
  },
]

const faqItems = [
  {
    question: 'What is Atlas?',
    answer:
      'Atlas is a decentralized community protection protocol that uses AI agents to assess claims and release USDC payouts quickly.',
  },
  {
    question: 'How does the AI jury work?',
    answer:
      'Atlas routes evidence through specialized agents that check policy terms, incident data, uploaded proof, and pool constraints before a verdict is signed.',
  },
  {
    question: 'What currencies does Atlas accept?',
    answer:
      'The protocol is USDC-first so premiums, reserves, and payouts stay stable and easy to understand.',
  },
  {
    question: 'Do I need a crypto wallet to use Atlas?',
    answer:
      'A wallet unlocks the full on-chain experience, but Atlas can onboard new members with a guided wallet flow and card payments.',
  },
  {
    question: 'How fast are payouts processed?',
    answer:
      'Simple claims can settle in under a minute, with Atlas targeting an average payout time of 47 seconds for clean evidence sets.',
  },
  {
    question: 'What happens if my claim is rejected?',
    answer:
      'Atlas returns a detailed explanation, highlights missing evidence, and records the verdict transparently so the member can appeal or refile.',
  },
  {
    question: 'How is the community pool funded?',
    answer:
      'Premium deposits, reserve yield strategies, and protocol fees replenish the pool while preserving a visible reserve buffer.',
  },
  {
    question: 'What is Atlas protocol fee used for.',
    answer:
      'The fee supports claim verification infrastructure, reserve growth, fraud prevention, and product operations.',
  },
  {
    question: 'Is my money safe in the pool?',
    answer:
      'Pool balances are visible on-chain, reserve buffers are tracked in real time, and Atlas keeps a conservative liquidity layer for payouts.',
  },
  {
    question: 'What coverage categories does Atlas support?',
    answer:
      'Atlas currently focuses on mobility, housing, travel, and experiences, with modular policy packs for each vertical.',
  },
]

const claimActivity = [
  { day: 'Mon', approved: 12, pending: 3 },
  { day: 'Tue', approved: 19, pending: 5 },
  { day: 'Wed', approved: 16, pending: 4 },
  { day: 'Thu', approved: 23, pending: 6 },
  { day: 'Fri', approved: 21, pending: 4 },
  { day: 'Sat', approved: 18, pending: 2 },
  { day: 'Sun', approved: 25, pending: 5 },
]

const recentClaims = [
  {
    type: 'Airport baggage delay',
    amount: '$120',
    date: 'Today',
    status: 'Approved',
  },
  {
    type: 'Auto glass replacement',
    amount: '$365',
    date: 'Yesterday',
    status: 'Pending',
  },
  {
    type: 'Concert cancellation',
    amount: '$95',
    date: '2 days ago',
    status: 'Rejected',
  },
]

const pricingPlans = [
  {
    title: 'Mobility & Auto',
    monthly: 49,
    annual: 529,
    payout: '$25,000',
    accent: 'accent',
    active: true,
    bullets: [
      'Roadside recovery',
      'Collision support',
      'Rental interruption',
      'Theft response payout',
    ],
  },
  {
    title: 'Housing & Living',
    monthly: 59,
    annual: 639,
    payout: '$35,000',
    accent: 'soft',
    active: false,
    bullets: [
      'Appliance failure',
      'Water damage',
      'Deposit protection',
      'Emergency repair support',
    ],
  },
  {
    title: 'Travel & Luggage',
    monthly: 29,
    annual: 309,
    payout: '$12,000',
    accent: 'plain',
    active: false,
    bullets: [
      'Lost baggage',
      'Trip delay',
      'Medical interruption',
      'Missed booking recovery',
    ],
  },
  {
    title: 'Experiences',
    monthly: 19,
    annual: 199,
    payout: '$8,500',
    accent: 'dark',
    active: false,
    bullets: [
      'Event cancellations',
      'Venue closures',
      'Host no-shows',
      'Weather disruption',
    ],
  },
]

const poolComposition = [
  { name: 'Immediate payouts', value: 38, color: '#c3ea8d' },
  { name: 'Reserve buffer', value: 27, color: '#2a7876' },
  { name: 'Reinsurance vault', value: 21, color: '#163c3d' },
  { name: 'Protocol revenue', value: 14, color: '#eff4ef' },
]

const reserveFlow = [
  { month: 'Jan', pool: 2.1, reserve: 1.2, payouts: 0.46 },
  { month: 'Feb', pool: 2.24, reserve: 1.28, payouts: 0.51 },
  { month: 'Mar', pool: 2.36, reserve: 1.34, payouts: 0.58 },
  { month: 'Apr', pool: 2.52, reserve: 1.4, payouts: 0.63 },
  { month: 'May', pool: 2.67, reserve: 1.47, payouts: 0.68 },
  { month: 'Jun', pool: 2.84, reserve: 1.59, payouts: 0.72 },
]

const shellNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'My Coverage', icon: ShieldCheck, to: '/plans' },
  { label: 'File a Claim', icon: Receipt, to: '/claim' },
  { label: 'Claim History', icon: History, to: '/dashboard#recent-claims' },
  { label: 'Pool Stats', icon: PieChart, to: '/pool-stats' },
  { label: 'Settings', icon: Settings, to: '/dashboard#settings-panel' },
]

const claimCategories = [
  { title: 'Auto', icon: Car },
  { title: 'Housing', icon: House },
  { title: 'Travel', icon: Plane },
  { title: 'Experience', icon: MapPinned },
]

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<PortalShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/claim" element={<ClaimPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/pool-stats" element={<PoolStatsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1)
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.hash, location.pathname])

  return null
}

function LandingPage() {
  return (
    <motion.div
      className="landing-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <MarketingNav />
      <main>
        <HeroSection />
        <SocialProofBar />
        <CoverageSection />
        <HowItWorksSection />
        <WhyAtlasSection />
        <PoolStatsSection />
        <PricingPreviewSection />
        <FaqSection />
        <CtaBanner />
      </main>
      <SiteFooter />
    </motion.div>
  )
}

function SignInMenu({ compact = false, fullWidth = false, tone = 'secondary', onBeforeAction }) {
  const { loginWithGoogle, loginWithWallet } = useAtlasApp()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleAction = (action) => {
    setOpen(false)
    onBeforeAction?.()
    action()
  }

  return (
    <div ref={menuRef} className={`auth-menu ${fullWidth ? 'full-width' : ''}`}>
      <button
        type="button"
        className={`atlas-button ${tone} ${compact ? 'compact' : ''} auth-menu-trigger ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Sign in
        <ChevronDown size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="auth-menu-panel"
            role="menu"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="auth-menu-label">Choose how you want to sign in.</p>
            <button
              type="button"
              className="auth-menu-option"
              role="menuitem"
              onClick={() => handleAction(loginWithWallet)}
            >
              <span className="auth-menu-icon">
                <Wallet size={18} />
              </span>
              <span className="auth-menu-copy">
                <strong>Connect with Wallet</strong>
                <span>Use WalletConnect or your browser wallet.</span>
              </span>
            </button>
            <button
              type="button"
              className="auth-menu-option"
              role="menuitem"
              onClick={() => handleAction(loginWithGoogle)}
            >
              <span className="auth-menu-icon accent">
                <Mail size={18} />
              </span>
              <span className="auth-menu-copy">
                <strong>Sign in with Gmail</strong>
                <span>Create your Atlas access in seconds.</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AccountMenu({
  walletAddress,
  walletDisplay,
  onLogout,
  onExportWallet,
  fullWidth = false,
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => {
      setCopied(false)
    }, 1800)

    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopy = async () => {
    if (!walletAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div ref={menuRef} className={`auth-menu account-menu ${fullWidth ? 'full-width' : ''}`}>
      <button
        type="button"
        className={`wallet-pill account-menu-trigger ${compact ? 'compact' : ''} ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{walletDisplay}</span>
        <ChevronDown size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="auth-menu-panel account-menu-panel"
            role="menu"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="account-menu-summary">
              <strong>{walletDisplay}</strong>
              <span>{walletAddress || 'Wallet unavailable'}</span>
            </div>

            <button type="button" className="auth-menu-option" role="menuitem" onClick={handleCopy}>
              <span className="auth-menu-icon">
                <Copy size={18} />
              </span>
              <span className="auth-menu-copy">
                <strong>{copied ? 'Wallet copied' : 'Copy wallet address'}</strong>
                <span>{copied ? 'Address copied to clipboard.' : 'Copy your Atlas wallet address.'}</span>
              </span>
            </button>

            {onExportWallet ? (
              <button
                type="button"
                className="auth-menu-option"
                role="menuitem"
                onClick={async () => {
                  setOpen(false)
                  await onExportWallet()
                }}
              >
                <span className="auth-menu-icon">
                  <MoveRight size={18} />
                </span>
                <span className="auth-menu-copy">
                  <strong>Export embedded wallet</strong>
                  <span>Move this Atlas wallet into MetaMask, Rabby, or another wallet you control.</span>
                </span>
              </button>
            ) : null}

            <button
              type="button"
              className="auth-menu-option"
              role="menuitem"
              onClick={async () => {
                setOpen(false)
                await onLogout()
              }}
            >
              <span className="auth-menu-icon">
                <LogOut size={18} />
              </span>
              <span className="auth-menu-copy">
                <strong>Disconnect wallet</strong>
                <span>Sign out of Atlas on this device.</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MarketingNav() {
  const { authenticated, exportEmbeddedWallet, logout, overview, walletAddress } = useAtlasApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > 18 : false,
  )

  const walletDisplay = overview?.member?.walletDisplay || shortenWallet(walletAddress)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 18)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header className={`marketing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-shell">
          <Link className="brand" to="/">
            <LogoMark />
            <span>Atlas</span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {marketingNavItems.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            {authenticated ? (
              <AccountMenu
                walletAddress={walletAddress}
                walletDisplay={walletDisplay}
                onExportWallet={exportEmbeddedWallet}
                onLogout={logout}
                compact
              />
            ) : (
              <SignInMenu compact />
            )}
            <Link className="atlas-button primary compact" to={authenticated ? '/dashboard' : '/plans'}>
              {authenticated ? 'Open Atlas' : 'Get Started'}
            </Link>
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              className="mobile-menu-panel"
              initial={{ x: 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 28, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-menu-top">
                <Link className="brand" to="/">
                  <LogoMark />
                  <span>Atlas</span>
                </Link>
                <button
                  type="button"
                  className="mobile-menu-button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mobile-menu-links">
                {marketingNavItems.map((item) => (
                  <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mobile-menu-actions">
                {authenticated ? (
                  <AccountMenu
                    walletAddress={walletAddress}
                    walletDisplay={walletDisplay}
                    onLogout={async () => {
                      setMenuOpen(false)
                      await logout()
                    }}
                    fullWidth
                  />
                ) : (
                  <SignInMenu fullWidth onBeforeAction={() => setMenuOpen(false)} />
                )}
                <Link
                  className="atlas-button primary"
                  to={authenticated ? '/dashboard' : '/plans'}
                  onClick={() => setMenuOpen(false)}
                >
                  {authenticated ? 'Open Atlas' : 'Get Started'}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-backdrop">
        <div className="hero-grid">
          <Reveal className="hero-copy">
            <h1>Claims settled in seconds. Not weeks.</h1>
            <p className="hero-subcopy">
              Atlas protects your car, home, travel, and experiences. No adjusters. No
              paperwork. Just instant USDC payouts powered by AI.
            </p>
            <div className="hero-actions">
              <Link className="atlas-button primary" to="/plans">
                Start Your Coverage
              </Link>
              <a className="atlas-button ghost" href="#how-it-works">
                See How It Works
              </a>
            </div>
            <div className="hero-microstats">
              <div>
                <strong>47 sec</strong>
                <span>avg payout time</span>
              </div>
              <div>
                <strong>9,431</strong>
                <span>active members</span>
              </div>
              <div>
                <strong>USDC</strong>
                <span>stable payouts only</span>
              </div>
            </div>
          </Reveal>

          <Reveal className="hero-visual" delay={0.12}>
            <div className="hero-image-card">
              <img src={heroJoy} alt="Atlas member reacting with relief after a payout arrives" />
              <div className="hero-image-overlay" aria-hidden="true" />
              <div className="hero-floating-badge top">
                <BadgeCheck size={18} />
                Claim approved in 42 seconds
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function SocialProofBar() {
  return (
    <section className="social-proof-bar">
      <div className="social-proof-inner">
        <span>Powered by Arc Network</span>
        <span>Secured by GenLayer</span>
        <span>Built for humans</span>
        <span>Community-governed reserves</span>
      </div>
    </section>
  )
}

function CoverageSection() {
  return (
    <section id="coverage" className="section">
      <SectionHeading
        eyebrow="Coverage"
        title="One protocol. Every corner of your life."
        description="Atlas packages consumer protection into flexible policy lanes that feel modern, calm, and immediate."
      />
      <div className="coverage-grid">
        {coverageCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Reveal key={card.title} delay={index * 0.08}>
              <article className="coverage-card">
                <div className="icon-bubble">
                  <Icon size={22} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <Link className="inline-link" to="/plans">
                  Learn More
                  <MoveRight size={16} />
                </Link>
              </article>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section how-it-works">
      <SectionHeading
        eyebrow="How It Works"
        title="From incident to payout. In minutes."
        description="Atlas compresses the traditional claims process into a clean evidence path and a machine-speed verdict."
      />

      <motion.div
        className="timeline-rail"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="timeline-grid">
        {workflowSteps.map((item, index) => {
          const Icon = item.icon
          return (
            <Reveal key={item.step} delay={index * 0.08}>
              <article className="timeline-card">
                <span className="timeline-step">{item.step}</span>
                <div className="icon-bubble">
                  <Icon size={22} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            </Reveal>
          )
        })}
      </div>

    </section>
  )
}

function WhyAtlasSection() {
  return (
    <section className="section why-atlas-section">
      <SectionHeading
        eyebrow="Why Atlas"
        title="Insurance finally built for you, not against you."
        description="Every layer is designed to lower friction while preserving trust, transparency, and stable value."
      />

      <div className="benefit-grid">
        {whyAtlas.map((item, index) => {
          const Icon = item.icon
          return (
            <Reveal key={item.title} delay={index * 0.08}>
              <article className="benefit-card">
                <div className="icon-bubble soft">
                  <Icon size={22} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

function PoolStatsSection() {
  return (
    <section id="pool-stats-home" className="section section-contrast">
      <SectionHeading
        eyebrow="Community Pool Stats"
        title="Live reserves. Measurable trust."
        description="Atlas makes the state of the pool legible at a glance so members know protection is funded and ready."
        inverse
      />

      <div className="stats-grid">
        {homeStats.map((item, index) => (
          <Reveal key={item.label} className="grid-stretch" delay={index * 0.08}>
            <article className="stat-panel">
              <span>{item.label}</span>
              <AnimatedCounter value={item.value} formatter={item.formatter} />
            </article>
          </Reveal>
        ))}
      </div>

      <div className="section-actions">
        <Link className="atlas-button accent" to="/pool-stats">
          Open Full Pool Dashboard
        </Link>
      </div>
    </section>
  )
}

function PricingPreviewSection() {
  return (
    <section id="pricing-preview" className="section">
      <SectionHeading
        eyebrow="Pricing"
        title="Protection plans sized for real life."
        description="Start with one vertical or stack policies across the moments that matter most."
      />
      <div className="pricing-preview-grid">
        {pricingPlans.slice(0, 3).map((plan, index) => (
          <Reveal key={plan.title} className="grid-stretch" delay={index * 0.08}>
            <article className={`pricing-preview-card ${plan.accent}`}>
              <div className="pricing-preview-top">
                <h3>{plan.title}</h3>
                <span className={`active-badge ${plan.active ? '' : 'hidden'}`}>
                  Active plan
                </span>
              </div>
              <strong className="pricing-preview-price">
                {moneyFormatter.format(plan.monthly)} / month
              </strong>
              <p className="pricing-preview-payout">Max payout {plan.payout}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function FaqSection() {
  const [openItem, setOpenItem] = useState(faqItems[0].question)

  return (
    <section id="faq" className="section faq-section">
      <SectionHeading
        eyebrow="FAQ"
        title="Everything you need to know."
        description="Clear answers for how Atlas works, how funds move, and what members can expect."
      />

      <div className="faq-list">
        {faqItems.map((item) => {
          const open = openItem === item.question
          return (
            <article key={item.question} className={`faq-item ${open ? 'is-open' : ''}`}>
              <button
                type="button"
                className="faq-trigger"
                onClick={() => setOpenItem(open ? null : item.question)}
              >
                <span>{item.question}</span>
                <ChevronDown size={18} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    className="faq-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p>{item.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function CtaBanner() {
  return (
    <section className="section">
      <div className="cta-banner">
        <div>
          <span className="eyebrow muted">Move before the moment does</span>
          <h2>Your next incident is already on its way. Are you covered?</h2>
        </div>
        <Link className="atlas-button accent" to="/plans">
          Get Protected Now
        </Link>
      </div>
    </section>
  )
}

function SiteFooter() {
  const footerColumns = [
    {
      title: 'Product',
      links: ['Coverage Plans', 'How It Works', 'Pool Stats', 'File a Claim', 'Pricing'],
    },
    {
      title: 'Company',
      links: ['About Atlas', 'Careers', 'Press Kit', 'Blog', 'Contact Us'],
    },
    {
      title: 'Legal & Support',
      links: [
        'Terms of Service',
        'Privacy Policy',
        'Cookie Policy',
        'Claims Policy',
        'Support Center',
      ],
    },
  ]

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <LogoMark />
            <span>Atlas</span>
          </Link>
          <p>Instant community protection for the moments life refuses to schedule.</p>
        </div>

        {footerColumns.map((column) => (
          <div key={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link}>{link}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        (c) 2025 Atlas Protocol. All rights reserved. Built on Arc Network and GenLayer.
        Atlas is a decentralized community protection protocol, not a traditional insurance
        company.
      </div>
    </footer>
  )
}

function PortalShell() {
  const { authenticated, exportEmbeddedWallet, logout, memberLabel, overview, walletAddress } = useAtlasApp()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const walletDisplay = overview?.member?.walletDisplay || shortenWallet(walletAddress)

  const sidebar = (
    <PortalSidebarContent
      authenticated={authenticated}
      location={location}
      onLogout={logout}
      onNavigate={() => setMenuOpen(false)}
    />
  )

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar portal-sidebar-desktop">{sidebar}</aside>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="portal-mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.aside
              className="portal-sidebar portal-mobile-panel"
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ duration: 0.24 }}
              onClick={(event) => event.stopPropagation()}
            >
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="portal-main">
        <div className="portal-topbar">
          <div>
            <span className="eyebrow muted">Atlas Protocol</span>
            <h2>{authenticated ? `Welcome back, ${memberLabel}` : 'Welcome to Atlas'}</h2>
          </div>
          <div className="topbar-meta">
            <button
              type="button"
              className="portal-mobile-menu-button"
              aria-label="Open dashboard menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <button type="button" className="icon-action" aria-label="Notifications">
              <Bell size={18} />
            </button>
            {authenticated ? (
              <AccountMenu
                walletAddress={walletAddress}
                walletDisplay={walletDisplay}
                onExportWallet={exportEmbeddedWallet}
                onLogout={logout}
                compact
              />
            ) : (
              <SignInMenu compact />
            )}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

function DashboardPage() {
  const { authenticated, overview, statusMessage, lastError } = useAtlasApp()
  const premiumDetail = overview.member.isCoverageActive
    ? overview.member.renewsInDays > 0
      ? `Renews in ${overview.member.renewsInDays} day${overview.member.renewsInDays === 1 ? '' : 's'}`
      : 'Coverage active'
    : 'No active premium yet'

  const liveStats = [
    {
      label: 'Pool Balance',
      value: moneyFormatter.format(overview.pool.poolSizeUsdc),
      detail: `Reserve coverage ${overview.pool.reserveCoverageRatio}%`,
      variant: 'accent',
    },
    {
      label: 'Your Monthly Premium',
      value: preciseMoneyFormatter.format(overview.member.monthlyPremiumUsdc),
      detail: premiumDetail,
      variant: 'soft',
    },
    {
      label: 'Active Claims',
      value: String(overview.member.activeClaims).padStart(2, '0'),
      detail: `${overview.member.approvedClaims} approved / ${overview.member.pendingClaims} pending`,
      variant: 'plain',
    },
    {
      label: 'Total Paid To You',
      value: moneyFormatter.format(overview.member.totalPaidToYouUsdc),
      detail: `Payout wallet ${overview.member.walletDisplay || 'pending'}`,
      variant: 'dark',
    },
  ]

  const liveClaims =
    Array.isArray(overview.recentClaims) && overview.recentClaims.length > 0
      ? overview.recentClaims
      : recentClaims

  return (
    <motion.main
      className="portal-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PageHero
        title="Protection at a glance"
        description="Monitor your coverage, watch the pool, and see how Atlas is performing in real time."
        action={authenticated ? { label: 'File a Claim', to: '/claim' } : null}
      />
      <StatusBanner message={statusMessage} error={lastError} />

      <section className="dashboard-stats-grid">
        {liveStats.map((item) => (
          <article key={item.label} className={`dashboard-stat-card ${item.variant}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-content-grid">
        <article className="glass-panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">7-day activity</span>
              <h3>Claim throughput</h3>
            </div>
            <span className="status-pill good">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={claimActivity} barGap={8}>
              <CartesianGrid stroke="rgba(22, 60, 61, 0.08)" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(195, 234, 141, 0.16)' }} />
              <Bar dataKey="approved" fill="#2a7876" radius={[10, 10, 0, 0]} />
              <Bar dataKey="pending" fill="#c3ea8d" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-panel signal-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">AI Jury</span>
              <h3>Verdict quality</h3>
            </div>
            <BrainCircuit size={20} />
          </div>
          <div className="signal-stack">
            <SignalRow
              label="Evidence confidence"
              value={`${overview.signal.evidenceConfidence}%`}
              tone="good"
            />
            <SignalRow
              label="Average deliberation"
              value={`${overview.signal.averageDeliberationSeconds} sec`}
              tone="accent"
            />
            <SignalRow
              label="Fraud alerts"
              value={String(overview.signal.fraudAlerts).padStart(2, '0')}
              tone="warn"
            />
          </div>
          <div className="signal-callout">
            <ShieldCheck size={20} />
            {`Atlas is holding ${moneyFormatter.format(
              overview.pool.reserveBufferUsdc,
            )} in reserve while verdicts average under a minute.`}
          </div>
        </article>
      </section>

      <section id="recent-claims" className="dashboard-content-grid claims-layout">
        <article className="glass-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">Recent claims</span>
              <h3>Claims feed</h3>
            </div>
            <Link className="inline-link" to="/claim">
              New claim
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="claim-list">
            {liveClaims.map((claim) => (
              <div key={`${claim.type}-${claim.date}-${claim.id || ''}`} className="claim-list-item">
                <div>
                  <strong>{claim.type}</strong>
                  <span>{claim.date || `Claim #${claim.id}`}</span>
                </div>
                <div className="claim-list-meta">
                  <strong>{claim.amount}</strong>
                  <span className={`status-pill ${claim.status.toLowerCase()}`}>{claim.status}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article id="settings-panel" className="glass-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">Quick controls</span>
              <h3>Settings</h3>
            </div>
            <Settings size={20} />
          </div>
          <div className="settings-list">
            <SettingCard
              icon={Wallet}
              title="Payout wallet"
              description={`USDC payouts route to ${overview.member.payoutWallet}.`}
            />
            <SettingCard
              icon={MoveRight}
              title="Wallet export"
              description="Gmail and embedded-wallet members can export their Atlas wallet into a personal wallet for self-custody or onward transfers."
            />
            <SettingCard
              icon={CalendarClock}
              title="Renewal cadence"
              description={
                overview.member.isCoverageActive
                  ? `Coverage renews every 30 days and is currently active until ${
                      overview.member.coverageExpiresAt
                        ? new Date(overview.member.coverageExpiresAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'the next cycle'
                    }.`
                  : 'No active premium yet. Pay your monthly premium to activate coverage and claim access.'
              }
            />
            <SettingCard
              icon={ScanSearch}
              title="Evidence alerts"
              description="Atlas prompts you instantly when a claim needs clearer proof."
            />
          </div>
        </article>
      </section>
    </motion.main>
  )
}

function ClaimPage() {
  const { busyAction, lastError, overview, statusMessage, submitClaim } = useAtlasApp()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [deliberating, setDeliberating] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({
    category: 'Auto',
    description:
      'Rear-side impact at a traffic light. Uploaded dashcam stills and repair estimate.',
    files: ['dashcam-frame.jpg', 'repair-estimate.pdf'],
    evidenceState: 'approved',
    requestedAmount: '180',
  })

  const outcome = getClaimOutcome(result)

  const submitClaimFlow = async () => {
    setDeliberating(true)
    setSubmitted(true)
    setResult(null)

    try {
      const claim = await submitClaim({
        category: form.category,
        description: form.description,
        files: form.files,
        evidenceState: form.evidenceState,
        requestedAmount: Number(form.requestedAmount),
      })
      setResult(claim)
    } catch {
      setSubmitted(false)
    } finally {
      setDeliberating(false)
    }
  }

  return (
    <motion.main
      className="portal-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PageHero
        title="File a claim"
        description="Guide Atlas through the incident, upload evidence, and let the AI jury take over."
        action={{ label: 'Pool stats', to: '/pool-stats' }}
      />
      <StatusBanner message={statusMessage} error={lastError} />

      <section className="claim-flow-shell">
        <div className="claim-steps">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`claim-step-pill ${step === item ? 'active' : ''}`}>
              <span>{item}</span>
              <strong>
                {item === 1 ? 'Choose category' : item === 2 ? 'Describe incident' : 'Review'}
              </strong>
            </div>
          ))}
        </div>

        {!submitted && (
          <div className="glass-panel claim-panel">
            {step === 1 && (
              <div className="claim-step-content">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow muted">Step 1</span>
                    <h3>Choose coverage lane</h3>
                  </div>
                </div>
                <div className="category-grid">
                  {claimCategories.map((item) => {
                    const Icon = item.icon
                    const active = form.category === item.title
                    return (
                      <button
                        key={item.title}
                        type="button"
                        className={`category-card ${active ? 'active' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, category: item.title }))}
                      >
                        <Icon size={24} />
                        <span>{item.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="claim-step-content">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow muted">Step 2</span>
                    <h3>Describe the incident</h3>
                  </div>
                </div>
                <label className="text-field">
                  <span>Incident summary</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <label className="text-field compact-field">
                  <span>Requested payout (USDC)</span>
                  <input
                    type="number"
                    min="1"
                    max={MAX_CLAIM_AMOUNT_USDC}
                    step="1"
                    value={form.requestedAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requestedAmount: String(
                          Math.min(
                            MAX_CLAIM_AMOUNT_USDC,
                            Math.max(1, Number(event.target.value || 1)),
                          ),
                        ),
                      }))
                    }
                  />
                  <small>Maximum payout request is $10.00 for now.</small>
                </label>
                <label className="upload-zone">
                  <UploadCloud size={28} />
                  <strong>Drop evidence here or browse files</strong>
                  <span>Photos, receipts, reports, and travel confirmations all help the AI jury move faster.</span>
                  <input
                    type="file"
                    multiple
                    onChange={(event) => {
                      const fileNames = Array.from(event.target.files ?? []).map((file) => file.name)
                      setForm((current) => ({
                        ...current,
                        files: fileNames.length > 0 ? fileNames : current.files,
                      }))
                    }}
                  />
                </label>
                <div className="file-chip-row">
                  {form.files.map((file) => (
                    <span key={file} className="file-chip">
                      <FileText size={14} />
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="claim-step-content">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow muted">Step 3</span>
                    <h3>Review and confirm</h3>
                  </div>
                </div>
                <div className="review-grid">
                  <div className="review-card">
                    <span>Category</span>
                    <strong>{form.category}</strong>
                  </div>
                  <div className="review-card">
                    <span>Files attached</span>
                    <strong>{form.files.length}</strong>
                  </div>
                  <div className="review-card">
                    <span>Requested payout</span>
                    <strong>{preciseMoneyFormatter.format(Number(form.requestedAmount || 0))}</strong>
                  </div>
                  <div className="review-card full">
                    <span>Summary</span>
                    <p>{form.description}</p>
                  </div>
                </div>
                <div className="evidence-state">
                  <span>Evidence quality</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={form.evidenceState === 'approved' ? 'active' : ''}
                      onClick={() =>
                        setForm((current) => ({ ...current, evidenceState: 'approved' }))
                      }
                    >
                      Complete evidence
                    </button>
                    <button
                      type="button"
                      className={form.evidenceState === 'reviewed' ? 'active' : ''}
                      onClick={() =>
                        setForm((current) => ({ ...current, evidenceState: 'reviewed' }))
                      }
                    >
                      Needs review
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="claim-actions">
              <button
                type="button"
                className="atlas-button ghost"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                Back
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  className="atlas-button primary"
                  onClick={() => setStep((current) => Math.min(3, current + 1))}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="atlas-button primary"
                  onClick={submitClaimFlow}
                  disabled={busyAction === 'claim' || !overview.member.canFileClaim}
                >
                  {busyAction === 'claim'
                    ? 'Submitting...'
                    : overview.member.canFileClaim
                      ? 'Submit to AI Jury'
                      : 'Premium Required'}
                </button>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {deliberating && (
            <motion.div
              className="deliberation-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="deliberation-core">
                <div className="orbit-ring ring-one" />
                <div className="orbit-ring ring-two" />
                <div className="orbit-ring ring-three" />
                <div className="shield-core">
                  <Shield size={36} />
                </div>
              </div>
              <h3>AI Jury Is Deliberating...</h3>
              <p>Reading evidence, checking policy terms, and preparing a payout-safe verdict.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {submitted && !deliberating && outcome && (
          <motion.article
            className={`glass-panel verdict-card ${outcome.variant}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="verdict-icon">
              {outcome.variant === 'approved' ? <CheckCircle2 size={36} /> : <XCircle size={36} />}
            </div>
            <div className="verdict-copy">
              <span className="eyebrow muted">Verdict</span>
              <h3>{outcome.title}</h3>
              <p>{outcome.description}</p>
              <strong>{outcome.amount}</strong>
            </div>
            <div className="verdict-actions">
              <button
                type="button"
                className="atlas-button secondary"
                onClick={() => {
                  setSubmitted(false)
                  setResult(null)
                  setStep(1)
                }}
              >
                Start Another Claim
              </button>
              <Link className="atlas-button primary" to="/dashboard#recent-claims">
                View Claim History
              </Link>
            </div>
          </motion.article>
        )}
      </section>
    </motion.main>
  )
}

const approvedResult = {
  title: 'Claim Approved. $180.00 USDC is on its way to your wallet.',
  description:
    'The evidence set was verified successfully and the payout instruction has already been queued.',
  amount: preciseMoneyFormatter.format(180),
  variant: 'approved',
}

const reviewedResult = {
  title: 'Claim Reviewed. The AI jury could not verify this claim yet.',
  description:
    'Atlas needs clearer or additional evidence before funds can be released from the community pool.',
  amount: 'Needs more evidence',
  variant: 'reviewed',
}

function PlansPage() {
  const {
    authenticated,
    busyAction,
    confirmCardDeposit,
    lastError,
    statusMessage,
    startCardDeposit,
    startWalletDeposit,
  } = useAtlasApp()
  const [billing, setBilling] = useState('monthly')
  const location = useLocation()
  const handledCheckoutRef = useRef('')

  const totals = useMemo(
    () =>
      pricingPlans.map((plan) => ({
        ...plan,
        price: billing === 'monthly' ? plan.monthly : plan.annual,
      })),
    [billing],
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const checkoutState = params.get('checkout')
    const depositId = params.get('deposit')
    const sessionId = params.get('session_id')

    if (checkoutState !== 'success' || !depositId || !sessionId) {
      return
    }

    const handledKey = `${checkoutState}:${depositId}:${sessionId}`
    if (handledCheckoutRef.current === handledKey) {
      return
    }

    handledCheckoutRef.current = handledKey
    void confirmCardDeposit({ depositId, sessionId })
  }, [confirmCardDeposit, location.search])

  return (
    <motion.main
      className="portal-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PageHero
        title="Coverage plans"
        description="Choose the protection lanes you want and let Atlas keep each one liquid, visible, and ready."
        action={{ label: 'Start claim', to: '/claim' }}
      />
      <StatusBanner message={statusMessage} error={lastError} />

      <section className="billing-toggle-row">
        <div className="segmented-control">
          <button
            type="button"
            className={billing === 'monthly' ? 'active' : ''}
            onClick={() => startTransition(() => setBilling('monthly'))}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billing === 'annual' ? 'active' : ''}
            onClick={() => startTransition(() => setBilling('annual'))}
          >
            Annual
          </button>
        </div>
      </section>

      <section className="plans-grid">
        {totals.map((plan) => (
          <article key={plan.title} className={`plan-card ${plan.accent} ${plan.active ? 'active' : ''}`}>
            <div className="plan-top">
              <div>
                <span className="eyebrow muted">Coverage vertical</span>
                <h3>{plan.title}</h3>
              </div>
              {plan.active && <span className="active-badge">Active plan</span>}
            </div>
            <strong className="plan-price">{moneyFormatter.format(plan.price)}</strong>
            <span className="plan-cycle">per {billing === 'monthly' ? 'month' : 'year'}</span>
            <p className="plan-payout">Max payout {plan.payout}</p>
            <ul className="plan-list">
              {plan.bullets.map((bullet) => (
                <li key={bullet}>
                  <CheckCircle2 size={16} />
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="plan-actions-stack">
              <button
                type="button"
                className="atlas-button primary plan-action-button"
                onClick={async () => {
                  const payload = await startCardDeposit(plan)
                  if (payload?.checkoutUrl) {
                    window.open(payload.checkoutUrl, '_blank', 'noopener,noreferrer')
                  }
                }}
                disabled={busyAction === `card:${plan.title}`}
              >
                {busyAction === `card:${plan.title}` ? 'Opening test checkout...' : 'Pay with Card'}
              </button>
              <button
                type="button"
                className={`atlas-button secondary plan-action-button plan-wallet-button ${plan.accent === 'dark' ? 'contrast' : ''}`}
                onClick={() => startWalletDeposit(plan)}
                disabled={busyAction === `wallet:${plan.title}`}
              >
                {busyAction === `wallet:${plan.title}`
                  ? 'Waiting for wallet...'
                  : authenticated
                    ? 'Pay with Wallet'
                    : 'Connect Wallet to Pay'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </motion.main>
  )
}

function PoolStatsPage() {
  const { overview, lastError, statusMessage } = useAtlasApp()

  const poolMetrics = [
    ['Total pool size', overview.pool.poolSizeUsdc, (value) => moneyFormatter.format(value)],
    ['Claims paid', overview.pool.claimsPaidThisMonth, (value) => wholeNumberFormatter.format(value)],
    [
      'Protocol fee collected',
      overview.pool.protocolFeeCollectedUsdc,
      (value) => moneyFormatter.format(value),
    ],
    ['Reserve buffer', overview.pool.reserveBufferUsdc, (value) => moneyFormatter.format(value)],
  ]

  return (
    <motion.main
      className="portal-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PageHero
        title="Pool statistics"
        description="See exactly how Atlas allocates reserves, pays claims, and grows protocol safety."
        action={{ label: 'Dashboard', to: '/dashboard' }}
      />
      <StatusBanner message={statusMessage} error={lastError} />

      <section className="pool-metrics-grid">
        {poolMetrics.map(([label, value, formatter]) => (
          <article key={label} className="glass-panel pool-metric-card">
            <span>{label}</span>
            <AnimatedCounter value={value} formatter={formatter} />
          </article>
        ))}
      </section>

      <section className="dashboard-content-grid">
        <article className="glass-panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">Allocation</span>
              <h3>Pool breakdown</h3>
            </div>
            <BadgeDollarSign size={20} />
          </div>
          <div className="donut-layout">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie
                    data={poolComposition}
                    dataKey="value"
                    innerRadius={78}
                    outerRadius={110}
                    paddingAngle={4}
                  >
                    {poolComposition.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-list">
              {poolComposition.map((item) => (
                <div key={item.name} className="legend-row">
                  <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.value}% allocation</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="glass-panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow muted">Growth</span>
              <h3>Reserve and payout flow</h3>
            </div>
            <Activity size={20} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={reserveFlow}>
              <defs>
                <linearGradient id="poolGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2a7876" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#2a7876" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="reserveGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#c3ea8d" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#c3ea8d" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(22, 60, 61, 0.08)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="pool" stroke="#163c3d" fill="url(#poolGradient)" />
              <Area
                type="monotone"
                dataKey="reserve"
                stroke="#9ecf59"
                fill="url(#reserveGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      </section>
    </motion.main>
  )
}

function PageHero({ title, description, action }) {
  return (
    <section className="page-hero">
      <div>
        <span className="eyebrow">Atlas workspace</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action?.onClick ? (
        <button type="button" className="atlas-button primary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : action ? (
        <Link className="atlas-button primary" to={action.to}>
          {action.label}
        </Link>
      ) : null}
    </section>
  )
}

function PortalSidebarContent({ authenticated, location, onLogout, onNavigate }) {
  const { exportEmbeddedWallet, walletAddress, overview } = useAtlasApp()
  const walletDisplay = overview?.member?.walletDisplay || shortenWallet(walletAddress)
  const coverageSummary =
    authenticated && overview.member.isCoverageActive
      ? `Coverage remains active until ${
          overview.member.coverageExpiresAt
            ? new Date(overview.member.coverageExpiresAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'the next renewal'
        } with a ${overview.pool.reserveCoverageRatio}% reserve coverage ratio.`
      : 'Pay your monthly premium to activate protection before filing claims.'

  return (
    <>
      <div className="portal-brand-block">
        <Link className="brand" to="/" onClick={onNavigate}>
          <LogoMark />
          <span>Atlas</span>
        </Link>
        <p>AI insurance jury</p>
      </div>

      <nav className="portal-nav" aria-label="Dashboard">
        {shellNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.label}
              className={`shell-link ${isActive ? 'active' : ''}`}
              to={item.to}
              onClick={onNavigate}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="portal-sidebar-card">
        <span className="eyebrow muted">Member health</span>
        <strong>
          {authenticated
            ? overview.member.isCoverageActive
              ? 'Premiums current'
              : 'Premium inactive'
            : 'Sign in to activate'}
        </strong>
        <p>{authenticated ? coverageSummary : 'Use Google or WalletConnect to create an embedded Arc wallet and activate coverage.'}</p>
        {authenticated ? (
          <AccountMenu
            walletAddress={walletAddress}
            walletDisplay={walletDisplay}
            onExportWallet={exportEmbeddedWallet}
            onLogout={async () => {
              onNavigate?.()
              await onLogout()
            }}
            fullWidth
          />
        ) : (
          <SignInMenu fullWidth tone="primary" onBeforeAction={onNavigate} />
        )}
      </div>
    </>
  )
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <Shield size={16} />
    </span>
  )
}

function SectionHeading({ eyebrow, title, description, inverse = false }) {
  return (
    <div className={`section-heading ${inverse ? 'inverse' : ''}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedCounter({ value, formatter = (current) => wholeNumberFormatter.format(current) }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.45 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) {
      return undefined
    }

    let frameId
    let startTime

    const tick = (timestamp) => {
      if (!startTime) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / 1300, 1)
      const eased = 1 - (1 - progress) ** 4
      setDisplay(value * eased)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [inView, value])

  return <strong ref={ref}>{formatter(display)}</strong>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div className="chart-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((item, index) => (
        <div key={`${item.dataKey || item.name || 'value'}-${index}`} className="tooltip-row">
          <span>{item.name || item.dataKey}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function SignalRow({ label, value, tone }) {
  return (
    <div className="signal-row">
      <span>{label}</span>
      <strong className={`tone-${tone}`}>{value}</strong>
    </div>
  )
}

function SettingCard({ icon: Icon, title, description }) {
  return (
    <div className="setting-card">
      <div className="icon-bubble soft">
        <Icon size={18} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function StatusBanner({ message, error }) {
  if (!message && !error) {
    return null
  }

  return (
    <div className={`status-banner ${error ? 'error' : 'success'}`}>
      {error || message}
    </div>
  )
}

function shortenWallet(address) {
  if (!address || address.length < 10) {
    return 'Wallet unavailable'
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getClaimOutcome(claim) {
  if (!claim) {
    return null
  }

  if (claim === 'approved') {
    return approvedResult
  }

  if (claim === 'reviewed') {
    return reviewedResult
  }

  if (
    claim.status === 'submitted' ||
    claim.status === 'queued' ||
    claim.status === 'deliberating' ||
    claim.status === 'pending'
  ) {
    return {
      title: 'Claim submitted. The AI jury is still deliberating.',
      description:
        claim.reason ||
        'Atlas has the evidence package and will push the verdict to Arc as soon as StudioNet reaches consensus.',
      amount: 'Awaiting consensus',
      variant: 'pending',
    }
  }

  const approved =
    claim.approved ||
    claim.status === 'approved' ||
    claim.status === 'paid' ||
    claim.status === 'Approved'

  const payoutAmount =
    claim.payoutAmountUsdc ??
    claim.approvedAmountUsdc ??
    claim.approvedAmount ??
    claim.requestedAmount ??
    0

  return {
    title: approved
      ? `Claim Approved. ${preciseMoneyFormatter.format(Number(payoutAmount || 0))} USDC is on its way to your wallet.`
      : 'Claim Reviewed. The AI jury could not verify this claim yet.',
    description:
      claim.reason ||
      claim.description ||
      (approved
        ? 'The evidence set was verified successfully and the payout instruction has already been queued.'
        : 'Atlas needs clearer or additional evidence before funds can be released from the community pool.'),
    amount: approved
      ? preciseMoneyFormatter.format(Number(payoutAmount || 0))
      : 'Needs more evidence',
    variant: approved ? 'approved' : 'reviewed',
  }
}

export default App
