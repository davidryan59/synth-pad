import { randint } from './helpers'

export const getRandomTune = ({
    logger,
    tuneLength=8,
    minNum=4,
    minDenom=4,
    maxNum=20,
    maxDenom=20,
    maxStep=3,
    minBeats=1,
    maxBeats=2,
}) => {
    // Extract options
    // const size = options.size || 8
    // const minNum = options.minNum || 4
    // const minDenom = options.minDenom || 4
    // const maxNum = options.maxNum || 20
    // const maxDenom = options.maxDenom || 20
    // const maxStep = options.maxStep || 3
    // const minBeats = options.minBeats || 1
    // const maxBeats = options.maxBeats || 2
    // Setup tune
    const tune = {}
    tune.notes = []
    tune.totalBeats = 0
    let freqNum = randint(minNum, maxNum)
    let freqDenom = randint(minDenom, maxDenom)
    tune.fMult = freqNum / freqDenom
    let beats = 1
    for (let i = 0; i < tuneLength; i++) {
        freqNum = Math.max(minNum, Math.min(maxNum, freqNum + randint(-maxStep, maxStep)))
        freqDenom = Math.max(minDenom, Math.min(maxDenom, freqDenom + randint(-maxStep, maxStep)))
        beats = randint(minBeats, maxBeats)
        tune.totalBeats += beats
        tune.notes.push({freqNum, freqDenom, beats})
    }
    logger('getRandomTune has run:')
    logger(tune)
    return tune
}
