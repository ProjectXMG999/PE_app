import { getStore } from '@netlify/blobs'

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const pack = url.searchParams.get('pack')
  const file = url.searchParams.get('file')

  if (!pack || !file) {
    return new Response('Missing pack or file parameter', { status: 400 })
  }

  // Sanitize inputs to prevent path traversal
  const safePack = pack.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeFile = file.replace(/[^a-zA-Z0-9_.-]/g, '')

  if (!safePack || !safeFile || !safeFile.endsWith('.mp3')) {
    return new Response('Invalid parameters', { status: 400 })
  }

  try {
    const store = getStore('audio')
    const key = `${safePack}/${safeFile}`
    const blob = await store.get(key, { type: 'blob' })

    if (!blob) {
      return new Response('Audio not found', { status: 404 })
    }

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const size = blob.size
      const [, rangeStr] = rangeHeader.split('=')
      const [startStr, endStr] = rangeStr.split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : size - 1
      const chunkSize = end - start + 1

      const buffer = await blob.arrayBuffer()
      const chunk = buffer.slice(start, end + 1)

      return new Response(chunk, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=2592000',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(blob.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=2592000',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Audio function error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}

export const config = {
  path: '/.netlify/functions/audio',
}
