/* CUPC Worship service worker */
import { setCacheNameDetails, clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

setCacheNameDetails({ prefix: 'cupc-worship-v10' })
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const fallbackHtml = async () =>
  (await matchPrecache('/cupc-worship/index.html'))
  || (await matchPrecache('index.html'))
  || (await matchPrecache('/index.html'))
  || Response.error()

const htmlStrategy = new NetworkFirst({
  cacheName: 'cupc-html-v9',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    { handlerDidError: async () => fallbackHtml() }
  ]
})

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/cupc-worship/' ||
    url.pathname === '/cupc-worship',
  htmlStrategy
)
