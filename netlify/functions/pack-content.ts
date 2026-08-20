import { getStore } from '@netlify/blobs'
import { requireEntitledUser } from './_lib/auth'

export default async (request: Request): Promise<Response> => {
  const result = await requireEntitledUser(request)
  if ('error' in result) return result.error

  const url = new URL(request.url)
  const pack = url.searchParams.get('pack')
  if (!pack) return new Response('Missing pack parameter', { status: 400 })

  const safePack = pack.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safePack) return new Response('Invalid parameters', { status: 400 })

  try {
    const store = getStore('packs')
    const data = await store.get(`${safePack}.json`, { type: 'json' })

    if (!data) return new Response('Pack not found', { status: 404 })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=0',
      },
    })
  } catch (err) {
    console.error('pack-content function error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
