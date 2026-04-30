import { useNavigate } from 'react-router-dom'
import { UserCircle, Shield } from 'lucide-react'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <svg className="w-full h-screen" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#eef8f7" />
              <stop offset="100%" stopColor="#f8fbfb" />
            </linearGradient>

            <radialGradient id="r1" cx="50%" cy="36%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#eaf7f5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#eaf7f5" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="buttonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#74c7be" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#74c7be" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="diagLeft" x1="0" x2="1">
              <stop offset="0%" stopColor="#cfe9e5" stopOpacity="1" />
              <stop offset="100%" stopColor="#dff3ef" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="diagRight" x1="1" x2="0">
              <stop offset="0%" stopColor="#cfe9e5" stopOpacity="1" />
              <stop offset="100%" stopColor="#dff3ef" stopOpacity="0.85" />
            </linearGradient>

            <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" result="b" />
            </filter>

            <filter id="noise" x="0" y="0" width="100%" height="100%">
              <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="t" />
              <feColorMatrix type="saturate" values="0" result="cm" />
              <feComponentTransfer>
                <feFuncA type="table" tableValues="0 0.06" />
              </feComponentTransfer>
            </filter>

          </defs>

          {/* base gradient */}
          <rect width="100%" height="100%" fill="url(#g1)" opacity="0.98" />

          {/* soft radial highlight behind heading */}
          <rect width="100%" height="100%" fill="url(#r1)" opacity="0.28" />

          {/* faint decorative circles (bokeh) */}
          <g opacity="0.18" filter="url(#blur)">
            <circle cx="120" cy="80" r="78" fill="#74c7be" />
            <circle cx="360" cy="520" r="36" fill="#74c7be" />
            <circle cx="1320" cy="90" r="26" fill="#74c7be" />
          </g>

          {/* outlined rings (stroke-only) — stronger and varied weights */}
          <g opacity="0.34">
            <circle cx="120" cy="80" r="72" fill="none" stroke="#86cfc7" strokeWidth="4" />
            <circle cx="1220" cy="90" r="44" fill="none" stroke="#86cfc7" strokeWidth="4" />
            <circle cx="300" cy="460" r="44" fill="none" stroke="#9fe0d8" strokeWidth="3" />
            <circle cx="980" cy="180" r="50" fill="none" stroke="#c5e9e3" strokeWidth="3" opacity="0.6" />
          </g>

          {/* subtle button glow */}
          <circle cx="1050" cy="420" r="80" fill="url(#buttonGlow)" opacity="0.36" />

          {/* small filled accent near center-right (by buttons) */}
          <circle cx="1050" cy="420" r="20" fill="#53b09c" opacity="0.98" />
          {/* additional circles behind cards (soft bokeh + subtle rings) */}
          <g opacity="0.16" filter="url(#blur)">
            <circle cx="720" cy="560" r="70" fill="#7fd3c7" />
            <circle cx="520" cy="620" r="36" fill="#7fd3c7" />
            <circle cx="920" cy="640" r="44" fill="#7fd3c7" />
            <circle cx="960" cy="520" r="28" fill="#7fd3c7" />
          </g>
          <g opacity="0.28">
            <circle cx="720" cy="560" r="84" fill="none" stroke="#6fbdb0" strokeWidth="3" />
            <circle cx="920" cy="640" r="34" fill="none" stroke="#6fbdb0" strokeWidth="2" />
          </g>

          {/* subtle noise overlay for texture */}
          <rect width="100%" height="100%" fill="#000000" opacity="0.02" filter="url(#noise)" />
        </svg>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        {/* bottom hero shapes — sticky to viewport bottom, teal tones match sample */}
        <div className="hero-shape-left hidden md:block fixed left-0 bottom-0 w-[300px] h-[300px] pointer-events-none z-0">
          <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-hidden="true">
            <polygon points="0,300 300,300 0,0" fill="#e3f7f6" opacity="1" />
            <polygon points="0,300 250,300 0,100" fill="#aed4d3" opacity="0.35" />
          </svg>
        </div>

        <div className="hero-shape-right hidden md:block fixed right-0 bottom-0 w-[300px] h-[300px] pointer-events-none z-0">
          <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-hidden="true">
            <polygon points="300,300 0,300 300,0" fill="#e3f7f6" opacity="1" />
            <polygon points="300,300 50,300 300,100" fill="#aed4d3" opacity="0.35" />
          </svg>
        </div>
        <div className="text-center mb-8 relative hero">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Choose your destination</h1>
          <p className="text-gray-600">Select the service you need</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto landing-grid">
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow landing-card group max-w-md w-full mx-auto">
            <div className="bg-gradient-to-r from-[#006a22] to-green-700 px-4 py-3 flex items-center gap-2 card-top">
              <UserCircle className="w-5 h-5 text-white" />
              <h3 className="text-white font-semibold">Employee Login</h3>
            </div>
            <button
              onClick={() => navigate('/employee')}
              className="w-full p-8 text-center hover:bg-gray-50 transition-colors transition-transform"
            >
              <UserCircle className="w-16 h-16 text-[#006a22] mx-auto mb-4 landing-icon" />
              <h4 className="text-xl font-bold text-gray-800 mb-2 landing-title">EMPLOYEE LOGIN</h4>
              <p className="text-gray-600 text-sm">Access your employee dashboard</p>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow landing-card group max-w-md w-full mx-auto">
            <div className="bg-gradient-to-r from-[#006a22] to-green-700 px-4 py-3 flex items-center gap-2 card-top">
              <Shield className="w-5 h-5 text-white" />
              <h3 className="text-white font-semibold">Supervisor Login</h3>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full p-8 text-center hover:bg-gray-50 transition-colors transition-transform"
            >
              <Shield className="w-16 h-16 text-[#006a22] mx-auto mb-4 landing-icon" />
              <h4 className="text-xl font-bold text-gray-800 mb-2 landing-title">ADMIN LOGIN</h4>
              <p className="text-gray-600 text-sm">Admin & Supervisor Access</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
