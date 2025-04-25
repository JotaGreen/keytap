/**
 * @fileoverview midiColorConverter.js
 * Provides functionality to convert a MIDI note number to an sRGB color value
 * based on the OKHSL color space.
 *
 * The color mapping uses hue based on the pitch class (0-11) and lightness
 * interpolated across a defined MIDI range (default: 24-108) and lightness
 * range (default: 0.275-0.80). Saturation is kept constant (default: 1.0).
 *
 * Includes robust OKHSL to sRGB conversion functions adapted from
 * Björn Ottosson's work (https://bottosson.github.io/posts/oklab/).
 */

// --- Configuration Constants ---

/**
 * The starting MIDI note number for the color scale range.
 * @const {number}
 */
const MIDI_START = 24; // C1

/**
 * The ending MIDI note number for the color scale range.
 * @const {number}
 */
const MIDI_END = 108; // C8

/**
 * The target OKHSL lightness value corresponding to MIDI_START.
 * @const {number}
 */
const L_START = 0.275;

/**
 * The target OKHSL lightness value corresponding to MIDI_END.
 * @const {number}
 */
const L_END = 0.80;

/**
 * The fixed OKHSL saturation value used for all notes.
 * @const {number}
 */
const SATURATION = 1.0;

/**
 * Maps MIDI pitch classes (0-11) to hue angles in degrees (0-360).
 * Note: Pitch class 11 (B) maps to 0 degrees (same as C).
 * @const {Object<number, number>}
 */
const PITCH_CLASS_HUE_MAP_DEGREES = {
    0: 30,  // C
    1: 60,  // C#
    2: 90,  // D
    3: 120, // D#
    4: 150, // E
    5: 180, // F
    6: 210, // F#
    7: 240, // G
    8: 270, // G#
    9: 300, // A
    10: 330,// A#
    11: 0   // B (maps back to red-ish hue like C)
};


// --- Core Calculation Functions ---

/**
 * Calculates the OKHSL lightness based on MIDI number using linear interpolation
 * over the defined MIDI range (MIDI_START to MIDI_END) and lightness bounds
 * (L_START to L_END). Clamps the input MIDI note to the defined range.
 *
 * @param {number} midiNote - The MIDI note number.
 * @returns {number} The interpolated lightness value (clamped between 0 and 1).
 */
function getLightness(midiNote) {
    // Clamp the MIDI note to the defined range
    const clampedMidi = Math.max(MIDI_START, Math.min(MIDI_END, midiNote));

    const range = MIDI_END - MIDI_START;

    // Avoid division by zero if start and end are the same
    if (range === 0) {
        return L_START;
    }

    // Calculate the interpolation factor (0 to 1)
    const factor = (clampedMidi - MIDI_START) / range;

    // Linear interpolation: L = L_start + factor * (L_end - L_start)
    const lightness = L_START + factor * (L_END - L_START);

    // Ensure lightness stays within the valid 0-1 range
    return Math.max(0, Math.min(1, lightness));
}

// --- OKHSL to sRGB Conversion Functions (Adapted from Björn Ottosson) ---
// These functions implement the conversion from the OKHSL color space to
// the standard sRGB color space used for display.

/**
 * Inverse of the Oklab L component transformation.
 * @param {number} x - The value to transform (typically OKHSL lightness).
 * @returns {number} The transformed value (Oklab L).
 */
function toe_inv(x) {
    const k_1 = 0.206;
    const k_2 = 0.03;
    const k_3 = (1 + k_1) / (1 + k_2);
    const clamped_x = Math.max(0, x); // Ensure input is non-negative
    const denominator = k_3 * (clamped_x + k_2);

    // Avoid division by zero
    if (Math.abs(denominator) < 1e-9) {
        return 0;
    }

    return (clamped_x * clamped_x + k_1 * clamped_x) / denominator;
}

/**
 * Converts Oklab color coordinates to linear sRGB values.
 * Linear sRGB is sRGB before gamma correction.
 * @param {number} L - Oklab Lightness component.
 * @param {number} a - Oklab 'a' component (green-red axis).
 * @param {number} b - Oklab 'b' component (blue-yellow axis).
 * @returns {number[]} An array [r, g, b] of linear sRGB values.
 */
