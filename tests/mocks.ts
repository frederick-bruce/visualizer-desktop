// Simple network route mocks for Spotify endpoints used in UI smoke tests.
import { test as base } from '@playwright/test'

export const test = base.extend<{ mockApis: void }>({
  mockApis: [async ({ page }, use) => {
    await page.route('**/v1/me/player**', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { is_playing: false, progress_ms: 0, item: null } })
      }
      return route.fulfill({ status: 204, body: '' })
    })
    await page.route('**/v1/me/player/currently-playing**', route => route.fulfill({ json: { item: null } }))
    await page.route('**/v1/me/player/devices**', route => route.fulfill({ json: { devices: [] } }))
    await page.route('**/v1/me/playlists**', route => route.fulfill({ json: { items: [] } }))
    await use()
  }, { auto: true }]
})

export const expect = base.expect
