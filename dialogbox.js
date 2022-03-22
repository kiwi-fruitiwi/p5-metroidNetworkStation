class DialogBox {
    constructor(passages, highlightIndices, startTimes, endTimes) {
        /*  contains an array of passage texts:
                ["passage 1...", "passage 2...", "passage 3...", etc.]

            +indices for highlights (possibly multiple per passage)
            +startTimes for each passage based on the mp3
         */

        this.passageList = passages
        this.totalPassages = passages.length
        this.index = 0 // the char index we are currently displaying
        this.passageIndex = 0 // which passage in our passage array are we on?


        /* position values from textFrame.png 's generation script */
        this.LEFT_MARGIN = 80
        this.RIGHT_MARGIN = this.LEFT_MARGIN
        this.BOTTOM_MARGIN = 20
        this.HEIGHT = 224

        /* this is the y-coordinate of the dialog box */
        this.Y = height-this.HEIGHT-this.BOTTOM_MARGIN

        // this.boxWidth = width - this.LEFT_MARGIN - this.RIGHT_MARGIN
        this.textFrame = loadImage('data/textFrame.png')
        this.frameTop = loadImage('data/frameTop.png')
        this.frameBottom = loadImage('data/frameBottom.png')
        this.text = this.passageList[0]

        // list of hardcoded (start, end) specifying which words to highlight
        this.highlightIndices = highlightIndices
        this.startTimes = startTimes // when this passage starts in the audio
        this.endTimes = endTimes // timestamp when passage speech ends

        this.phase = 0 /* controls fading for triangle via alpha channel */
        this.radius = 8 /* "radius" of the next-passage triangle */
    }



    /**
     * animates a dialog frame opening and expanding from the vertical center.
     * mouseX controls the rate of opening. includes helpful debug text
     *
     * @param slider0to100 this value should be between 0.01 to 100, where
     * 0.01 is 'fully closed' and 100 is 'fully open'
     *
     * this function used to use mouseX as our slider variable, and mapped
     * mouseX from [0, width] to [0.01, 100]; 0.01 avoids boundary case
     */
    openAnimation(slider0to100, cam) {
        cam.beginHUD(p5._renderer, width, height)
        // background(234, 34, 24)

        const Y_CENTER = height - this.HEIGHT/2 - this.BOTTOM_MARGIN

        /*  debugging center line
            stroke(0, 0, 100, 100)
            strokeWeight(1)
            line(0, Y_CENTER, width, Y_CENTER)
         */

        /* again mapped to 0.01 instead of 0 to avoid garbage negative image */
        /* note the use of constrain boolean at end of map */
        let slider30to100 = map(slider0to100, 30, 100, 0.01, 100, true)

        /* pseudocode
         *  from 0.01-30, draw a growing white horizontal line
         *      map from [0,30] to [0,50] side length percentage σ
         *      side length will be (σ/100) * width ← better as [0, 0.5]
         *      find center point (width/2, Y_CENTER)
         *          line from width/2 +/- σ
         *  match width of line to textFrame. center properly
         *      how do we fix the width? determine margins and centering
         *          dialogBox.js shows LEFT_MARGIN to be 80
         *          ☒ thus our X_OFFSET should be 80 instead of 100
         *      how do we restrict our expanding white line?
         *          we expand from the center using a percentage of width
         *          ☒ change to percentage of width - 80 or 80*2?
         */
        let σ = map(slider0to100, 0.01, 30, 0, 50, true)
        strokeWeight(2)
        stroke(0, 0, 100, 100)

        /* our side length is a percentage of the width minus the margins; this
         spans from 0 to half the width of the textFrame */
        let sideLength = (σ/100) * (width-2*this.LEFT_MARGIN)

        /* don't display a dot before we start growing */
        if (slider0to100 > 0.1)
            /* only display if textFrame hasn't appeared yet */
            if (slider0to100 < 32)
                line(width/2-sideLength, Y_CENTER, width/2+sideLength, Y_CENTER)

        /** second part of animation: growing frameTop and frameBottom */
        let h = this.frameTop.height * slider30to100/100.0
        let w = this.frameTop.width
        let transparency = constrain(slider0to100, 5, 30)

        /** when the textBox is 80%+ fully expanded, "flash white" effect */
        if(slider0to100 >= 80 && slider0to100 <= 99) {
            /*  draw a white rectangle with the correct width and height
                    start with two rects with the same (x,y) as fTop + fBottom
             */
            const L_MARGIN_PADDING = 4
            fill(0, 0, 100, 100)
            noStroke()
            /*  TODO this should technically be one correctly-sized rect ;p
             *      also pretty sure the math is wrong here, but output is okay
             */

            const frameBorderWidth = 5
            rect(
                this.LEFT_MARGIN+L_MARGIN_PADDING,
                Y_CENTER-h+frameBorderWidth,
                w-L_MARGIN_PADDING*2,
                // actually unsure why we need this 6 below. math must be off
                (h-6)*2-2*frameBorderWidth,
                8 // rounded borders don't actually work in WEBGL, even with HUD
            )
        }

        if(slider0to100 >= 80) {
            tint(0, 0, 100, 100) /* full opacity near end of slider range */
        } else {
            /* gradually increase opacity ∈[30, 100] */
            tint(0, 0, 100, transparency)
        }

        /** display the frameTop and frameBottom
         *  keep frameTop's bottom edge at a constant height
         */
        image(this.frameTop, this.LEFT_MARGIN, Y_CENTER-h, w, h)
        image(this.frameBottom, this.LEFT_MARGIN, Y_CENTER, w, h)

        cam.endHUD()
    }


    /**
     * returns start time of passage after the current one. if none exists,
     * return ∞
     */
    getNextPassageStartTime() {
        if (this.passageIndex < this.totalPassages-1) {
            return this.startTimes[this.passageIndex+1]
        } else return Infinity
    }


    /**
     * advance to the next passage
     */
    nextPassage() {
        if (this.passageIndex === this.passageList.length - 1) {
            console.log("and we're done! :Sal's voice:")
        } else {
            this.passageIndex += 1
            this.text = this.passageList[this.passageIndex]

            // reset the current passage index so we restart at beginning
            this.index = 0
        }
    }

    /**
     * advances the current char in the current passage, but does nothing if
     * we are at the end
     */
    advanceChar() {
        if (this.index < this.text.length - 1) {
            this.index += 1
        }
    }

    // display the current passage up to the current index
    renderText(cam) {
        if (cam) cam.beginHUD(p5._renderer, width, height)
        /*  use text() to display characters with character wrap
            color(204, 4, 80) is the correct white text color
         */

        /*  render fading dialogbox triangle if:
         *      we are at the end of the passage, i.e.
         *          this.index === this.passage.length-1?
         *
         */
        push()
        const PADDING = 40 /* space between center of triangle and box side */
        translate(width-125, height-55)

        /**
         *  an equilateral triangle with center (0,0) and long leg 2*r has
         *  vertices at; prove using law of sines, verify using py. theorem.
         *  (0, r)
         *  (-2r/sqrt(3), -r)
         *  (2r/sqrt(3), -r)
         *
         *  but Dread's triangle is not equilateral. we will use a scaling
         *  factor in the x direction :p
         */
        const r = this.radius
        const YSF = 0.63 /* scaling factor on the y-axis */

        /* alpha value to enable fading in our triangle */
        const a = map(sin(frameCount/12), -1, 1, 25, 100)

        const alphaShiftingCyan = color(188, 20, 94, a)
        fill(alphaShiftingCyan)
        noStroke()

        /* only display the triangle when the dialog is done */
        if(this.index === this.text.length-1)
            triangle(0, r*YSF,
                -2*r/sqrt(3), -r*YSF,
                2*r/sqrt(3), -r*YSF)
        pop()


        noStroke()
        let CHAR_POS = [] /* we store our previous character positions */

        /**
         *  TEXT_TOP_MARGIN is where the body of the dialog starts. Does not
         *  include the speaker name, which is offset later
         */
        const TEXT_TOP_PADDING = 84
        const TEXT_TOP_MARGIN = this.Y + TEXT_TOP_PADDING
        const TEXT_LEFT_PADDING = 40
        const TEXT_LEFT_MARGIN = this.LEFT_MARGIN + TEXT_LEFT_PADDING
        const TEXT_RIGHT_MARGIN = TEXT_LEFT_MARGIN

        /** display ADAM at the top left */
        const cyan = color(188, 20, 94) // this color matches the frame border
        fill(cyan)

        const speakerName = 'ADAM'
        const SPEAKER_LEFT_PADDING = -20
        const SPEAKER_TOP_PADDING = -40
        let speakerCursor = new p5.Vector(
            TEXT_LEFT_MARGIN + SPEAKER_LEFT_PADDING,
            TEXT_TOP_MARGIN + SPEAKER_TOP_PADDING)

        for(let i in speakerName) {
            text(speakerName[i], speakerCursor.x, speakerCursor.y)
            speakerCursor.x += this.wordWidth(speakerName[i])
        }


        /**
         * now it's time to display the text of each passage! the bottom
         * left corner of the current letter we are typing is located at cur
         * @type {p5.Vector}
         */
        let cursor = new p5.Vector(TEXT_LEFT_MARGIN, TEXT_TOP_MARGIN)
        const HIGHLIGHT_BOX_HEIGHT = textAscent() + textDescent()

        /*  display the entire passage without text wrap */
        for (let i = 0; i < this.index; i++) {
            // save the position of the ith character. we'll need this later
            CHAR_POS.push(cursor.copy())

            /*  draw current letter above (z-index) the highlight box
                color emphasized words yellow
             */

            fill(204, 4, 80) // default color

            // check highlightIndices to see if there's something to highlight
            let hlEntry = this.highlightIndices[this.passageIndex]

            // loop through hlEntry, a list of highlight indices. highlight!
            for (let e of hlEntry) {
                if (i >= e.start-1 &&
                    i < e.end-1) {
                    fill(63, 60, 75)
                }
            }

            // gigamarujr doesn't render spaces properly in JS, so we catch this
            if (this.text[i] === ' ') {
                // don't display
            } else text(this.text[i], cursor.x, cursor.y)

            /*  modify cursor position to where the next letter should be.
             */
            cursor.x += this.wordWidth(this.text[i])

            // this is the horizontal coordinate where we must text wrap
            const LINE_WRAP_X_POS = width - TEXT_RIGHT_MARGIN

            /*  okay just kidding. now we're going to wrap the text:
                if we're at a whitespace, determine if we need a new line:
                    find the next whitespace
                    the word between us and that whitespace is the next word
                    if the width of that word + our cursor + current space >
                     limit, then newline
             */
            if (this.text[i] === ' ') {
                let ndi = this.text.indexOf(" ", i + 1) // next delimiter index
                let nextWord = this.text.substring(i + 1, ndi)

                if (this.wordWidth(nextWord) +
                    this.wordWidth(this.text[i]) +
                    cursor.x > LINE_WRAP_X_POS) {
                    cursor.y += HIGHLIGHT_BOX_HEIGHT + 5
                    /* 5 is additional height to match dread's line-height*/

                    // don't forget to wrap the x coordinates! ᴖᴥᴖ
                    cursor.x = TEXT_LEFT_MARGIN
                }
            }
        }

        if (cam) cam.endHUD()
    }

    // loads the saved box texture with transparency
    renderTextFrame(cam) {
        cam.beginHUD(p5._renderer, width, height)

        // TODO this definitely does not place at (0,0). why is it centering?
        // SOLUTION: textFrame is actually 1280x720 on a transparent background
        image(this.textFrame, 0, 0, width, height)
        cam.endHUD()
    }


    /** returns true if speech for the current passage has ended */
    speechEnded() {
        const currentPassageEndTimestamp = this.endTimes[this.passageIndex]
        // if (frameCount % 180 === 0)
            // console.log(passageEndTimes[this.passageIndex])
        return (millis() >= voiceStartMillis - audioSkipDurationMs
            + currentPassageEndTimestamp)
    }


    /**
     * Returns the width of a word using individual widths from
     * charWidth_pixels. Spaces are taken care of separately due to
     * gigamarujr.ttf having an error in its space character.
     */
    wordWidth(word) {
        let sum = 0;
        [...word].forEach(w => {
            if (w === ' ')
                sum += SPACE_WIDTH
            else
                sum += this.charWidth(w) + LETTER_SPACING
        })

        return sum
    }

    /*  return the width in pixels of char using the pixels array */
    charWidth(char) {
        if (cache[char]) {
            // console.log(`cached answer returned: ${cache[char]}`)
            return cache[char]
        } else {
            /**
             * create a graphics buffer to display a character. then determine its
             * width by iterating through every pixel. Noting that 'm' in size 18
             * font is only 14 pixels, perhaps setting the buffer to a max width of
             * FONT_SIZE is sufficient. The height needs to be a bit higher to
             * account for textDescent, textAscent. x1.5 is inexact, but should be
             * plenty.
             * @type {p5.Graphics}
             */
            let g = createGraphics(FONT_SIZE, FONT_SIZE * 1.5)
            g.colorMode(HSB, 360, 100, 100, 100)
            g.textFont(font, FONT_SIZE)
            g.background(0, 0, 0)
            g.fill(0, 0, 100)

            /**
             *  the base height of g is g.height; this is an approximation of what
             *  would fit most characters. utterly untested but seems okay with
             *  large paragraphs. A lowercase 'm' is about ⅓ the height of
             *  textAscent + textDescent.; a 'j' is ⅔.
             */
            g.text(char, 0, g.height - FONT_SIZE / 2)
            g.loadPixels()

            let pd = g.pixelDensity()
            let offset
            let max_x = 0 /* the maximum x position we've seen a non-black pixel */

            /*  a pixel value "fails" if it's not [0, 0, 0, 255] which indicates
             black. so if redFail is true, that means red is not 0. if alphaFail
             is true, it means alpha is not 255.
             */
            let redFail, greenFail, blueFail, alphaFail

            /* iterate through every pixel in pixels[] array */
            for (let x = 0; x < g.width; x++) {
                for (let y = 0; y < g.height; y++) {
                    /* 🌟 there are two methods below: .get() and pixels[]. use one */

                    // the .get() strategy. slower than using pixels[] and
                    // loadpixels() let c = g.get(x, y) if (!(c[0] === 0 && c[1]
                    // === 0 && c[2] === 0 && c[3] === 255)) max_x = Math.max(x,
                    // max_x)

                    // the pixels[] strategy. about twice the speed as .get()

                    offset = (y * g.width + x) * pd * 4
                    // pixel values are rgba in the format [r, g, b, a]
                    redFail = (offset % 4 === 0 && g.pixels[offset] !== 0)
                    greenFail = (offset % 4 === 1 && g.pixels[offset] !== 0)
                    blueFail = (offset % 4 === 2 && g.pixels[offset] !== 0)
                    alphaFail = (offset % 4 === 3 && g.pixels[offset] !== 255)

                    if (redFail || greenFail || blueFail || alphaFail)
                        max_x = Math.max(x, max_x)
                }
            }

            cache[char] = max_x
            return max_x
        }
    }
}