function oklab_to_linear_srgb(L, a, b) {
    let l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    let m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    let s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    let l = l_ * l_ * l_;
    let m = m_ * m_ * m_;
    let s = s_ * s_ * s_;

    return [
        (+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), // Linear Red
        (-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), // Linear Green
        (-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), // Linear Blue
    ];
}

/**
 * Computes the maximum saturation (S) for a given hue angle (defined by a, b)
 * in the Oklab color space before gamut clipping occurs.
 * @param {number} a - Oklab 'a' component derived from hue.
 * @param {number} b - Oklab 'b' component derived from hue.
 * @returns {number} The maximum saturation S.
 */
function compute_max_saturation(a, b) {
    // Selects the face of the sRGB cube projected onto the Oklab plane
    // that is closest to the ray defined by the hue angle.
    let k0, k1, k2, k3, k4, wl, wm, ws;

    // Determine which RGB component limits saturation first for this hue
    if (-1.88170328 * a - 0.80936493 * b > 1) { // Red face
        k0 = +1.19086277; k1 = +1.76576728; k2 = +0.59662641; k3 = +0.75515197; k4 = +0.56771245;
        wl = +4.0767416621; wm = -3.3077115913; ws = +0.2309699292;
    } else if (1.81444104 * a - 1.19445276 * b > 1) { // Green face
        k0 = +0.73956515; k1 = -0.45954404; k2 = +0.08285427; k3 = +0.12541070; k4 = +0.14503204;
        wl = -1.2684380046; wm = +2.6097574011; ws = -0.3413193965;
    } else { // Blue face
        k0 = +1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = +0.00692167;
        wl = -0.0041960863; wm = -0.7034186147; ws = +1.7076147010;
    }

    // Approximate maximum saturation using a polynomial
    let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

    // Refine the saturation value using Newton-Raphson or Halley's method
    // This finds the point where one of the linear sRGB components equals 1
    let k_l = +0.3963377774 * a + 0.2158037573 * b;
    let k_m = -0.1055613458 * a - 0.0638541728 * b;
    let k_s = -0.0894841775 * a - 1.2914855480 * b;

    { // Halley's method refinement step (scoped block)
        let l_ = 1 + S * k_l; let m_ = 1 + S * k_m; let s_ = 1 + S * k_s;
        let l = l_ * l_ * l_; let m = m_ * m_ * m_; let s = s_ * s_ * s_;
        let l_dS = 3 * k_l * l_ * l_; let m_dS = 3 * k_m * m_ * m_; let s_dS = 3 * k_s * s_ * s_;
        let l_dS2 = 6 * k_l * k_l * l_; let m_dS2 = 6 * k_m * k_m * m_; let s_dS2 = 6 * k_s * k_s * s_;
        let f = wl * l + wm * m + ws * s; // Equation for the limiting RGB component = 1
        let f1 = wl * l_dS + wm * m_dS + ws * s_dS; // First derivative w.r.t S
        let f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2; // Second derivative w.r.t S
        let halley_denom = f1 * f1 - 0.5 * f * f2;
        if (Math.abs(halley_denom) > 1e-7) {
            S = S - f * f1 / halley_denom; // Update S
        }
    }
    return Math.max(0, S); // Ensure saturation is non-negative
}

/**
 * Finds the point (L_cusp, C_cusp) on the Oklab plane where the surface
 * of the sRGB gamut is furthest from the neutral axis (achromatic point)
 * for a given hue angle (a, b). This is the "cusp" of the gamut projection.
 * @param {number} a - Oklab 'a' component derived from hue.
 * @param {number} b - Oklab 'b' component derived from hue.
 * @returns {number[]} An array [L_cusp, C_cusp] representing the cusp coordinates.
 */
function find_cusp(a, b) {
    // Find the maximum saturation S for this hue
    let S_cusp = compute_max_saturation(a, b);
    // Convert the point (L=1, a=S_cusp*a, b=S_cusp*b) to linear sRGB
    let rgb_at_max = oklab_to_linear_srgb(1, S_cusp * a, S_cusp * b);
    // Find the maximum component value among R, G, B
    let max_rgb = Math.max(rgb_at_max[0], rgb_at_max[1], rgb_at_max[2], 0);

    // The cusp lightness L_cusp is determined by scaling down from L=1
    // until the brightest linear sRGB component is exactly 1.0
    let L_cusp = (max_rgb > 1e-9) ? Math.cbrt(1 / max_rgb) : 0;
    // The cusp chroma C_cusp is L_cusp scaled by the max saturation S_cusp
    let C_cusp = L_cusp * S_cusp;

    return [L_cusp, C_cusp];
}

