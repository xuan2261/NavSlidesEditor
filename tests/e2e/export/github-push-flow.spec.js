import { test, expect } from '../fixtures/test-fixtures.js'

const PUSH_URL = 'https://github.com/e2e-owner/e2e-repo/tree/main/auto_e2e_fixture'

/**
 * Mock the three GitHub endpoints the modal touches. The /config GET is
 * state-based (it reflects whether /config has been POSTed) so the test does not
 * depend on how many times the modal polls on mount — that count differs between
 * the dev server and a production build under StrictMode.
 */
async function installGithubMocks(page) {
  let configured = false
  let pushBody = null
  let configBody = null

  await page.route('**/api/github/config', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      configBody = req.postDataJSON()
      configured = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          owner: configBody.owner,
          repo: configBody.repo,
          hasToken: !!configBody.token,
        }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        configured
          ? { owner: 'e2e-owner', repo: 'e2e-repo', hasToken: true }
          : { owner: '', repo: '', hasToken: false }
      ),
    })
  })

  await page.route('**/api/presentations/*/github/push', async (route) => {
    pushBody = route.request().postDataJSON()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, commitSha: 'abc123', url: PUSH_URL }),
    })
  })

  return { getPushBody: () => pushBody, getConfigBody: () => configBody }
}

test.describe('GitHub push flow', () => {
  test('configures repo, pushes, and surfaces success with the commit payload', async ({
    page,
    testPresentation,
  }) => {
    const mocks = await installGithubMocks(page)

    await page.goto(`/editor/${testPresentation.id}`)
    await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 30000 })

    await page.getByTestId('ribbon-file-menu-trigger').click()
    await page.getByRole('menuitem', { name: 'Save to GitHub' }).click()

    const dialog = page.getByRole('dialog', { name: 'Save to GitHub' })
    await expect(dialog).toBeVisible()

    await dialog.getByPlaceholder('username or org').fill('e2e-owner')
    await dialog.getByPlaceholder('my-presentations').fill('e2e-repo')
    await dialog.getByPlaceholder('ghp_...').fill('ghp_e2e_token')
    await dialog.getByRole('button', { name: 'Save Settings' }).click()

    // owner, repo and commit are the only text-type inputs (the PAT field is a
    // password input, which is not exposed as a textbox), so the commit message
    // field is the last textbox in the dialog.
    await dialog.getByRole('textbox').last().fill('E2E commit message')

    const pushBtn = dialog.getByRole('button', { name: 'Push to GitHub' })
    await expect(pushBtn).toBeEnabled()
    await pushBtn.click()

    await expect(dialog.getByText('Pushed to GitHub')).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'View' })).toHaveAttribute('href', PUSH_URL)

    expect(mocks.getConfigBody()).toMatchObject({
      owner: 'e2e-owner',
      repo: 'e2e-repo',
      token: 'ghp_e2e_token',
    })
    expect(mocks.getPushBody()).toMatchObject({ message: 'E2E commit message' })
  })
})
