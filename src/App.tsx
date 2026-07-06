import { useState } from 'react'
import { LettersView } from './views/LettersView'
import { LearnView } from './views/LearnView'
import { DictionaryView } from './views/DictionaryView'
import './App.css'

type Tab = 'learn' | 'letters' | 'dictionary'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'learn', label: 'Nauka słów' },
  { id: 'letters', label: 'Alfabet palcowy' },
  { id: 'dictionary', label: 'Słownik' },
]

function App() {
  const [tab, setTab] = useState<Tab>('learn')

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Migus <span className="badge">PJM</span>
        </h1>
        <p className="subtitle">
          Nauka polskiego języka migowego: lekcje słów z oceną wykonania, rozpoznawanie alfabetu
          palcowego i słownik znaków - wszystko w przeglądarce
        </p>
        <nav className="tabs" aria-label="Sekcje aplikacji">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'learn' && <LearnView />}
      {tab === 'letters' && <LettersView />}
      {tab === 'dictionary' && <DictionaryView />}

      <footer className="app-footer">
        Obraz z kamery jest przetwarzany wyłącznie lokalnie w Twojej przeglądarce - nic nie jest
        wysyłane na serwer. Nagrania znaków: Korpusowy Słownik PJM (UW).
      </footer>
    </div>
  )
}

export default App