/**
 * Finds the intersection point 't' (0 <= t <= 1) of a line segment in Oklab space
 * with the sRGB gamut boundary. The line segment starts at (L0, C=0) and ends at (L1, C1).
 * Used to determine the maximum possible chroma for a given lightness and hue.
 * @param {number} a - Oklab 'a' component derived from hue.
 * @param {number} b - Oklab 'b' component derived from hue.
 * @param {number} L1 - Target Oklab Lightness.
 * @param {number} C1 - Target Oklab Chroma (usually 1 for finding max C).
 * @param {number} L0 - Starting Oklab Lightness (usually same as L1).
 * @param {number[]} [cusp=null] - Precomputed cusp [L_cusp, C_cusp] for optimization.
 * @returns {number} The intersection parameter 't', where the actual maximum chroma is t * C1.
 */
function find_gamut_intersection(a, b, L1, C1, L0, cusp = null) {
    if (!cusp) {
        cusp = find_cusp(a, b); // Calculate cusp if not provided
    }
    let cusp_L = cusp[0];
    let cusp_C = cusp[1];

    // Avoid issues with zero chroma
    if (C1 < 1e-7) return 0;

    let t; // Intersection parameter
    let dL = L1 - L0; // Change in Lightness (often 0)
    let dC = C1;      // Change in Chroma (usually C1 itself)

    // Determine if the intersection is with the "top" or "bottom" part of the gamut boundary
    // The line segment connects (L0, 0) to (L1, C1).
    // We check if this segment crosses the line from the cusp to the black point (L=0, C=0)
    // or the line from the cusp to the white point (L=1, C=0).

    // Check intersection with the line segment from the cusp to the black point (0,0)
    if (dL * cusp_C - (cusp_L - L0) * dC <= 0) {
        // Intersection is on the segment connecting (0,0) and (L_cusp, C_cusp)
        let denominator = dC * cusp_L + cusp_C * (-dL);
        t = (Math.abs(denominator) < 1e-7) ? 0 : cusp_C * L0 / denominator;
    }
    // Check intersection with the line segment from the cusp to the white point (1,0)
    else {
        // Intersection is on the segment connecting (L_cusp, C_cusp) and (1,0)
        let denominator = dC * (cusp_L - 1) + cusp_C * (-dL);
        t = (Math.abs(denominator) < 1e-7) ? 1 : cusp_C * (L0 - 1) / denominator;

        // Refine intersection using Newton-Raphson or Halley's method if t is between 0 and 1
        // This finds the precise point where an sRGB component becomes 0 or 1.
        if (t > 1e-7 && t < 1.0) {
            let k_l = +0.3963377774 * a + 0.2158037573 * b;
            let k_m = -0.1055613458 * a - 0.0638541728 * b;
            let k_s = -0.0894841775 * a - 1.2914855480 * b;
            let l_dt = dL + dC * k_l; let m_dt = dL + dC * k_m; let s_dt = dL + dC * k_s;

            { // Halley's method refinement (scoped block)
                let L = L0 * (1 - t) + t * L1; let C = t * C1;
                let l_ = L + C * k_l; let m_ = L + C * k_m; let s_ = L + C * k_s;
                let l = l_ * l_ * l_; let m = m_ * m_ * m_; let s = s_ * s_ * s_;
                let ldt = 3 * l_dt * l_ * l_; let mdt = 3 * m_dt * m_ * m_; let sdt = 3 * s_dt * s_ * s_;
                let ldt2 = 6 * l_dt * l_dt * l_; let mdt2 = 6 * m_dt * m_dt * m_; let sdt2 = 6 * s_dt * s_dt * s_;

                // Check R, G, B boundaries
                let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1; // R = 1 boundary
                let r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
                let r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;

                let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1; // G = 1 boundary
                let g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
                let g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;

                let b_res = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s - 1; // B = 1 boundary
                let b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.7076147010 * sdt;
                let b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.7076147010 * sdt2;

                let r_denom = r1 * r1 - 0.5 * r * r2; let g_denom = g1 * g1 - 0.5 * g * g2; let b_denom = b1 * b1 - 0.5 * b_res * b2;
                let u_r = Math.abs(r_denom) > 1e-7 ? r1 / r_denom : 0; let t_r = -r * u_r;
                let u_g = Math.abs(g_denom) > 1e-7 ? g1 / g_denom : 0; let t_g = -g * u_g;
                let u_b = Math.abs(b_denom) > 1e-7 ? b1 / b_denom : 0; let t_b = -b_res * u_b;

                t_r = u_r >= 0 ? t_r : Infinity; t_g = u_g >= 0 ? t_g : Infinity; t_b = u_b >= 0 ? t_b : Infinity;
                let dt = Math.min(t_r, t_g, t_b); // Smallest step to reach a boundary
                if (isFinite(dt)) t += dt; // Update t
            }
        }
    }
    // Clamp t to the valid range [0, 1]
    return Math.max(0, Math.min(1, t));
}

