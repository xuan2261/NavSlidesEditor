import { expect } from '@playwright/test'

async function restoreRange(frame, id, value) {
  const input = frame.locator(id)
  const { min, step } = await input.evaluate((node) => ({
    min: Number(node.min),
    step: Number(node.step || 1),
  }))
  await input.press('Home')
  for (let index = min; index < value; index += step) await input.press('ArrowRight')
  await expect(input).toHaveValue(String(value))
}
export async function interactSimulation(frame, id) {
  if (id === 'sim-logic-gates') {
    await frame.locator('#inA').click()
    await frame.locator('#inB').click()
    await expect(frame.locator('#outQ')).toHaveText('1')
    await frame.locator('#gate-type').selectOption('XOR')
    await expect(frame.locator('#outQ')).toHaveText('0')
    await frame.locator('#inB').click()
    await expect(frame.locator('#outQ')).toHaveText('1')
    await frame.locator('#gate-type').selectOption('AND')
    await frame.locator('#inA').click()
    await expect(frame.locator('#inA')).toHaveText('0')
    await expect(frame.locator('#inB')).toHaveText('0')
    await expect(frame.locator('#outQ')).toHaveText('0')
    return {
      andBothTrue: 1,
      xorBothTrue: 0,
      xorOneTrue: 1,
      resetOutput: await frame.locator('#outQ').textContent(),
      truthTable: await frame.locator('#tt-body').innerText(),
    }
  }
  if (id === 'sim-rlc-response') {
    const original = Number(await frame.locator('#sR').inputValue())
    await frame.locator('#sR').press('End')
    await expect(frame.locator('#vR')).toHaveText('2000 Ω')
    await expect(frame.locator('#iQ')).toHaveText('0.16')
    const changed = await frame.locator('#iB').innerText()
    expect(changed).toBe('15.9 kHz')
    await restoreRange(frame, '#sR', original)
    await expect(frame.locator('#iQ')).toHaveText('0.63')
    await expect(frame.locator('#iB')).toHaveText('4.0 kHz')
    return {
      changedBandwidth: changed,
      resetQuality: await frame.locator('#iQ').innerText(),
      resetBandwidth: await frame.locator('#iB').innerText(),
    }
  }
  if (id === 'sim-pid-tuning') {
    await frame.getByRole('button', { name: 'P-Only (Oscillates)', exact: true }).click()
    await expect(frame.locator('#vKp')).toHaveText('1.0')
    await expect(frame.locator('#vKi')).toHaveText('0.0')
    await expect(frame.locator('#vKd')).toHaveText('0.0')
    await expect
      .poll(async () => Math.abs(Number(await frame.locator('#mErr').innerText())))
      .toBeGreaterThan(1)
    const error = await frame.locator('#mErr').innerText()
    await frame.getByRole('button', { name: 'PID (Stable)', exact: true }).click()
    await expect(frame.locator('#vKp')).toHaveText('2.0')
    await expect(frame.locator('#vKi')).toHaveText('1.0')
    await expect(frame.locator('#vKd')).toHaveText('1.5')
    await frame.evaluate(() => {
      document.addEventListener(
        'click',
        (event) => {
          if (event.target.closest('button')?.textContent.trim() !== 'Reset') return
          window.__releaseResetObserved = {
            y: state.y,
            velocity: state.v,
            integral: state.integral,
            previousError: state.prevErr,
            time: state.time,
            history: history.length,
            target: state.target,
            kp: document.querySelector('#sKp').value,
            ki: document.querySelector('#sKi').value,
            kd: document.querySelector('#sKd').value,
          }
        },
        { once: true }
      )
    })
    await frame.getByRole('button', { name: 'Reset', exact: true }).click()
    const reset = await frame.evaluate(() => window.__releaseResetObserved)
    expect(reset).toEqual({
      y: 0,
      velocity: 0,
      integral: 0,
      previousError: 0,
      time: 0,
      history: 0,
      target: 50,
      kp: '20',
      ki: '10',
      kd: '15',
    })
    return { observedPhysicalError: error, physicalReset: reset }
  }
  if (id === 'sim-bode-plot') {
    await expect(frame.locator('#mPM')).toHaveText(/^(?:-?\d+\.\d+°|∞)$/)
    const originalMargin = await frame.locator('#mPM').innerText()
    const original = {
      numerator: await frame.locator('#iN').inputValue(),
      denominator: await frame.locator('#iD').inputValue(),
    }
    await frame.locator('#iN').fill('1')
    await frame.locator('#iD').fill('1,0')
    await frame.getByRole('button', { name: 'Bode Plot', exact: true }).click()
    await expect(frame.locator('#mPM')).toHaveText('90.0°')
    await expect(frame.locator('#mGM')).toHaveText('∞')
    await expect(frame.locator('#mStab')).toHaveText('Stable ✓')
    await frame.locator('#iN').fill(original.numerator)
    await frame.locator('#iD').fill(original.denominator)
    await frame.getByRole('button', { name: 'Bode Plot', exact: true }).click()
    await expect(frame.locator('#iN')).toHaveValue(original.numerator)
    await expect(frame.locator('#iD')).toHaveValue(original.denominator)
    await expect(frame.locator('#mPM')).toHaveText(originalMargin)
    return {
      integratorMargin: '90.0°',
      resetTransferFunction: original,
      resetMargin: await frame.locator('#mPM').innerText(),
    }
  }
  if (id === 'sim-3phase') {
    const original = Number(await frame.locator('#sI').inputValue())
    await frame.locator('#sI').press('End')
    await expect(frame.locator('#vI')).toHaveText('45°')
    await expect
      .poll(async () => Math.abs(Number(await frame.locator('#mSum').innerText())))
      .toBeGreaterThan(1)
    const imbalancedSum = await frame.locator('#mSum').innerText()
    await restoreRange(frame, '#sI', original)
    await expect
      .poll(async () => Math.abs(Number(await frame.locator('#mSum').innerText())))
      .toBeLessThan(0.01)
    return { imbalancedSum, resetBalancedSum: await frame.locator('#mSum').innerText() }
  }
  if (id === 'sim-gear-train') {
    const original = Number(await frame.locator('#sZ2').inputValue())
    await frame.getByRole('button', { name: 'Standard 2-Gear', exact: true }).click()
    await frame.locator('#sZ2').press('End')
    await expect(frame.locator('#mR')).toHaveText('2.50')
    await expect(frame.locator('#mN2')).toHaveText('240')
    await restoreRange(frame, '#sZ2', original)
    await expect(frame.locator('#mR')).toHaveText('1.50')
    await expect(frame.locator('#mN2')).toHaveText('400')
    return {
      changedRatio: '2.50',
      changedOutputRpm: '240',
      resetRatio: await frame.locator('#mR').innerText(),
      resetOutputRpm: await frame.locator('#mN2').innerText(),
    }
  }
  throw new Error(`No real simulation interaction for ${id}`)
}
export const simulationProbe = {
  'sim-logic-gates': '#gate-type',
  'sim-rlc-response': '#sR',
  'sim-pid-tuning': '#sKp',
  'sim-bode-plot': '#iN',
  'sim-3phase': '#sI',
  'sim-gear-train': '#sZ2',
}
