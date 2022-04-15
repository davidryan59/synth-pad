// import React, { useState, useEffect } from 'react';
import React, { useState } from 'react'
import './SynthPad.css';
import * as Tone from 'tone'
import { randint } from './helpers'
import { getRandomTune } from './music'
import { addFMOsc, addNoise, addFader } from './constructTones'

const UPDATE_PARAM_TIME_S = 0.015
const INITIAL_VOLUME = 0.1
const INITIAL_BASE_FREQ_HZ = 120 + 25 * Math.floor(15 * Math.random())
const INITIAL_TONE_RATIO = 0.2
const INITIAL_OVERTONE_MULT = 1
const INITIAL_DELAY_BOX_GAIN = 1
const TUNE_TIME_S = 5

const nodesToStart = []
const needStart = n => {nodesToStart.push(n); return n}

const baseFreqSignal = new Tone.Signal(INITIAL_BASE_FREQ_HZ)
const oscsOut = new Tone.Gain(1)

const { gain: oscg0, fm: fm0 } = addFMOsc({ type: 'triangle', needStart, output: oscsOut, freq: baseFreqSignal, fm: 1 })
const { gain: oscg1, fm: fm1 } = addFMOsc({ type: 'sawtooth', needStart, output: oscsOut, freq: baseFreqSignal, fm: INITIAL_OVERTONE_MULT })
const { gain: noiseGain } = addNoise({ type: 'white', needStart, output: oscsOut })
const { fader: fader01 } = addFader({ value: INITIAL_TONE_RATIO, fade0: oscg0, fade1: oscg1 })
// const { fader: fader01 } = addFader({ value: INITIAL_TONE_RATIO, fade0: oscg0, fade1: noiseGain }) // Working alternative

const layer1In = new Tone.Gain(1)
const layer1Out = new Tone.Gain(1)
const layer2In = new Tone.Gain(0)
const layer2Out = new Tone.Gain(0)

oscsOut.connect(layer1In)
layer1In.connect(layer2In)
layer2Out.connect(layer1Out)
layer1In.connect(layer1Out)

const masterVolumeGain = new Tone.Gain(INITIAL_VOLUME)
const masterSwitchGain = new Tone.Gain(0)
layer1Out.connect(masterVolumeGain)
masterVolumeGain.connect(masterSwitchGain)
masterSwitchGain.toDestination()

let countDelays = 0
const addOscillatingResonator = (minResHz, maxResHz, oscPeriodS) => {
    // Gain of -1, then a delay, gives t = 1 / 2f for delay time t and resonant frequency f
    // Frequencies f, 3f, 5f... are boosted by 2x
    // Frequencies 2f, 4f, 6f... are cancelled out
    const minDelayTimeS = 1 / (2 * maxResHz)
    const maxDelayTimeS = 1 / (2 * minResHz)
    const midDelayTimeS = 0.5 * (minDelayTimeS + maxDelayTimeS)
    const ampDelayTimeS = Math.abs(maxDelayTimeS - midDelayTimeS)
    console.log(`Delay times: min ${minDelayTimeS}, mid ${midDelayTimeS}, max ${maxDelayTimeS}, ampl ${ampDelayTimeS}`)
    const delayOsc = needStart(new Tone.Oscillator(1 / oscPeriodS, 'sine'))
    const delayGainOsc = new Tone.Gain(ampDelayTimeS)
    const delayNode = new Tone.Delay(1) // max delay time of 1s
    delayNode.delayTime.value = midDelayTimeS
    layer2In.connect(delayNode)
    delayNode.connect(layer2Out)
    delayOsc.connect(delayGainOsc)
    delayGainOsc.connect(delayNode.delayTime)
    countDelays++    
}
addOscillatingResonator(17.1, 29.9, 89/10)
addOscillatingResonator(181, 299, 53/10)
// addOscillatingResonator(451, 719, 73/10)
// addOscillatingResonator(637, 1057, 97/10)
layer2In.gain.value = -1 / countDelays
layer2Out.gain.value = INITIAL_DELAY_BOX_GAIN


const SynthPad = () => {
    
    const [needsInitialStart, setNeedsInitialStart] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)

    const [baseFreqValue, setBaseFreqValue] = useState(INITIAL_BASE_FREQ_HZ)
    const [masterVolumeGainValue, setMasterVolumeGainValue] = useState(INITIAL_VOLUME)
    const [toneRatioValue, setToneRatioValue] = useState(INITIAL_TONE_RATIO)
    const [overtoneMultValue, setOvertoneMultValue] = useState(INITIAL_OVERTONE_MULT)
    const [delayBoxGainValue, setDelayBoxGainValue] = useState(INITIAL_DELAY_BOX_GAIN)

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

    const updateFn = (e, audioParam, setter, logFn) => {
        const newVal = e.target.value
        audioParam.setTargetAtTime(newVal, Tone.now(), UPDATE_PARAM_TIME_S)
        setter(newVal)
        console.log(logFn(newVal))
    }

    const updateBaseFreq = e => updateFn(e, baseFreqSignal, setBaseFreqValue, v => `New base freq: ${v} Hz`)
    const updateMasterVolume = e => updateFn(e, masterVolumeGain.gain, setMasterVolumeGainValue, v => `New master volume: ${v}`)
    const updateToneRatio = e => updateFn(e, fader01, setToneRatioValue, v => `New tone ratio: ${v}`)
    const updateOvertoneMult = e => updateFn(e, fm1, setOvertoneMultValue, v => `New overtone mult: ${v}`)
    const updateDelayBoxGain = e => updateFn(e, layer2Out.gain, setDelayBoxGainValue, v => `New delay box gain: ${v}`)

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
        </div>
    );
}

export default SynthPad;
