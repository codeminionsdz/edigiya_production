import { useState, useEffect } from 'react'
import './App.css'
import { getCashBalance } from './services'

function App() {
  const [count, setCount] = useState(0)
  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    // Detect if using mock database (dev mode)
    const isPlaceholder =
      (process.env.VITE_SUPABASE_URL?.includes('your-project')) ||
      (process.env.VITE_SUPABASE_ANON_KEY?.includes('your-anon-key'))
    
    setIsDevMode(!!isPlaceholder)

    // Load cash balance
    const loadCashBalance = async () => {
      try {
        const result = await getCashBalance()
        if (result.success) {
          setCashBalance(result.data)
        }
      } catch (error) {
        console.error('Error loading cash balance:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCashBalance()
  }, [])

  return (
    <div className="container">
      <header className="header">
        <h1>🏪 Nutrition ERP System</h1>
        <p>Desktop ERP with FIFO Stock Management</p>
        {isDevMode && (
          <div style={{ padding: '10px', background: '#fff3cd', marginTop: '10px', borderRadius: '4px' }}>
            <strong>⚙️ Development Mode:</strong> Using mock database (no Supabase configured)
          </div>
        )}
      </header>

      <main className="main">
        <section className="status-card">
          <h2>System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Database</span>
              <span className="status-value">{isDevMode ? '✅ Mock (Dev)' : '⏳ Connecting...'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Services</span>
              <span className="status-value">✅ Loaded</span>
            </div>
            <div className="status-item">
              <span className="status-label">Frontend</span>
              <span className="status-value">✅ Ready</span>
            </div>
          </div>
        </section>

        <section className="status-card">
          <h2>💰 Cash Ledger</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Current Balance</span>
              <span className="status-value">
                {loading ? '⏳ Loading...' : (
                  <>
                    ${(cashBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        <section className="quick-links">
          <h2>Quick Start</h2>
          <div className="link-grid">
            <button className="link-button">📦 Inventory</button>
            <button className="link-button">🛒 Sales Orders</button>
            <button className="link-button">📥 Purchases</button>
            <button className="link-button">💰 Cash Ledger</button>
          </div>
        </section>

        <section className="demo-section">
          <h3>Demo Counter: {count}</h3>
          <button onClick={() => setCount((count) => count + 1)}>
            Increment
          </button>
        </section>

        <section className="info-section">
          <h3>📖 Documentation</h3>
          <ul>
            <li><a href="#">Start Here (00_START_HERE.md)</a></li>
            <li><a href="#">Transactional Safety Guide</a></li>
            <li><a href="#">Deployment Checklist</a></li>
            <li><a href="#">API Reference</a></li>
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Nutrition ERP v0.1.0 • TypeScript + React + Tauri</p>
      </footer>
    </div>
  )
}

export default App
