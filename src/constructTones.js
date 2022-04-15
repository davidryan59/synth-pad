import * as Tone from 'tone'

// Make a simple oscillator with gain controlled by a signal
// and frequency controlled by a main signal and a multiplier
export const addFMOsc = ({
    freq, // audioNode to control base frequency of this oscillator
    needStart, // function to add audioNode to list of nodes to start later
    type = 'sine', // optionally specify type of oscillator
    fm = 1, // optional, initial value of frequency multiplier
    output = null // optional, where to send the output
}) => {
    const oscFMult1 = new Tone.Gain(fm)
    const oscNode1 = needStart(new Tone.Oscillator(0, type))
    const oscGain1 = new Tone.Gain(0)
    freq.connect(oscFMult1)
    oscFMult1.connect(oscNode1.frequency)
    oscNode1.connect(oscGain1)
    if (output) oscGain1.connect(output)
    const result = {
        gain: oscGain1.gain,
        fm: oscFMult1.gain
    }
    console.log('addFMOsc ran with result:')
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