/**
 * Calculates the maximum saturation (S_max) and lightness contrast (T_max)
 * achievable for a given hue angle (a_, b_) at the gamut cusp.
 * S = C/L, T = C/(1-L)
 * @param {number} a_ - Oklab 'a' component derived from hue.
 * @param {number} b_ - Oklab 'b' component derived from hue.
 * @param {number[]} [cusp=null] - Precomputed cusp [L_cusp, C_cusp] for optimization.
 * @returns {number[]} An array [S_max, T_max].
 */
function get_ST_max(a_, b_, cusp = null) {
    if (!cusp) {
        cusp = find_cusp(a_, b_); // Calculate cusp if not provided
    }
    let L = cusp[0]; // L_cusp
    let C = cusp[1]; // C_cusp

    // S = C/L (max saturation relative to lightness)
    let S_max = (L > 1e-7) ? C / L : 0;
    // T = C/(1-L) (max saturation relative to darkness)
    let T_max = ((1 - L) > 1e-7) ? C / (1 - L) : 0;

    return [S_max, T_max];
}

/**
 * Calculates characteristic chroma values (C_0, C_mid, C_max) for a given
 * Oklab Lightness (L) and hue angle (a_, b_). These represent different
 * levels of chroma corresponding to specific saturation levels in OKHSL.
 * - C_max: Maximum possible chroma at this L and hue (gamut boundary).
 * - C_mid: Chroma corresponding to a perceptually medium saturation.
 * - C_0: Chroma corresponding to a lower saturation threshold.
 * @param {number} L - Oklab Lightness component.
 * @param {number} a_ - Oklab 'a' component derived from hue.
 * @param {number} b_ - Oklab 'b' component derived from hue.
 * @returns {number[]} An array [C_0, C_mid, C_max].
 */
