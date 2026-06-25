export function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = 0.12

    if (type === 'error') {
      osc.frequency.value = 280
      osc.type = 'square'
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
      setTimeout(() => {
        const ctx2 = new (window.AudioContext || window.webkitAudioContext)()
        const osc2 = ctx2.createOscillator()
        const gain2 = ctx2.createGain()
        osc2.connect(gain2); gain2.connect(ctx2.destination)
        gain2.gain.value = 0.12
        osc2.frequency.value = 220
        osc2.type = 'square'
        osc2.start()
        osc2.stop(ctx2.currentTime + 0.25)
      }, 250)
    } else {
      osc.frequency.value = 880
      osc.type = 'sine'
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    }
  } catch {
  }
}
