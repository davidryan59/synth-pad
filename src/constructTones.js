import * as Tone from 'tone'

// Make a simple oscillator with gain controlled by a signal
// and frequency controlled by a main signal and a multiplier
// Optional custom distortion control (since Tone.Distortion has only fixed distortion)
export const addFMOsc = ({
    freq, // audioNode to control base frequency of this oscillator
    needStart, // function to add audioNode to list of nodes to start later
    type = 'sine', // optional, specify type of oscillator
    fm = 1, // optional, initial value of frequency multiplier
    output = null, // optional, where to send the output
    distortion = false // if true, adds a distortion control taking values 1 to 10 (or above)
}) => {
    const freqMultiplierGain = new Tone.Gain(fm)
    const oscNode = needStart(new Tone.Oscillator(0, type))
    const oscGain = new Tone.Gain(0)
    freq.connect(freqMultiplierGain)
    freqMultiplierGain.connect(oscNode.frequency)
    let distort = null
    if (distortion) {
        const distortGain = new Tone.Gain(1)
        distort = distortGain.gain
        const shaper = new Tone.WaveShaper([-1, 1])
        oscNode.connect(distortGain)
        distortGain.connect(shaper)
        shaper.connect(oscGain)
    } else {
        oscNode.connect(oscGain)
    }
    if (output) oscGain.connect(output)
    const result = {
        gain: oscGain.gain,
        fm: freqMultiplierGain.gain,
        distort
    }
    console.log('addFMOsc ran with result:')
    console.log(result)
    return result
}

// Make a noise generator with gain control
export const addNoise = ({
    needStart, // function to add audioNode to list of nodes to start later
    type = 'white', // optional, specify type of noise
    output = null // optional, where to send the output
}) => {
    const noiseNode = needStart(new Tone.Noise(type))
    const noiseGain = new Tone.Gain(0)
    noiseNode.connect(noiseGain)
    if (output) noiseGain.connect(output)
    const result = {
        gain: noiseGain.gain
    }
    console.log('addNoise ran with result:')
    console.log(result)
    return result
}

// Tone.CrossFade is an equal power fader
// https://tonejs.github.io/docs/r13/CrossFade
// Here we manually construct an equal amplitude fader,
// which is more suitable for highly correlated audio
// such as mixing two oscillators with the same frequency
export const addFader = ({
    value, // numeric
    fade0, // AudioParam
    fade1 // AudioParam
}) => {
    const const1Signal = new Tone.Signal(1)
    const faderSubtract = new Tone.Subtract(0)
    const faderSignal = new Tone.Signal({
        value,
        minValue: 0,
        maxValue: 1
    })
    const1Signal.connect(faderSubtract)
    faderSignal.connect(faderSubtract.subtrahend)
    faderSubtract.connect(fade0) // 1 - value
    faderSignal.connect(fade1)   // value
    const result = {
        fader: faderSignal
    }
    console.log('addFader ran with result:')
    console.log(result)
    return result
}

// A resonator doubles gain at f, 3f, 5f...
// and cancels out gain at 0, 2f, 4f..., hence eliminates all direct current (DC).
// Resonant frequency f oscillates between min and max values, with specified period
export const addResonator = ({
    needStart,
    nodeIn,
    nodeOut,
    counter,
    minHz,
    maxHz,
    periodS
}) => {
    // Gain of -1, then a delay, gives t = 1 / 2f for delay time t and resonant frequency f
    // Frequencies f, 3f, 5f... are boosted by 2x
    // Frequencies 2f, 4f, 6f... are cancelled out
    const minDelayTimeS = 1 / (2 * maxHz)
    const maxDelayTimeS = 1 / (2 * minHz)
    const midDelayTimeS = 0.5 * (minDelayTimeS + maxDelayTimeS)
    const ampDelayTimeS = Math.abs(maxDelayTimeS - midDelayTimeS)
    console.log(`Delay times: min ${minDelayTimeS}, mid ${midDelayTimeS}, max ${maxDelayTimeS}, ampl ${ampDelayTimeS}`)
    const delayOsc = needStart(new Tone.Oscillator(1 / periodS, 'sine'))
    const delayGainOsc = new Tone.Gain(ampDelayTimeS)
    const delayNode = new Tone.Delay(1) // max delay time of 1s
    delayNode.delayTime.value = midDelayTimeS
    nodeIn.connect(delayNode)
    delayNode.connect(nodeOut)
    delayOsc.connect(delayGainOsc)
    delayGainOsc.connect(delayNode.delayTime)
    const result = {
        newCount: counter()
    }
    console.log('addResonator ran with result:')
    console.log(result)
    return result     
}
