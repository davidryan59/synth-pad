// import React, { useState, useEffect } from 'react';
import React, { useState } from 'react'
import './SynthPad.css';
import * as Tone from 'tone'
import { randint } from './helpers'
import { getRandomTune } from './music'
import { addOsc, addNoise, addFader, addResonators, addMasterBox } from './constructTones'

const UPDATE_PARAM_TIME_S = 0.015
const INITIAL_VOLUME = 0.10
const INITIAL_BASE_FREQ_HZ = 120 + 25 * Math.floor(15 * Math.random())
const INITIAL_NOISE_RATIO = 0.01
const INITIAL_TONE_RATIO = 0.15
const INITIAL_OVERTONE_MULT = 2.00
const LONG_REVERB_TIME_S = 2
const LONG_REVERB_WET = 0.2
const TUNE_TIME_S = 5.0

const nodesToStart = []
const needStart = n => {nodesToStart.push(n); return n}

const baseFreqSignal = new Tone.Signal(INITIAL_BASE_FREQ_HZ)

const { output: osc0 } = addOsc({ type: 'triangle', needStart, freq: baseFreqSignal })
const { output: osc1, fm: fm1 } = addOsc({ type: 'sawtooth', needStart, freq: baseFreqSignal, fm: INITIAL_OVERTONE_MULT })
const { output: noise } = addNoise({ type: 'white', needStart })
const { output: osc01, fader: faderTone } = addFader({ input0: osc0, input1: osc1, value: INITIAL_TONE_RATIO })
const { output: oscs, fader: faderNoise } = addFader({ input0: osc01, input1: noise, value: INITIAL_NOISE_RATIO })
const oscGain = new Tone.Gain(1)
oscs.connect(oscGain)

const data = [
    { minHz: 15,  maxHz: 50,  periodS: 127/10 },
    { minHz: 50,  maxHz: 200,  periodS: 113/10 },
    { minHz: 200,  maxHz: 1000,  periodS: 97/10 },
    { minHz: 1000,  maxHz: 22050,  periodS: 79/10 }
]
const { input: resInput, output: resOutput, wet: resWet } = addResonators({ data, needStart })
oscGain.connect(resInput)

const { input: mstrIn, gain: mstrGn, switch: mstrSw, reverb: mstrRv } = addMasterBox({ initVol: INITIAL_VOLUME, reverbTimeS: LONG_REVERB_TIME_S, reverbWet: LONG_REVERB_WET })
resOutput.connect(mstrIn)


const SynthPad = () => {
    
    const [needsInitialStart, setNeedsInitialStart] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)

    const [baseFreqValue, setBaseFreqValue] = useState(INITIAL_BASE_FREQ_HZ)
    const [masterVolumeGainValue, setMasterVolumeGainValue] = useState(INITIAL_VOLUME)
    const [noiseRatioValue, setNoiseRatioValue] = useState(INITIAL_NOISE_RATIO)
    const [toneRatioValue, setToneRatioValue] = useState(INITIAL_TONE_RATIO)
    const [overtoneMultValue, setOvertoneMultValue] = useState(INITIAL_OVERTONE_MULT)
    const [resonatorsGainValue, setResonatorsGainValue] = useState(1)
    const [longReverbWetValue, setLongReverbWetValue] = useState(LONG_REVERB_WET)
    
    const updateBaseFreq = e => updateFn(e, baseFreqSignal, setBaseFreqValue, v => `New base freq: ${v} Hz`)
    const updateMasterVolume = e => updateFn(e, mstrGn, setMasterVolumeGainValue, v => `New master volume: ${v}`)
    const updateNoiseRatio = e => updateFn(e, faderNoise, setNoiseRatioValue, v => `New noise ratio: ${v}`)
    const updateToneRatio = e => updateFn(e, faderTone, setToneRatioValue, v => `New tone ratio: ${v}`)
    const updateOvertoneMult = e => updateFn(e, fm1, setOvertoneMultValue, v => `New overtone mult: ${v}`)
    const updateResonatorsGain = e => updateFn(e, resWet, setResonatorsGainValue, v => `New resonators gain: ${v}`)
    const updateLongReverbWet = e => updateFn(e, mstrRv, setLongReverbWetValue, v => `New long reverb wet: ${v}`)
    
    const updateFn = (e, audioParam, setter, logFn) => {
        const newVal = e.target.value
        console.log(audioParam)
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
        mstrSw.setTargetAtTime(v, Tone.now(), UPDATE_PARAM_TIME_S)
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
        let thisS = timeNowS + beatSum * beatTimeS
        tune.notes.forEach(note => {
            const thisFreqHz = baseFreqHz * (note.freqNum / note.freqDenom) / tune.fMult
            // const thisS = timeNowS + beatSum * beatTimeS
            baseFreqSignal.setValueAtTime(thisFreqHz, thisS)
            // baseFreqSignal.setTargetAtTime(thisFreqHz, thisS, 0.2) // Alternative
            const noiseGain = 0.2
            const noiseOnsetTimeS = 0.0001
            const noiseLengthS = 0.05
            faderNoise.setTargetAtTime(noiseGain, thisS, noiseOnsetTimeS)
            faderNoise.setTargetAtTime(0, thisS + noiseOnsetTimeS, noiseLengthS)

            const noteOnsetTimeS = 0.01
            const noteSustainTimeS = 0.02
            const holdGain = 0.7
            const noteLengthS = 1
            oscGain.gain.setTargetAtTime(1, thisS, noteOnsetTimeS)
            oscGain.gain.setTargetAtTime(holdGain, thisS + noteOnsetTimeS + noteSustainTimeS, noteLengthS)
            beatSum += note.beats
            displayFreqs.push(Math.floor(thisFreqHz * 100) / 100)
            thisS = timeNowS + beatSum * beatTimeS
        })
        // Reset to original frequency
        // const thisS = timeNowS + beatSum * beatTimeS
        baseFreqSignal.setValueAtTime(baseFreqHz, thisS)
        faderNoise.setTargetAtTime(0, thisS, 2)
        oscGain.gain.setTargetAtTime(1, thisS, 2)
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
            <p>Noise Ratio: </p>
            <input
                type="range"
                min='0'
                max='0.1'
                step='0.001'
                value={noiseRatioValue}
                onChange={updateNoiseRatio}
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
            <p>Resonators Gain: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.1'
                value={resonatorsGainValue}
                onChange={updateResonatorsGain}
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
