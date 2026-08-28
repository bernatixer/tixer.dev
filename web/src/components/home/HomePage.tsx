// ============================================
// HOME PAGE COMPONENT
// ============================================

import { FC, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks'
import type { ThemeId } from '@/styles/theme'
import '@/styles/home.css'

export const HomePage: FC = () => {
  const { themeId, setTheme } = useTheme()
  const prevTheme = useRef<ThemeId>(themeId)

  useEffect(() => {
    prevTheme.current = themeId
    setTheme('cyberDark')
    return () => { setTheme(prevTheme.current) }
  }, [])

  useEffect(() => {
    document.title = 'Bernat Torres'
  }, [])

  return (
    <div className="container">
      <div className="hero-card">
        <h1 className="hero-title">
          Bernat Torres
          <span className="cursor"></span>
        </h1>
        <p className="hero-subtitle">
          <span>Product Engineer</span>
          <span className="sep">·</span>
          <a href="https://posthog.com" target="_blank" rel="noopener">
            PostHog
          </a>
        </p>
        <p className="hero-note">Building stuff, writing sometimes.</p>
      </div>

      <section>
        <h2 className="section-title">Now</h2>
        <div className="now-content">
          <p>
            Product Engineer at{' '}
            <a href="https://posthog.com" target="_blank" rel="noopener">
              PostHog
            </a>
            , on the AI{' '}
            <span className="tooltip" data-tip="Traces, costs, latency and evals for LLM apps">
              Observability
            </span>{' '}
            team. Building the products that let teams see inside their LLM apps — what they
            answered, what it cost, and whether it was any good.
          </p>
          <p>
            End to end, the way PostHog builds: from the ingestion path to the screen someone
            actually looks at.
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Background</h2>
        <div className="now-content">
          <p>
            Before PostHog, Tech Lead at{' '}
            <a href="https://enginy.ai" target="_blank" rel="noopener">
              Enginy
            </a>
            . Joined as the first engineer in January 2024 — we were 4 people back then, 75 by
            the time I left. High-performant systems and distributed backends, learning my way
            through management in a fast-growing startup, and infra and frontend whenever they
            needed doing.
          </p>
          <p>
            Studied Computer Science, then a postgraduate in Deep Learning. Earlier at{' '}
            <a href="https://skyscanner.net" target="_blank" rel="noopener">
              Skyscanner
            </a>{' '}
            and{' '}
            <a href="https://glovoapp.com" target="_blank" rel="noopener">
              Glovo
            </a>
            . During university, I co-directed one edition of{' '}
            <a href="https://hackupc.com" target="_blank" rel="noopener">
              HackUPC
            </a>
            , the biggest student-run hackathon in Europe, and attended many more{' '}
            <span
              className="tooltip"
              data-tip="Canada, Finland, Switzerland, UK, France, Denmark, Germany and Spain"
            >
              around the world
            </span>
            .
          </p>
          <p>
            I like exploring new tech and understanding how systems work.
            <br />
            Outside of that —{' '}
            <span className="hobby hobby-ski">
              skiing
              <span className="flakes">
                <span>❄️</span>
                <span>❄️</span>
                <span>❄️</span>
                <span>❄️</span>
                <span>❄️</span>
              </span>
            </span>
            ,{' '}
            <span className="hobby hobby-hike">
              hiking <span className="mountain-scene">🌲⛰️🌲</span>mountains
            </span>
            ,{' '}
            <span className="hobby hobby-food">
              good food
              <span className="sushi-pieces">
                <span>🍣</span>
                <span>🍙</span>
                <span>🍱</span>
              </span>
            </span>
            , and <span className="hobby hobby-travel">exploring new places</span>.
          </p>
        </div>
      </section>

      <footer>
        <div className="links-list">
          <a href="https://linkedin.com/in/bernattorres" target="_blank" rel="noopener">
            LinkedIn
          </a>
          <a href="https://github.com/bernatixer" target="_blank" rel="noopener">
            GitHub
          </a>
          <a href="https://focus.tixer.dev">Focus</a>
        </div>
        <p className="footer-text footer-mark" aria-hidden="true">
          ▲
        </p>
      </footer>
    </div>
  )
}

