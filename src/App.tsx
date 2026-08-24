import { useState } from 'react'
import { StoreProvider, useStore } from './state/store'
import { Benchmark } from './screens/Benchmark'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Player } from './screens/Player'
import { History } from './screens/History'
import { Settings } from './screens/Settings'

export type Tab = 'today' | 'history' | 'settings'

function Shell() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [playing, setPlaying] = useState(false)
  const [testing, setTesting] = useState(false)

  if (!state.profile.onboarded) return <Onboarding />
  if (playing && state.todayWorkout) return <Player onExit={() => setPlaying(false)} />
  if (testing) return <Benchmark onExit={() => setTesting(false)} />

  return (
    <div className="shell">
      <main className="content">
        {tab === 'today' && <Today onStart={() => setPlaying(true)} />}
        {tab === 'history' && <History onStartTest={() => setTesting(true)} />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          <span className="tab-icon">🏋️</span>Today
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <span className="tab-icon">📈</span>Progress
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <span className="tab-icon">⚙️</span>Settings
        </button>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
