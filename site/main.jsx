import { createRoot } from 'react-dom/client'
import { Check, Clapperboard, Copy, Film, Gamepad2, Github, Mic, Terminal } from 'lucide-react'
import { ClipDemo } from './ClipDemo'
import { useCopy } from './useCopy'
import mark from './mark.svg'
import './styles.css'

const repository = 'https://github.com/prvncodz/clipex'
const installCommand = 'npx skills add prvncodz/clipex'
const setupLink = repository + '#install-clipex'
const assetRoot = import.meta.env.BASE_URL

const steps = [
  { icon: Terminal, title: 'Copy the command', description: 'Add the shorts skill to Codex or Claude Code. Follow the setup guide to install the local video tools.' },
  { icon: Film, title: 'Give it a video', description: 'Share the path to a local video. Give ClipEx timecodes or let it find the highlights.' },
  { icon: Clapperboard, title: 'Get your clips', description: 'ClipEx reframes the highlights, checks captions against the audio, and exports vertical MP4s.' },
]

const modes = [
  { name: 'Gameplay', icon: Gamepad2, image: 'gameplay.webp', description: 'Clip the action from a recording. Keep the gameplay centered or stack your facecam above it.' },
  { name: 'Podcast', icon: Mic, image: 'podcast-2.webp', description: 'Pull out moments that stand on their own. Keep the speaker in a wide crop with a title and timed captions.' },
]

function Brand() {
  return <a className="brand" href="#top"><img src={mark} alt="" width="36" height="36" />ClipEx</a>
}

function GitHubLink() {
  return <a className="github-link" href={repository}><Github size={17} aria-hidden="true" />GitHub</a>
}

function InstallCommand() {
  const { copy, status } = useCopy(installCommand)
  const copied = status === 'copied'
  const feedback = copied ? 'Command copied.' : status === 'error' ? 'Select the command to copy it manually.' : ''
  return (
    <div className="install" id="install">
      <div className="command">
        <span className="prompt" aria-hidden="true">$</span>
        <code>{installCommand}</code>
        <button type="button" className="copy-button" onClick={copy} aria-label={copied ? 'Command copied' : 'Copy install command'}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p className="setup-note"><a href={setupLink}>Setup guide</a><span> for local video tools</span></p>
      <span className={status === 'error' ? 'copy-error' : 'sr-only'} role="status">{feedback}</span>
    </div>
  )
}

function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" id="top">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#modes">Modes</a>
          </nav>
          <GitHubLink />
        </div>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span></span> Open source video clipping skill</p>
            <h1 id="hero-title">Long videos.<br /><em>Short clips.</em></h1>
            <p className="hero-description">Turn gameplay and podcasts into captioned vertical clips with the ClipEx skill for Codex and Claude Code.</p>
            <InstallCommand />
          </div>
          <ClipDemo />
        </section>

        <section className="workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="container">
            <h2 id="workflow-title">How it works</h2>
            <ol className="steps">
              {steps.map(({ icon: Icon, title, description }) => (
                <li key={title}>
                  <span className="step-icon"><Icon size={21} strokeWidth={1.75} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="modes container" id="modes" aria-labelledby="modes-title">
          <h2 id="modes-title">Two ways to clip</h2>
          <div className="modes-grid">
            {modes.map(({ name, icon: Icon, image, description }) => (
              <article className="mode" key={name}>
                <img className="mode-image" src={assetRoot + image} alt="" width="600" height="350" loading="lazy" />
                <div className="mode-copy">
                  <span className="mode-icon"><Icon size={19} aria-hidden="true" /></span>
                  <div><h3>{name}</h3><p>{description}</p></div>
                </div>
              </article>
            ))}
          </div>
          <p className="export-note">Exports for YouTube Shorts and Instagram Reels by default. Ask for TikTok when you need it.</p>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div><Brand /><p>Open source under the MIT license.</p></div>
          <div className="footer-links"><a href={setupLink}>Setup guide</a><GitHubLink /></div>
        </div>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
