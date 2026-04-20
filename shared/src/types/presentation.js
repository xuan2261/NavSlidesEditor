/**
 * JSDoc type definitions for NavSlides presentation data model.
 * Used as the single source of truth for data structures across client & server.
 *
 * @module types/presentation
 */

// ────────────────────────────────────────────────────────────────────────────
// Element types
// ────────────────────────────────────────────────────────────────────────────

/**
 * All supported element types in the editor.
 * @typedef {'text'|'image'|'shape'|'code'|'latex'|'html'|'markdown'|'chart'|'video'|'audio'|'table'|'icon'|'callout'|'qr'|'divider'|'line'|'drawing'|'svg'} ElementType
 */

/**
 * Base element — properties shared by every element on the canvas.
 * @typedef {Object} BaseElement
 * @property {string}      id        - UUID v4 identifier
 * @property {ElementType} type      - Element type discriminator
 * @property {number}      x         - X position in canvas pixels
 * @property {number}      y         - Y position in canvas pixels
 * @property {number}      width     - Width in canvas pixels (> 0)
 * @property {number}      height    - Height in canvas pixels (> 0)
 * @property {number}      [rotation=0]  - Rotation in degrees
 * @property {boolean}     [locked=false] - Whether the element is locked
 * @property {number}      [zIndex=1]     - Stacking order
 * @property {string}      [groupId]      - Group identifier (if grouped)
 * @property {Object}      [shadow]       - Drop shadow config
 * @property {number}      [opacity=1]    - Element opacity 0-1
 */

/**
 * @typedef {BaseElement & { content: string }} TextElement
 * Text element with rich HTML content (TipTap output).
 */

/**
 * @typedef {BaseElement & {
 *   src: string,
 *   objectFit?: 'cover'|'contain'|'fill',
 *   cropX?: number,
 *   cropY?: number,
 *   cropWidth?: number,
 *   cropHeight?: number,
 *   brightness?: number,
 *   contrast?: number,
 *   grayscale?: number,
 *   borderRadius?: number
 * }} ImageElement
 */

/**
 * @typedef {BaseElement & {
 *   shapeType: 'rectangle'|'circle'|'triangle'|'arrow'|'star'|'line',
 *   fill: string,
 *   stroke: string,
 *   strokeWidth: number,
 *   cornerRadius?: number
 * }} ShapeElement
 */

/**
 * @typedef {BaseElement & {
 *   code: string,
 *   language: string,
 *   theme?: string,
 *   borderRadius?: number
 * }} CodeElement
 */

/**
 * @typedef {BaseElement & {
 *   latex: string,
 *   displayMode?: boolean
 * }} LatexElement
 */

/**
 * @typedef {BaseElement & { htmlContent: string }} HtmlElement
 */

/**
 * @typedef {BaseElement & { markdown: string }} MarkdownElement
 */

/**
 * @typedef {BaseElement & {
 *   chartType: 'bar'|'line'|'pie'|'doughnut'|'radar'|'polarArea',
 *   chartData: Object,
 *   chartOptions?: Object
 * }} ChartElement
 */

/**
 * @typedef {BaseElement & {
 *   src: string,
 *   autoplay?: boolean,
 *   loop?: boolean,
 *   muted?: boolean
 * }} VideoElement
 */

/**
 * @typedef {BaseElement & {
 *   src: string,
 *   autoplay?: boolean,
 *   loop?: boolean
 * }} AudioElement
 */

/**
 * @typedef {BaseElement & {
 *   rows: number,
 *   cols: number,
 *   data: string[][],
 *   hasHeader?: boolean,
 *   headerBg?: string,
 *   borderColor?: string
 * }} TableElement
 */

/**
 * @typedef {BaseElement & {
 *   iconName: string,
 *   color: string,
 *   strokeWidth?: number
 * }} IconElement
 */

/**
 * @typedef {BaseElement & {
 *   number: number,
 *   color: string,
 *   size?: number
 * }} CalloutElement
 */

/**
 * @typedef {BaseElement & {
 *   qrData: string,
 *   fgColor?: string,
 *   bgColor?: string
 * }} QrElement
 */

/**
 * @typedef {BaseElement & {
 *   dividerStyle?: 'solid'|'dashed'|'dotted',
 *   color?: string,
 *   thickness?: number
 * }} DividerElement
 */

/**
 * Union of all concrete element types.
 * @typedef {TextElement|ImageElement|ShapeElement|CodeElement|LatexElement|HtmlElement|MarkdownElement|ChartElement|VideoElement|AudioElement|TableElement|IconElement|CalloutElement|QrElement|DividerElement} SlideElement
 */

// ────────────────────────────────────────────────────────────────────────────
// Slide & Presentation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Slide background specification.
 * @typedef {Object} SlideBackground
 * @property {'color'|'gradient'|'image'} type
 * @property {string} [color]    - CSS color string
 * @property {string} [gradient] - CSS gradient string
 * @property {string} [image]    - Image URL
 * @property {string} [value]    - Fallback value
 */

/**
 * Fragment animation for a single element.
 * @typedef {Object} FragmentAnimation
 * @property {string} elementId     - Target element ID
 * @property {number} fragmentIndex - Order in the animation sequence
 * @property {string} animation     - Animation class (e.g. 'fade-in')
 */

/**
 * A single slide in the presentation.
 * @typedef {Object} Slide
 * @property {string}              id         - UUID v4
 * @property {SlideElement[]}      elements   - Elements on this slide
 * @property {string}              [notes=''] - Speaker notes (plain text)
 * @property {string}              [speakerNotes] - Alt speaker notes field
 * @property {SlideBackground}     [background] - Slide background
 * @property {boolean}             [hidden=false] - Whether slide is skipped
 * @property {boolean}             [showPageNumber] - Page number toggle
 * @property {FragmentAnimation[]} [fragments] - Animation sequence
 */

/**
 * Footer configuration for presentations.
 * @typedef {Object} FooterConfig
 * @property {'basic'|'sequence'} mode
 * @property {string}   [sectionLabel]
 * @property {string[]} [sections]
 * @property {string}   [fontFamily]
 * @property {number}   [fontSize]
 * @property {string}   [activeColor]
 * @property {string}   [inactiveColor]
 */

/**
 * Presenter tools configuration.
 * @typedef {Object} PresenterTools
 * @property {boolean} [themeToggle]
 * @property {boolean} [fontZoom]
 * @property {boolean} [slideMenu]
 * @property {boolean} [chalkboard]
 */

/**
 * A full presentation document.
 * @typedef {Object} Presentation
 * @property {string}          id
 * @property {string}          title
 * @property {string}          [theme='black']      - reveal.js theme name
 * @property {string}          [transition='none']  - Transition type
 * @property {Slide[]}         slides
 * @property {FooterConfig}    [footer]
 * @property {PresenterTools}  [presenterTools]
 * @property {string}          [createdAt]  - ISO date string
 * @property {string}          [updatedAt]  - ISO date string
 * @property {string}          [deletedAt]  - ISO date (soft-delete marker)
 * @property {boolean}         [isTemplate]
 * @property {string}          [description]
 */

module.exports = {}
