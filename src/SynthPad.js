// import React, { useState, useEffect } from 'react';
import React, { useState } from 'react'
import './SynthPad.css';
import * as Tone from 'tone'
import { randint } from './helpers'
import { getRandomTune } from './music'
import { addFMOsc, addNoise, addFader, addResonator } from './constructTones'

const UPDATE_PARAM_TIME_S = 0.015
const INITIAL_VOLUME = 0.10
const INITIAL_BASE_FREQ_HZ = 120 + 25 * Math.floor(15 * Math.random())
const INITIAL_TONE_RATIO = 0.15
const INITIAL_DISTORTION = 1.30
const INITIAL_OVERTONE_MULT = 2.00
const INITIAL_DELAY_BOX_GAIN = 1.00
const LONG_REVERB_TIME_S = 2
const LONG_REVERB_WET = 0.2
const TUNE_TIME_S = 5.0

const nodesToStart = []
const needStart = n => {nodesToStart.push(n); return n}

const baseFreqSignal = new Tone.Signal(INITIAL_BASE_FREQ_HZ)
const oscsOut = new Tone.Gain(1)
const layer1In = new Tone.Gain(1)
const layer1Out = new Tone.Gain(1)
const layer2In = new Tone.Gain(0)
const layer2Out = new Tone.Gain(0)
const masterVolumeGain = new Tone.Gain(INITIAL_VOLUME)
const masterReverbLong = new Tone.Reverb(LONG_REVERB_TIME_S)
masterReverbLong.wet.value = LONG_REVERB_WET
const masterSwitchGain = new Tone.Gain(0)
oscsOut.connect(layer1In)
layer1In.connect(layer2In)
layer2Out.connect(layer1Out)
layer1In.connect(layer1Out)
layer1Out.connect(masterVolumeGain)
masterVolumeGain.connect(masterReverbLong)
masterReverbLong.connect(masterSwitchGain)
masterSwitchGain.toDestination()

const { gain: oscg0, distort: d0 } = addFMOsc({ type: 'sine', needStart, output: oscsOut, freq: baseFreqSignal, distortion: true })
const { gain: oscg1, fm: fm1 } = addFMOsc({ type: 'sawtooth', needStart, output: oscsOut, freq: baseFreqSignal, fm: INITIAL_OVERTONE_MULT })
const { gain: noiseGain } = addNoise({ type: 'white', needStart, output: oscsOut })
const { fader: fader01 } = addFader({ value: INITIAL_TONE_RATIO, fade0: oscg0, fade1: oscg1 })
// const { fader: fader01 } = addFader({ value: INITIAL_TONE_RATIO, fade0: oscg0, fade1: noiseGain }) // Working alternative

// Cancel out any DC using 1 or more Resonators (recommend 2 to 4)
let countResonators = 0
const counter = () => countResonators += 1
const nodeIn = layer2In
const nodeOut = layer2Out;
addResonator({ needStart, counter, nodeIn, nodeOut, minHz: 15,  maxHz: 50,  periodS: 127/10 })
addResonator({ needStart, counter, nodeIn, nodeOut, minHz: 50,  maxHz: 200,  periodS: 113/10 })
addResonator({ needStart, counter, nodeIn, nodeOut, minHz: 200,  maxHz: 1000,  periodS: 97/10 })
addResonator({ needStart, counter, nodeIn, nodeOut, minHz: 1000,  maxHz: 22050,  periodS: 79/10 })
if (countResonators > 0) layer2In.gain.value = -1 / countResonators
layer2Out.gain.value = INITIAL_DELAY_BOX_GAIN