function get_Cs(L, a_, b_) {
    var cusp = find_cusp(a_, b_); // Find the cusp for this hue

    // C_max: Find the maximum chroma by intersecting with the gamut boundary
    // We test intersection from (L, 0) to (L, 1)
    let C_max = find_gamut_intersection(a_, b_, L, 1, L, cusp);

    // Get S_max and T_max at the cusp
    let ST_max = get_ST_max(a_, b_, cusp);

    // Polynomial approximation for S_mid (perceptually medium saturation) based on hue
    let S_mid = 0.11516993 + 1 / (
        +7.44778970 + 4.15901240 * b_ + a_ * (
        -2.19557347 + 1.75198401 * b_ + a_ * (
        -2.13704948 - 10.02301043 * b_ + a_ * (
        -4.24894561 + 5.38770819 * b_ + 4.69891013 * a_)))
    );
    // Polynomial approximation for T_mid (perceptually medium contrast) based on hue
    let T_mid = 0.11239642 + 1 / (
        +1.61320320 - 0.68124379 * b_ + a_ * (
        +0.40370612 + 0.90148123 * b_ + a_ * (
        -0.27087943 + 0.61223990 * b_ + a_ * (
        +0.00299215 - 0.45399568 * b_ - 0.14661872 * a_)))
    );

    // Calculate C_mid based on S_mid, T_mid, and C_max
    // This involves finding a point on a curve connecting C=0 at L=0 and L=1
    let S_max_L = L * ST_max[0];
    let T_max_1_L = (1 - L) * ST_max[1];
    let min_ST_L = Math.min(Math.max(1e-7, S_max_L), Math.max(1e-7, T_max_1_L));
    let k = C_max / min_ST_L; // Scaling factor based on gamut boundary

    let C_mid;
    { // Scoped block for C_mid calculation
        let C_a = L * S_mid;
        let C_b = (1 - L) * T_mid;
        // Weighted harmonic mean-like calculation
        let C_a4 = (C_a > 1e-7) ? 1 / (C_a * C_a * C_a * C_a) : Infinity;
        let C_b4 = (C_b > 1e-7) ? 1 / (C_b * C_b * C_b * C_b) : Infinity;
        let inv_sum = C_a4 + C_b4;
        C_mid = (isFinite(inv_sum) && inv_sum > 1e-9) ? 0.9 * k * Math.pow(inv_sum, -0.25) : 0;
    }

    // Calculate C_0 based on fixed S=0.4 and T=0.8 thresholds
    let C_0;
    { // Scoped block for C_0 calculation
        let C_a = L * 0.4;
        let C_b = (1 - L) * 0.8;
        // Weighted harmonic mean-like calculation
        let C_a2 = (C_a > 1e-7) ? 1 / (C_a * C_a) : Infinity;
        let C_b2 = (C_b > 1e-7) ? 1 / (C_b * C_b) : Infinity;
        let inv_sum = C_a2 + C_b2;
        C_0 = (isFinite(inv_sum) && inv_sum > 1e-9) ? Math.pow(inv_sum, -0.5) : 0;
    }

    // Return the calculated chroma values, ensuring they are non-negative and finite
    return [
        Math.max(0, isFinite(C_0) ? C_0 : 0),
        Math.max(0, isFinite(C_mid) ? C_mid : 0),
        Math.max(0, isFinite(C_max) ? C_max : 0)
    ];
}

/**
 * Applies the sRGB gamma correction (transfer function) to a linear sRGB value.
 * @param {number} linear_component - A linear sRGB component value (0 to 1).
 * @returns {number} The gamma-corrected sRGB component value (0 to 1).
 */
function srgb_transfer_function(linear_component) {
    const clamped_val = Math.max(0, Math.min(1, linear_component)); // Clamp to [0, 1]
    // Use the standard sRGB transfer function formula
    return (clamped_val <= 0.0031308)
        ? 12.92 * clamped_val
        : 1.055 * Math.pow(clamped_val, 1.0 / 2.4) - 0.055;
}

/**
 * Converts an OKHSL color value to an sRGB color value.
 * @param {number} h - Hue (0 to 1, wraps around).
 * @param {number} s - Saturation (0 to 1).
 * @param {number} l - Lightness (0 to 1).
 * @returns {number[]} An array [r, g, b] representing the sRGB color (0-255).
 */
