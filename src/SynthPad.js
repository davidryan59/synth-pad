import React, { useState } from 'react'
import './SynthPad.css';
import * as Tone from 'tone'
import { randint } from './helpers'
import { getRandomTune } from './music'
import { constructTones } from './constructTones'


const UPDATE_SLIDER_TIME_S = 0.005
const INITIAL_VOLUME = 0.10
const INITIAL_BASE_FREQ_HZ = 120 + 25 * Math.floor(15 * Math.random())
const INITIAL_RATIO_SINE_TRI = 0.5
const INITIAL_RATIO_SQ_SAW = 0.5
const INITIAL_RATIO_STRIDENCY = 0.1
const INITIAL_RATIO_NOISE = 0
const INITIAL_SAW_OVERTONE_MULT = 2
const REVERB_TIME_S = 2
const REVERB_WET = 0.2
const TUNE_TIME_S = 5.0

const nodesToStart = []
const needStart = n => {nodesToStart.push(n); return n}
const logger = txt => console.log(txt)
const ct = constructTones({
    Tone,
    needStart,
    logger
})

const baseFreqSignal = new Tone.Signal(INITIAL_BASE_FREQ_HZ)

const { output: oscSine } = ct.addOsc({ type: 'sine', freq: baseFreqSignal })
const { output: oscTri } = ct.addOsc({ type: 'triangle', freq: baseFreqSignal })
const { output: oscSq } = ct.addOsc({ type: 'square', freq: baseFreqSignal })
const { output: oscSaw, fm: fmSaw } = ct.addOsc({ type: 'sawtooth', freq: baseFreqSignal, fm: INITIAL_SAW_OVERTONE_MULT })
const { output: oscSineTri, fader: faderSineTri } = ct.addFader({ input0: oscSine, input1: oscTri, value: INITIAL_RATIO_SINE_TRI })
const { output: oscSqSaw, fader: faderSqSaw } = ct.addFader({ input0: oscSq, input1: oscSaw, value: INITIAL_RATIO_SQ_SAW })
const { output: oscNote, fader: faderStridency } = ct.addFader({ input0: oscSineTri, input1: oscSqSaw, value: INITIAL_RATIO_STRIDENCY })
const { output: oscs, fader: faderNoise } = ct.addFader({ input0: oscNote, input1: ct.whiteNoise, value: INITIAL_RATIO_NOISE })
const oscGain = new Tone.Gain(1)
oscs.connect(oscGain)

const { input: resInput, output: resOutput, wet: resWet } = ct.addResonators({ data: [
    { minHz: 15,  maxHz: 50,  periodS: 127/10 },
    { minHz: 50,  maxHz: 200,  periodS: 113/10 },
    { minHz: 200,  maxHz: 1000,  periodS: 97/10 },
    { minHz: 1000,  maxHz: 22050,  periodS: 79/10 }
]})
oscGain.connect(resInput)

const { input: mstrIn, gain: mstrGn, switch: mstrSw, reverb: mstrRv } = ct.addMasterBox({ initVol: INITIAL_VOLUME, reverbTimeS: REVERB_TIME_S, reverbWet: REVERB_WET })
resOutput.connect(mstrIn)


