export const constructTones = ({
    Tone,
    needStart,
    logger
}) => {
    const ct = {}

    // Constant signals or nodes that require no extra setup
    ct.signal1 = new Tone.Signal(1)
    ct.whiteNoise = needStart(new Tone.Noise('white'))
    ct.pinkNoise = needStart(new Tone.Noise('pink'))
    ct.brownNoise = needStart(new Tone.Noise('brown'))

    // Make a simple oscillator with gain controlled by a signal
    // and frequency controlled by a main signal and a multiplier
    ct.addOsc = ({
        freq, // audioNode to control base frequency of this oscillator
        type = 'sine', // optional, specify type of oscillator
        fm = 1 // optional, initial value of frequency multiplier
    }) => {
        const freqMultiplierGain = new Tone.Gain(fm)
        const oscNode = needStart(new Tone.Oscillator(0, type))
        freq.connect(freqMultiplierGain)
        freqMultiplierGain.connect(oscNode.frequency)
        const result = {
            output: oscNode,
            fm: freqMultiplierGain.gain
        }
        logger('addOsc ran with result:')
        logger(result)
        return result
    }

    // Tone.CrossFade is an equal power fader
    // https://tonejs.github.io/docs/r13/CrossFade
    // Here we manually construct an equal amplitude fader,
    // which is more suitable for highly correlated audio
    // such as mixing two oscillators with the same frequency
    ct.addFader = ({
        input0,
        input1,
        value // optional, numeric initial value
    }) => {
        const fader = new Tone.Signal({ value: value || 0, minValue: 0, maxValue: 1 })
        const subtractor = new Tone.Subtract(0)
        const inputGain0 = new Tone.Gain(0)
        const inputGain1 = new Tone.Gain(0)
        const outputGain = new Tone.Gain(1)
        ct.signal1.connect(subtractor)
        fader.connect(subtractor.subtrahend)
        subtractor.connect(inputGain0.gain) // 1 - value
        fader.connect(inputGain1.gain)   // value
        input0.connect(inputGain0)
        input1.connect(inputGain1)
        inputGain0.connect(outputGain)
        inputGain1.connect(outputGain)
        const result = {
            output: outputGain,
            fader: fader
        }
        logger('addFader ran with result:')
        logger(result)
        return result
    }

    // A resonator doubles gain at f, 3f, 5f...
    // and cancels out gain at 0, 2f, 4f..., hence eliminates all direct current (DC).
    // Resonant frequency f oscillates between min and max values, with specified period
    const addResonator = ({
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
        logger(`Delay times: min ${minDelayTimeS}, mid ${midDelayTimeS}, max ${maxDelayTimeS}, ampl ${ampDelayTimeS}`)
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
        logger('addResonator ran with result:')
        logger(result)
        return result     
    }

    // Cancel out any DC using 1 or more Resonators (recommend 2 to 4)
    ct.addResonators = ({
        data
    }) => {
        const layer1In = new Tone.Gain(1)
        const layer1Out = new Tone.Gain(1)
        const layer2In = new Tone.Gain(0)
        const layer2Out = new Tone.Gain(1)
        layer1In.connect(layer2In)
        layer2Out.connect(layer1Out)
        layer1In.connect(layer1Out)
        let countResonators = 0
        const counter = () => countResonators += 1
        const nodeIn = layer2In
        const nodeOut = layer2Out;
        data.forEach(item => addResonator({
            counter,
            nodeIn,
            nodeOut,
            minHz: item.minHz,
            maxHz: item.maxHz,
            periodS: item.periodS
        }))
        if (countResonators > 0) layer2In.gain.value = -1 / countResonators
        const result = {
            input: layer1In,
            output: layer1Out,
            wet: layer2Out.gain
        }
        logger('addResonators ran with result:')
        logger(result)
        return result
    }

    ct.addMasterBox = ({
        initVol,
        reverbTimeS,
        reverbWet
    }) => {
        const masterVolumeGain = new Tone.Gain(initVol)
        const masterReverbLong = new Tone.Reverb(reverbTimeS)
        masterReverbLong.wet.value = reverbWet
        const masterSwitchGain = new Tone.Gain(0)
        masterVolumeGain.connect(masterReverbLong)
        masterReverbLong.connect(masterSwitchGain)
        masterSwitchGain.toDestination()
        const result = {
            input: masterVolumeGain,
            gain: masterVolumeGain.gain,
            switch: masterSwitchGain.gain,
            reverb: masterReverbLong.wet
        }
        logger('addMasterBox ran with result:')
        logger(result)
        return result    
    }

    logger('constructTones ran with result:')
    logger(ct)
    return ct
}

