import * as Tone from 'tone'

// Tone.CrossFade is an equal power fader
// https://tonejs.github.io/docs/r13/CrossFade
// Here we manually construct an equal amplitude fader,
// which is more suitable for highly correlated audio
// such as mixing two oscillators with the same frequency
export const addFaderSignal = ({
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
        faderSignal
    }
    console.log('addFaderSignal ran with result:')
    console.log(result)
    return result
}