const SynthPad = () => {
    
    const [needsInitialStart, setNeedsInitialStart] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)

    const [baseFreqValue, setBaseFreqValue] = useState(INITIAL_BASE_FREQ_HZ)
    const [masterVolumeGainValue, setMasterVolumeGainValue] = useState(INITIAL_VOLUME)
    const [ratioSineTriValue, setRatioSineTriValue] = useState(INITIAL_RATIO_SINE_TRI)
    const [ratioSqSawValue, setRatioSqSawValue] = useState(INITIAL_RATIO_SQ_SAW)
    const [ratioStridencyValue, setRatioStridencyValue] = useState(INITIAL_RATIO_STRIDENCY)
    const [sawOvertoneMultValue, setSawOvertoneMultValue] = useState(INITIAL_SAW_OVERTONE_MULT)
    const [resonatorsGainValue, setResonatorsGainValue] = useState(1)
    const [longReverbWetValue, setLongReverbWetValue] = useState(REVERB_WET)
    const [ratioNoiseValue, setRatioNoiseValue] = useState(INITIAL_RATIO_NOISE)
    
    const updateBaseFreq = e => updateSlider(e, baseFreqSignal, setBaseFreqValue, v => `New base freq in Hz: ${v}`)
    const updateMasterVolume = e => updateSlider(e, mstrGn, setMasterVolumeGainValue, v => `New master volume: ${v}`)
    const updateRatioSineTri = e => updateSlider(e, faderSineTri, setRatioSineTriValue, v => `New ratio sine to triangle: ${v}`)
    const updateRatioSqSaw = e => updateSlider(e, faderSqSaw, setRatioSqSawValue, v => `New ratio square to sawtooth: ${v}`)
    const updateRatioStridency = e => updateSlider(e, faderStridency, setRatioStridencyValue, v => `New ratio stridency: ${v}`)
    const updateSawOvertoneMult = e => updateSlider(e, fmSaw, setSawOvertoneMultValue, v => `New saw overtone mult: ${v}`)
    const updateResonatorsGain = e => updateSlider(e, resWet, setResonatorsGainValue, v => `New resonators gain: ${v}`)
    const updateLongReverbWet = e => updateSlider(e, mstrRv, setLongReverbWetValue, v => `New long reverb wet: ${v}`)
    const updateRatioNoise = e => updateSlider(e, faderNoise, setRatioNoiseValue, v => `New ratio noise: ${v}`)
    
    const updateSlider = (e, toneParam, reactSetter, logFn) => {
        const newVal = e.target.value
        logger(toneParam)
        toneParam.setTargetAtTime(newVal, Tone.now(), UPDATE_SLIDER_TIME_S)
        reactSetter(newVal)
        logger(logFn(newVal))
    }
    
    const initialStart = () => {
        logger(`Starting ${nodesToStart.length} audio nodes...`)
        nodesToStart.forEach(n => n.start())
    }
    
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
        mstrSw.setTargetAtTime(v, Tone.now(), UPDATE_SLIDER_TIME_S)
    }

    const playTune = () => {
        // Cache some values
        const timeNowS = Tone.now()
        const baseFreqHz = baseFreqValue
        logger(timeNowS, baseFreqHz)
        // Get a tune
        const tune = getRandomTune({
            tuneLength: randint(12, 20),
            minNum: 3,
            maxNum: 7,
            minDenom: 10,
            maxDenom: 11,
            maxStep: 1,
            minBeats: 1,
            maxBeats: 2,
            logger
        })
        const beatTimeS = TUNE_TIME_S / tune.totalBeats
        // Play a tune
        const displayFreqs = []
        let beatSum = 0
        let thisS = timeNowS + beatSum * beatTimeS
        tune.notes.forEach(note => {
            const thisFreqHz = baseFreqHz * (note.freqNum / note.freqDenom) / tune.fMult
            baseFreqSignal.setTargetAtTime(thisFreqHz, thisS, 0.001)
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
        // Reset to original parameters
        baseFreqSignal.setValueAtTime(baseFreqHz, thisS)
        faderNoise.setTargetAtTime(0, thisS, 2)
        oscGain.gain.setTargetAtTime(1, thisS, 2)
        logger(displayFreqs)
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
            <p>Sine to Triangle Ratio: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.01'
                value={ratioSineTriValue}
                onChange={updateRatioSineTri}
            />
            <p>Square to Sawtooth Ratio: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.01'
                value={ratioSqSawValue}
                onChange={updateRatioSqSaw}
            />
            <p>Stridency Ratio: </p>
            <input
                type="range"
                min='0'
                max='1'
                step='0.01'
                value={ratioStridencyValue}
                onChange={updateRatioStridency}
            />
            <p>Saw Overtone Mult: </p>
            <input
                type="range"
                min='0.5'
                max='5'
                step='0.5'
                value={sawOvertoneMultValue}
                onChange={updateSawOvertoneMult}
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
            <p>Noise Ratio: </p>
            <input
                type="range"
                min='0'
                max='0.1'
                step='0.001'
                value={ratioNoiseValue}
                onChange={updateRatioNoise}
            />
        </div>
    );
}

export default SynthPad;
