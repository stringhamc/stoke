// Builds stoke-standalone.html — the whole app inlined into one file that can
// be opened directly in a browser (file://), no server or install needed.
import { build } from 'esbuild'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

const outJs = 'dist-standalone/app.js'
await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: outJs,
  define: { 'process.env.NODE_ENV': '"production"' },
})

const js = readFileSync(outJs, 'utf8')
const css = readFileSync('dist-standalone/app.css', 'utf8')

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#10141c" />
    <title>Stoke</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
  </body>
</html>
`

writeFileSync('stoke-standalone.html', html)
rmSync('dist-standalone', { recursive: true, force: true })
console.log(`stoke-standalone.html written (${Math.round(html.length / 1024)} kB)`)
