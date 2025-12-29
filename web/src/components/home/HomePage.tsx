// ============================================
// HOME PAGE COMPONENT
// ============================================

import { FC } from 'react'
import { Link } from 'react-router-dom'
import '@/styles/home.css'

export const HomePage: FC = () => {
  return (
    <div className="container">
      <div className="hero-card">
        <h1 className="hero-title">
          Bernat Torres
          <span className="cursor"></span>
        </h1>
        <p className="hero-subtitle">
          <span>Tech Lead</span>
          <span className="sep">·</span>
          <a href="https://genesy.ai" target="_blank" rel="noopener">
            Genesy AI
          </a>
        </p>
        <p className="hero-note">Building stuff, writing sometimes.</p>
      </div>

      <section>
        <h2 className="section-title">Now</h2>
        <div className="now-content">
          <p>
            Tech Lead at{' '}
            <a href="https://genesy.ai" target="_blank" rel="noopener">
              Genesy
            </a>
            , an AI{' '}
            <span className="tooltip" data-tip="Go-to-Market — sales & marketing">
              GTM
            </span>{' '}
            platform startup based in Barcelona. Joined as the first engineer in January 2024 —
            we were 4 people back then, now we're 50.
          </p>
          <p>
            Building high-performant systems, distributed backends, and learning my way through
            management in a fast-growing startup. Also doing infra and frontend when needed.
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Background</h2>
        <div className="now-content">
          <p>
            Studied Computer Science, then a postgraduate in Deep Learning. Previously at{' '}
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
          <Link to="/todo">Todo</Link>
        </div>
        <p className="footer-text">© 2025</p>
      </footer>
    </div>
  )
}