const SynthPad = () => {
    
    const [needsInitialStart, setNeedsInitialStart] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)

    const [baseFreqValue, setBaseFreqValue] = useState(INITIAL_BASE_FREQ_HZ)
    const [masterVolumeGainValue, setMasterVolumeGainValue] = useState(INITIAL_VOLUME)
    const [distortionValue, setDistortionValue] = useState(INITIAL_DISTORTION)
    const [toneRatioValue, setToneRatioValue] = useState(INITIAL_TONE_RATIO)
    const [overtoneMultValue, setOvertoneMultValue] = useState(INITIAL_OVERTONE_MULT)
    const [delayBoxGainValue, setDelayBoxGainValue] = useState(INITIAL_DELAY_BOX_GAIN)
    const [longReverbWetValue, setLongReverbWetValue] = useState(LONG_REVERB_WET)
    
    const updateBaseFreq = e => updateFn(e, baseFreqSignal, setBaseFreqValue, v => `New base freq: ${v} Hz`)
    const updateMasterVolume = e => updateFn(e, masterVolumeGain.gain, setMasterVolumeGainValue, v => `New master volume: ${v}`)
    const updateDistortion = e => updateFn(e, d0, setDistortionValue, v => `New distortion: ${v}`)
    const updateToneRatio = e => updateFn(e, fader01, setToneRatioValue, v => `New tone ratio: ${v}`)
    const updateOvertoneMult = e => updateFn(e, fm1, setOvertoneMultValue, v => `New overtone mult: ${v}`)
    const updateDelayBoxGain = e => updateFn(e, layer2Out.gain, setDelayBoxGainValue, v => `New delay box gain: ${v}`)
    const updateLongReverbWet = e => updateFn(e, masterReverbLong.wet, setLongReverbWetValue, v => `New long reverb wet: ${v}`)
    
    const updateFn = (e, audioParam, setter, logFn) => {
        const newVal = e.target.value
        audioParam.setTargetAtTime(newVal, Tone.now(), UPDATE_PARAM_TIME_S)
        setter(newVal)
        console.log(logFn(newVal))
    }
    
    const initialStart = () => {
        console.log(`Starting ${nodesToStart.length} audio nodes...`)
        nodesToStart.forEach(n => n.start())
    }
    
    // Fade in the MasterGainNode gain value to masterGainValue on mouseDown by .001 seconds
    const togglePlay = () => {  
        if (needsInitialStart) {
            initialStart()
            setNeedsInitialStart(false)
        }
        if (!isPlaying) {
            rampMainSwitchGain(1)
            setIsPlaying(true)
        } else {
            rampMainSwitchGain(0)
            setIsPlaying(false)
        }
    }
    
    const rampMainSwitchGain = v => {
        masterSwitchGain.gain.setTargetAtTime(v, Tone.now(), UPDATE_PARAM_TIME_S)
    }

    const playTune = () => {
        // Cache some values
        const timeNowS = Tone.now()
        const baseFreqHz = baseFreqValue
        console.log(timeNowS, baseFreqHz)
        // Get a tune
        const tune = getRandomTune({
            size: randint(12, 20),
            minNum: 8,
            maxNum: 12,
            minDenom: 3,
            maxDenom: 4,
            maxStep: 1,
            minBeats: 1,
            maxBeats: 2
        })
        const beatTimeS = TUNE_TIME_S / tune.totalBeats
        // Play a tune
        const displayFreqs = []
        let beatSum = 0
        tune.notes.forEach(note => {
            const thisFreqHz = baseFreqHz * (note.freqNum / note.freqDenom) / tune.fMult
            baseFreqSignal.setValueAtTime(thisFreqHz, timeNowS + beatSum * beatTimeS)
            beatSum += note.beats
            displayFreqs.push(Math.floor(thisFreqHz * 100) / 100)
        })
        // Reset to original frequency
        baseFreqSignal.setValueAtTime(baseFreqHz, timeNowS + beatSum * beatTimeS)
        console.log(displayFreqs)
    }

    return (
        <div className="App">
            <button
                onMouseDown={togglePlay}
                className='play'
            >
                {isPlaying?'Pause':'Play'}
            </button>
            <button
                onMouseDown={playTune}
                className='playTune'
            >
                Play random Tune
            </button>
            <p>Base Freq (Hz): </p>
            <input
                type="range"
                min='60'
                max='480'
                step='15'
                value={baseFreqValue}
                onChange={updateBaseFreq}
            />
            <p>Master Volume: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.01'
                value={masterVolumeGainValue}
                onChange={updateMasterVolume}
            />
            <p>Distortion: </p>
            <input
                type="range"
                min='1'
                max='10'
                step='0.1'
                value={distortionValue}
                onChange={updateDistortion}
            />
            <p>Tone Ratio: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.01'
                value={toneRatioValue}
                onChange={updateToneRatio}
            />
            <p>Overtone Mult: </p>
            <input
                type="range"
                min='0.5'
                max='5'
                step='0.5'
                value={overtoneMultValue}
                onChange={updateOvertoneMult}
            />
            <p>Delay Box Gain: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.1'
                value={delayBoxGainValue}
                onChange={updateDelayBoxGain}
            />
            <p>Long Reverb: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.05'
                value={longReverbWetValue}
                onChange={updateLongReverbWet}
            />
        </div>
    );
}

export default SynthPad;
