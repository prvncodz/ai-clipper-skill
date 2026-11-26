import { Check, Film, Play, ScanLine } from 'lucide-react'
import { Stage } from './stageshow/stage'
import { Window } from './stageshow/window'
import { Badge } from './stageshow/controls/Badge'
import './demo.css'

const assetRoot = import.meta.env.BASE_URL
const highlights = [
  { image: 'podcast-1.webp', duration: '0:24', caption: 'Start with the idea', offset: '12%', color: 'lilac' },
  { image: 'podcast-2.webp', duration: '0:31', caption: 'Make the first cut', offset: '42%', color: 'lime' },
  { image: 'podcast-3.webp', duration: '0:19', caption: 'Keep the good parts', offset: '78%', color: 'lilac' },
]

async function cutVideo(scene) {
  await scene.wait(850)
  scene.mark('find-highlights')
  scene.put({ beat: 'select' })
  await scene.wait(1450)
  scene.mark('export-clips')
  scene.put({ beat: 'export' })
  await scene.wait(1200)
  scene.put({ beat: 'done' })
}

export function ClipDemo() {
  return (
    <figure className="demo" id="clip-preview" aria-label="Illustration of a podcast recording being cut into three captioned vertical clips">
      <div aria-hidden="true">
        <Stage
          width={640}
          height={400}
          compact={{ below: 480, width: 358, height: 356 }}
          className="clip-stage"
          theme="dark"
          accent="#d8f896"
          initial={{ beat: 'source' }}
          poster={{ beat: 'done' }}
          play="once"
          script={cutVideo}
        >
          {({ beat }) => (
            <Window
              className="clip-window"
              title="ClipEx · Example export"
              lights="grey"
              toolbar={<span className="editor-format">9:16 MP4</span>}
            >
              <div className="editor" data-beat={beat}>
                <div className="editor-media">
                  <div className="source-panel">
                    <div className="editor-label"><Film size={15} />Source video</div>
                    <div className="source-video">
                      <img src={assetRoot + 'podcast-2.webp'} alt="" />
                      <span className="source-play"><Play size={21} fill="currentColor" /></span>
                      <span className="video-length">42:18</span>
                    </div>
                    <div className="source-name">studio-session.mp4</div>
                  </div>
                  <div className="output-panel">
                    <div className="editor-label output-label">
                      <ScanLine size={15} />Vertical clips
                      <Badge tone="success" className="export-badge" icon={<Check size={13} />}>3 clips ready</Badge>
                    </div>
                    <div className="output-grid">
                      {highlights.map(({ image, duration, caption, color }, index) => (
                        <div className="portrait-slot" key={image} style={{ '--index': index }} data-color={color}>
                          <div className="portrait">
                            <img src={assetRoot + image} alt="" />
                            <span className="portrait-caption">{caption}</span>
                          </div>
                          <span className="portrait-duration">{duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="editor-timeline">
                  <div className="ruler"><span>00:00</span><span>21:09</span><span>42:18</span></div>
                  <div className="track">
                    {highlights.map(({ image }, index) => <span key={image} style={{ backgroundImage: `url("${assetRoot + image}")`, '--index': index }} />)}
                    {highlights.map(({ image, offset, color }, index) => <i key={image} data-color={color} style={{ '--offset': offset, '--index': index }} />)}
                  </div>
                </div>
              </div>
            </Window>
          )}
        </Stage>
      </div>
    </figure>
  )
}
