// import React, { useState, useEffect } from 'react';
import React, { useState } from 'react';
import './SynthPad.css';
import * as Tone from 'tone'
import { randint } from './helpers'
import { getRandomTune } from './music'

const UPDATE_PARAM_TIME_S = 0.015
const INITIAL_VOLUME = 0.2
const INITIAL_BASE_FREQ_HZ = 240
const INITIAL_TONE_RATIO = 0.1
const INITIAL_OVERTONE_MULT = 2
const INITIAL_DELAY_BOX_GAIN = 1
const TUNE_TIME_S = 5

const nodesToStart = []
const needStart = n => {nodesToStart.push(n); return n}

const oneConstSignal = new Tone.Signal(1)
const baseFreqSignal = new Tone.Signal(INITIAL_BASE_FREQ_HZ)
const toneRatioSignal = new Tone.Signal(INITIAL_TONE_RATIO)
const toneRatioSubtract = new Tone.Subtract(0)

const oscFMult1 = new Tone.Gain(1)
const oscFMult2 = new Tone.Gain(INITIAL_OVERTONE_MULT)
const oscNode1 = needStart(new Tone.Oscillator(0, 'triangle'))
const oscNode2 = needStart(new Tone.Oscillator(0, 'sawtooth'))
const oscGain1 = new Tone.Gain(0)
const oscGain2 = new Tone.Gain(0)
const oscGain = new Tone.Gain(1)

baseFreqSignal.connect(oscFMult1)
baseFreqSignal.connect(oscFMult2)
oscFMult1.connect(oscNode1.frequency)
oscFMult2.connect(oscNode2.frequency)

toneRatioSignal.connect(oscGain2.gain)
oneConstSignal.connect(toneRatioSubtract)
toneRatioSignal.connect(toneRatioSubtract.subtrahend)
toneRatioSubtract.connect(oscGain1.gain)

const layer1In = new Tone.Gain(1)
const layer1Out = new Tone.Gain(1)
const layer2In = new Tone.Gain(0)
const layer2Out = new Tone.Gain(0)

oscNode1.connect(oscGain1)
oscNode2.connect(oscGain2)
oscGain1.connect(oscGain)
oscGain2.connect(oscGain)
oscGain.connect(layer1In)
layer1In.connect(layer2In)
layer2Out.connect(layer1Out)
layer1In.connect(layer1Out)

const masterVolumeGain = new Tone.Gain(INITIAL_VOLUME)
const masterSwitchGain = new Tone.Gain(0)
layer1Out.connect(masterVolumeGain)
masterVolumeGain.connect(masterSwitchGain)
masterSwitchGain.toDestination()

let countDelays = 0
// const addDelay = (delayTimeMinS, delayTimeMaxS, oscTimeS) => {
const addDelay = (nodeIn, nodeOut, minResHz, maxResHz, oscTimeS) => {
    const minDelayTimeS = 1 / minResHz
    const maxDelayTimeS = 1 / maxResHz
    const midDelayTimeS = 0.5 * (minDelayTimeS + maxDelayTimeS)
    const delayOsc = needStart(new Tone.Oscillator(1 / oscTimeS, 'triangle'))
    const delayGainOsc = new Tone.Gain(maxDelayTimeS - midDelayTimeS)
    const delayNode = new Tone.Delay(1) // max delay time of 1s
    delayNode.delayTime.value = midDelayTimeS
    nodeIn.connect(delayNode)
    delayNode.connect(nodeOut)
    delayOsc.connect(delayGainOsc)
    delayGainOsc.connect(delayNode.delayTime)
    countDelays++    
}
addDelay(layer2In, layer2Out, 200, 1000, 13/10)
addDelay(layer2In, layer2Out, 400, 8000, 17/10)
// addDelay(layer2In, layer2Out, 2000, 10000, 23/10)
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
    const updateToneRatio = e => updateFn(e, toneRatioSignal, setToneRatioValue, v => `New tone ratio: ${v}`)
    const updateOvertoneMult = e => updateFn(e, oscFMult2.gain, setOvertoneMultValue, v => `New overtone mult: ${v}`)
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