function okhsl_to_srgb(h, s, l) {
    // Normalize and clamp inputs
    h = h % 1.0; // Wrap hue
    if (h < 0) h += 1.0;
    s = Math.max(0, Math.min(1, s)); // Clamp saturation
    l = Math.max(0, Math.min(1, l)); // Clamp lightness

    // Handle edge cases: pure white and pure black
    if (l >= 0.999999) return [255, 255, 255];
    if (l <= 0.000001) return [0, 0, 0];

    // Convert HSL to Oklab components
    let a_ = Math.cos(2 * Math.PI * h); // Oklab 'a' component direction
    let b_ = Math.sin(2 * Math.PI * h); // Oklab 'b' component direction
    let L = toe_inv(l);                 // Oklab Lightness

    // Get characteristic chroma values for this lightness and hue
    let Cs = get_Cs(L, a_, b_);
    let C_0 = Cs[0];
    let C_mid = Cs[1];
    let C_max = Cs[2];

    // Handle grayscale case (zero saturation or zero max chroma)
    if (C_max < 1e-7 || s < 1e-7) {
        let gray_linear = oklab_to_linear_srgb(L, 0, 0); // Convert Oklab gray to linear sRGB gray
        let gray_val = Math.round(255 * srgb_transfer_function(gray_linear[0])); // Apply gamma and scale
        return [gray_val, gray_val, gray_val];
    }

    // Interpolate Chroma (C) based on saturation (s)
    // This uses a two-part interpolation curve based on C_0, C_mid, C_max
    let C, t, k_0, k_1, k_2;

    if (s < 0.8) {
        // Interpolate between 0 and C_mid for s < 0.8
        t = 1.25 * s; // Scale s from [0, 0.8) to [0, 1)
        k_0 = 0;
        k_1 = 0.8 * C_0; // Target chroma derived from C_0
        k_2 = (C_mid > 1e-7) ? (1 - k_1 / C_mid) : 0; // Shape parameter
    } else {
        // Interpolate between C_mid and C_max for s >= 0.8
        t = 5 * (s - 0.8); // Scale s from [0.8, 1] to [0, 1)
        k_0 = C_mid;
        k_1 = (C_0 > 1e-7) ? (0.2 * C_mid * C_mid * 1.25 * 1.25 / C_0) : 0; // Target chroma derived from C_mid and C_0
        let denom = C_max - C_mid;
        k_2 = (denom > 1e-7) ? (1 - (k_1) / denom) : 0; // Shape parameter
    }

    // Apply the interpolation formula: C = k_0 + t * k_1 / (1 - k_2 * t)
    let interp_denom = (1 - k_2 * t);
    if (Math.abs(interp_denom) < 1e-7) {
        C = C_max; // Avoid division by zero, use max chroma
    } else {
        C = k_0 + t * k_1 / interp_denom;
    }
    C = Math.max(0, C); // Ensure chroma is non-negative

    // Convert final Oklab (L, C*a_, C*b_) to linear sRGB
    let rgb_linear = oklab_to_linear_srgb(L, C * a_, C * b_);

    // Apply sRGB transfer function (gamma correction) and scale to 0-255
    let r = Math.round(255 * srgb_transfer_function(rgb_linear[0]));
    let g = Math.round(255 * srgb_transfer_function(rgb_linear[1]));
    let b = Math.round(255 * srgb_transfer_function(rgb_linear[2]));

    // Clamp final RGB values to the valid 0-255 range
    return [
        Math.max(0, Math.min(255, r)),
        Math.max(0, Math.min(255, g)),
        Math.max(0, Math.min(255, b))
    ];
}


// --- Main Exposed Function ---

/**
 * Calculates the sRGB color for a given MIDI note number.
 *
 * @param {number} midiNote - The MIDI note number (integer, typically 0-127).
 * Values outside the configured range [MIDI_START, MIDI_END]
 * will be clamped for lightness calculation.
 * @returns {number[]} An array [r, g, b] representing the sRGB color (0-255).
 * Returns black ([0, 0, 0]) if the input is invalid.
 */
function getMidiNoteColor(midiNote) {
    // Basic input validation
    if (typeof midiNote !== 'number' || !Number.isInteger(midiNote)) {
        console.error("Invalid input: midiNote must be an integer.", midiNote);
        return [0, 0, 0]; // Return black for invalid input
    }

    // 1. Determine Pitch Class (0-11)
    const pitchClass = midiNote % 12;

    // 2. Get Hue from Pitch Class
    const hueDegrees = PITCH_CLASS_HUE_MAP_DEGREES[pitchClass];
    const hue = hueDegrees / 360.0; // Convert degrees (0-360) to normalized hue (0-1)

    // 3. Calculate Lightness based on MIDI note number
    const lightness = getLightness(midiNote); // Uses clamping internally

    // 4. Use fixed Saturation
    const saturation = SATURATION;

    // 5. Convert OKHSL to sRGB
    const [r, g, b] = okhsl_to_srgb(hue, saturation, lightness);

    // 6. Return the RGB array
    return [r, g, b];
}

// --- Optional: Export for module usage ---
// If you intend to use this file as an ES module, uncomment the following line:
// export { getMidiNoteColor };

// Example Usage (can be commented out or removed in final file):
/*
console.log("C4 (MIDI 60):", getMidiNoteColor(60)); // Example: Middle C
console.log("A4 (MIDI 69):", getMidiNoteColor(69)); // Example: A440
console.log("C1 (MIDI 24):", getMidiNoteColor(24)); // Example: Low end
console.log("C8 (MIDI 108):", getMidiNoteColor(108)); // Example: High end
console.log("Out of Range Low (MIDI 10):", getMidiNoteColor(10)); // Clamped to MIDI 24 lightness
console.log("Out of Range High (MIDI 120):", getMidiNoteColor(120)); // Clamped to MIDI 108 lightness
console.log("Invalid Input:", getMidiNoteColor("test"));
*/
