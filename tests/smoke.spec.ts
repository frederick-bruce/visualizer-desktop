import { expect } from '@playwright/test'
import { test } from './mocks'

// Helper to find tab by label
const tab = (page: any, name: string) => page.getByRole('tab', { name })

test.describe('UI smoke', () => {
  test('sidebar toggle & tab switching', async ({ page }) => {
    await page.goto('/')
    // Sidebar toggle button (aria-label="Toggle sidebar")
    const toggle = page.getByRole('button', { name: /toggle sidebar/i })
    await expect(toggle).toBeVisible()
    const sidebar = page.locator('aside')
    const initialWidth = await sidebar.boundingBox()
    await toggle.click()
    await page.waitForTimeout(150)
    const collapsedWidth = await sidebar.boundingBox()
    expect(collapsedWidth?.width).not.toBe(initialWidth?.width)

    // Tabs
    await tab(page, 'Visualizers').click()
    await expect(tab(page, 'Visualizers')).toHaveAttribute('aria-selected', 'true')
    await tab(page, 'Settings').click()
    await expect(tab(page, 'Settings')).toHaveAttribute('aria-selected', 'true')
  })

  test('select visualizer & adjust sliders', async ({ page }) => {
    await page.goto('/?tab=visualizers')
    const firstCard = page.locator('button', { hasText: 'bars' }).first()
    await firstCard.click()
    const sensitivitySlider = page.getByLabel('Sensitivity')
    await sensitivitySlider.focus()
    await sensitivitySlider.press('ArrowRight')
    await sensitivitySlider.press('ArrowRight')
    // value label next to slider shows updated number (font-mono)
    const valueLabel = sensitivitySlider.locator('xpath=../..//span[contains(@class,"font-mono")]')
    await expect(valueLabel).toBeVisible()
  })

  test('timeline scrub & volume change', async ({ page }) => {
    await page.goto('/')
    // Ensure progress slider present (role=slider)
    const slider = page.getByRole('slider', { name: /progress/i })
    await expect(slider).toBeVisible()
    const box = await slider.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + (box.width * 0.8), box.y + box.height / 2)
      await page.mouse.up()
    }
    // Volume slider (input[type=range][aria-label=Volume])
    const volume = page.getByLabel('Volume')
    await volume.focus()
    await volume.press('ArrowUp')
    await volume.press('ArrowDown')
  })
})
