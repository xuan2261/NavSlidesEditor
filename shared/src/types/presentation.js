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
 * @typedef {'text'|'image'|'shape'|'code'|'latex'|'html'|'markdown'|'chart'|'video'|'audio'|'table'|'icon'|'callout'|'qrcode'|'drawing'|'line'|'svg'|'timeline'|'game'} ElementType
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
 *   shape: 'rect'|'circle'|'triangle'|'arrow'|'star',
 *   fill: string,
 *   stroke: string,
 *   strokeWidth: number,
 *   borderRadius?: number
 * }} ShapeElement
 */

/**
 * @typedef {BaseElement & {
 *   content: string,
 *   language: string,
 *   theme?: string,
 *   borderRadius?: number
 * }} CodeElement
 */

/**
 * @typedef {BaseElement & {
 *   content: string,
 *   displayMode?: boolean,
 *   fontSize?: number,
 *   textColor?: string
 * }} LatexElement
 */

/**
 * @typedef {BaseElement & { content: string }} HtmlElement
 */

/**
 * @typedef {BaseElement & { content: string }} MarkdownElement
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
 *   controls?: boolean,
 *   autoplay?: boolean,
 *   loop?: boolean,
 *   muted?: boolean,
 *   objectFit?: 'cover'|'contain'|'fill'|'none',
 *   poster?: string,
 *   startTime?: number,
 *   endTime?: number,
 *   playbackRate?: number
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
 *   iconColor: string,
 *   iconStrokeWidth?: number
 * }} IconElement
 */

/**
 * @typedef {BaseElement & {
 *   calloutNumber: number,
 *   calloutColor: string,
 *   calloutTextColor?: string,
 *   fontSize?: number
 * }} CalloutElement
 */

/**
 * @typedef {BaseElement & {
 *   qrData: string,
 *   fgColor?: string,
 *   bgColor?: string
 * }} QrcodeElement
 */

/**
 * @typedef {BaseElement & {
 *   paths: Array,
 *   strokeColor?: string,
 *   strokeWidth?: number
 * }} DrawingElement
 */

/**
 * @typedef {BaseElement & {
 *   x1: number,
 *   y1: number,
 *   x2: number,
 *   y2: number,
 *   stroke?: string,
 *   strokeWidth?: number,
 *   arrowStart?: string,
 *   arrowEnd?: string
 * }} LineElement
 */

/**
 * @typedef {BaseElement & {
 *   content: string,
 *   fillOverride?: string|null,
 *   strokeOverride?: string|null
 * }} SvgElement
 */

/**
 * @typedef {BaseElement & {
 *   timelineStart?: string,
 *   timelineEnd?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   events?: Array,
 *   items?: Array
 * }} TimelineElement
 */

/**
 * @typedef {BaseElement & {
 *   gameType?: string,
 *   gameStatus?: string,
 *   backgroundColor?: string,
 *   accentColor?: string
 * }} GameElement
 */

/**
 * Union of all concrete element types.
 * @typedef {TextElement|ImageElement|ShapeElement|CodeElement|LatexElement|HtmlElement|MarkdownElement|ChartElement|VideoElement|AudioElement|TableElement|IconElement|CalloutElement|QrcodeElement|DrawingElement|LineElement|SvgElement|TimelineElement|GameElement} SlideElement
 */

// ────────────────────────────────────────────────────────────────────────────
// Slide & Presentation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Slide background specification.
 * @typedef {Object} SlideBackground
 * @property {'color'|'gradient'|'image'|'fx'|'none'} type
 * @property {string} [color]    - CSS color string
 * @property {string} [gradient] - CSS gradient string
 * @property {string} [image]    - Image URL
 * @property {string} [value]    - Fallback value
 * @property {{ name: string, params?: Object, fallbackColor?: string }} [fx] - Animated canvas FX (type==='fx'); name ∈ fx registry, fallbackColor used for print
 */

/**
 * Fragment animation for a single element.
 * @typedef {Object} FragmentAnimation
 * @property {string} elementId     - Target element ID
 * @property {number} fragmentIndex - Order in the animation sequence
 * @property {string} animation     - Animation class (e.g. 'fade-in')
 */

/**
 * Design token set — drives theme-aware `'auto'` color resolution. Injected as
 * CSS custom properties (`--ns-*`) at the deck (`:root`) and per-slide level.
 * @typedef {Object} DesignTokens
 * @property {Object} [colors]   - { bg, surface, accent, accent2, text, muted } (CSS color strings)
 * @property {Object} [fonts]    - { heading, body } font-family strings
 * @property {number} [radius]   - Base corner radius in px
 * @property {number} [spacingScale] - Spacing multiplier
 */

/**
 * A single slide in the presentation.
 * @typedef {Object} Slide
 * @property {string}              id         - UUID v4
 * @property {SlideElement[]}      elements   - Elements on this slide
 * @property {string}              [notes=''] - Speaker notes (plain text)
 * @property {string}              [speakerNotes] - Legacy input alias for notes
 * @property {SlideBackground}     [background] - Slide background
 * @property {DesignTokens}        [designTokens] - Per-slide token override (partial; merged over deck tokens)
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
 * @property {DesignTokens}    [designTokens]       - Deck-level design token set (merged over DEFAULT_TOKENS)
 * @property {FooterConfig}    [footer]
 * @property {PresenterTools}  [presenterTools]
 * @property {string}          [createdAt]  - ISO date string
 * @property {string}          [updatedAt]  - ISO date string
 * @property {string}          [deletedAt]  - ISO date (soft-delete marker)
 * @property {boolean}         [isTemplate]
 * @property {string}          [description]
 */

module.exports = {}
