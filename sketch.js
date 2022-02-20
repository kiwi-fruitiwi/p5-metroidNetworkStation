/**
 *  @author Kiwi
 *  @date 2022.02.20
 *
 *  this project combines two previous projects:
 *  1. p5-dialogSystemManualWidth
 *      An implementation of the dialog boxes found in Metroid Dread which
 *      uses the original Metroid Dread font, VDL-GigaMaruJr. Since
 *      textWidth does not work properly for this font, it is manually
 *      implemented with (expensive) pixel scanning. A cache is required for
 *      performance reasons.
 *
 *      → includes code from p5-textFrame
 *          generate the textFrame graphic using translations and rotations
 *          perform the 'open dialog box' animation
 *
 *  2. p5-sphericalGeometry
 *      This project uses a spherical coordinate system to animate the
 *      oscillating pyramids that form Adam's 'body' in Metroid Dread.
 *
 *      https://en.wikipedia.org/wiki/Spherical_coordinate_system
 *
 *      It uses the amplitude of the input sound file and a sine function or two
 *      to oscillate the surface of a sphere to emulate Adam's visual design
 *      and animation.
 */

let font
let cam // easycam!
let adamVoice // mp3 file playing sound effects from samus meeting adam
let playing // flag for whether the sound is playing

// the timestamp for when our audio starts. uses millis(), ms since sketch start
let voiceStartMillis
const SOUND_FILE_START = 12


/**
 * this can't be large because our charWidth graphics buffer is of finite
 * size! note that we must also take into account our webpage scaling in
 * chrome; I have it set at 125%, a significant bump up from default.
 * @type {number}
 */
const FONT_SIZE = 24 // this needs to be even. note: the font in-game is bold
const LETTER_SPACING = 1.25
const SPACE_WIDTH = FONT_SIZE / 2

/* define the hue and saturation for all 3 axes */
const X_HUE = 0, X_SAT = 80, Y_HUE = 90, Y_SAT = 80, Z_HUE = 210, Z_SAT = 80
const DIM = 40 // brightness value for the dimmer negative axis
const BRIGHT = 75 // brightness value for the brighter positive axis

let dialogBox
let passages // our json file input holding many passage objects
let textList = [] // array of passage text

/* empty dictionary for our character length cache. used for
 dialogBox.charWidth to get around the fact that textWidth does not work for
  VDL-GigaMaruJr.ttf ← giga.ttf */
let cache = {}

/* variables for the p5-sphericalGeometry part of this project */
let SPHERE_DETAIL = 24 // number of segments per θ and φ
let SPHERE_RADIUS = 100

let globe // an n by n 2D array of points on a sphere in (r, θ, φ) triples
let angle = 0 // we use this as a phase variable to vary our sine waves

// read the amplitude of our voice from the mic
let voice
let p5amp




function preload() {
    font = loadFont('data/giga.ttf') // requires manual textWidth method
    // font = loadFont('data/meiryo.ttf')
    passages = loadJSON('passages.json')
    adamVoice = loadSound('data/artaria.mp3', null, null)
    playing = false
}



/* grab other information: ms spent on each passage, highlights */
let highlightList = [] // a list of tuples specifying highlights and indexes
let passageStartTimes = [] // how long to wait before advancing a passage

function setup() {
    noSmooth()
    createCanvas(1280, 720, WEBGL)

    cam = new Dw.EasyCam(this._renderer, {distance: 240});

    colorMode(HSB, 360, 100, 100, 100)
    textFont(font, FONT_SIZE)

    for (let key in passages) {
        textList.push(passages[key]['text'])
        highlightList.push(passages[key]['highlightIndices'])
        passageStartTimes.push(passages[key]['ms'])
    }

    dialogBox = new DialogBox(textList, highlightList, passageStartTimes)
}


function keyPressed() {
    if (!playing && key === 's') {
        adamVoice.play()
        adamVoice.jump(12)
        voiceStartMillis = millis()
        playing = true
        console.log("[ INFO ] - starting AI voice")
        console.log("[  OK  ] - synchronized dialog boxes to speech")
    }

    if (key === 'z') {
        adamVoice.stop()
        noLoop()
    }
}


function openDialog(timeElapsed) {
    // dialogBox.openAnimation(map(mouseX, 0, width, 0.01, 100), cam)

    /**
     * open in ¼ of a second using frameCount: stay at 100 after
     * disappearing is also okay if we replace it immediately with the real
     * textFrame renderer. in our JSON, the start time of our first passage is
     * 15431
     *
     * @param START start time: milliseconds after sketch load
     * @param END end time: milliseconds after sketch load
     */
    const firstPassageStartTime = dialogBox.startTimes[0] // 15431ms
    const audioSkipDurationMs = SOUND_FILE_START*1000

    // const START = voiceStartMillis+3031
    // const END = voiceStartMillis+3431
    const dialogOpenAnimationTime = 400
    const START = voiceStartMillis + firstPassageStartTime - audioSkipDurationMs
        - dialogOpenAnimationTime
    const END = START + dialogOpenAnimationTime

    if(millis() > START && millis() < END) {
        let slider = map(millis() - START, 0, END-START, 0.01, 100)
        dialogBox.openAnimation(slider, cam)
    } else if(millis() >= END) {
        /* keep the textFrame open after the opening animation is done */
        // dialogBox.openAnimation(100)
    }
}


function draw() {
    background(234, 34, 24)
    let timeElapsed = millis() - voiceStartMillis + SOUND_FILE_START*1000

    openDialog(timeElapsed)

    ambientLight(250);
    directionalLight(0, 0, 10, .5, 1, 0); // z axis seems inverted
    drawBlenderAxes()
    displayHUD()

    if (playing) {
        if ((dialogBox.passageIndex === 0) &&
            (timeElapsed < dialogBox.startTimes[0])) {
            // do nothing
        } else {
            // console.log(dialogBox.getNextPassageStartTime())
            dialogBox.renderTextFrame(cam)
            dialogBox.renderText(cam)

            /* if (round(millis()) % 3 === 0) */
            // we don't catch every millis call
            if (frameCount % 2 === 0)
                dialogBox.advanceChar()

            if (timeElapsed > dialogBox.getNextPassageStartTime()) {
                dialogBox.nextPassage()
                console.log(`advanced! to ${dialogBox.passageIndex}`)
            }
        }
    }
}

function displayHUD() {
    cam.beginHUD(this._renderer, width, height)
    const PADDING = 10
    const LETTER_HEIGHT = textAscent()

    textFont(font, 10)

    // display the colors of the axes
    fill(X_HUE, X_SAT, BRIGHT)
    text("x axis", PADDING, height - LETTER_HEIGHT * 3)

    // green y axis
    fill(Y_HUE, Y_SAT, BRIGHT)
    text("y axis", PADDING, height - LETTER_HEIGHT * 2)

    // blue z axis
    fill(Z_HUE, Z_SAT, BRIGHT)
    text("z axis", PADDING, height - LETTER_HEIGHT)
    cam.endHUD()
}


// draw axes in blender colors, with negative parts less bright
function drawBlenderAxes() {
    const ENDPOINT = 10000
    strokeWeight(1)

    // red x axis
    stroke(X_HUE, X_SAT, DIM)
    line(-ENDPOINT, 0, 0, 0, 0, 0)
    stroke(X_HUE, X_SAT, BRIGHT)
    line(0, 0, 0, ENDPOINT, 0, 0)

    // green y axis
    stroke(Y_HUE, Y_SAT, DIM)
    line(0, -ENDPOINT, 0, 0, 0, 0)
    stroke(Y_HUE, Y_SAT, BRIGHT)
    line(0, 0, 0, 0, ENDPOINT, 0)

    // blue z axis
    stroke(Z_HUE, Z_SAT, DIM)
    line(0, 0, -ENDPOINT, 0, 0, 0)
    stroke(Z_HUE, Z_SAT, BRIGHT)
    line(0, 0, 0, 0, 0, ENDPOINT)
}


// prevent the context menu from showing up :3 nya~
document.oncontextmenu = function () {
    return false;
}

/* Fixes: sound being blocked https://talonendm.github.io/2020-11-16-JStips/
   Errors messages (CTRL SHIFT i) Chrome Developer Tools:
   The AudioContext was not allowed to start. It must be resumed (or
   created)  after a user gesture on the page. https://goo.gl/7K7WLu

   Possibly unrelated: maybe we need to add sound.js.map too.
   DevTools failed to load SourceMap: Could not load content for
   https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/addons/p5.sound.min.js.map
   : HTTP error: status code 404, net::ERR_HTTP_RESPONSE_CODE_FAILURE
 */
function touchStarted() {
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume().then(r => {});
    }
}