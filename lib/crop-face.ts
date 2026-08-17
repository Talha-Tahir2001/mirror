import { detectFace, type DetectedFace } from './face-detect';

const TARGET_SHORT_SIDE = 1080;
const CAP_LONG_SIDE = 2560;
const MAX_BRIGHTEN = 1.6;
const LUMINANCE_THRESHOLD = 110;
const MIN_SOURCE_SHORT_SIDE = 540;

// YouCam requires the face to fill at least ~60% of the image width (60–80%
// ideal). We aim to make it land at ~72%.
const FACE_TARGET_FRACTION = 0.72;
const FACE_DETECT_MAX_SIDE = 1024;

export interface CropDiagnostics {
    sourceWidth: number;
    sourceHeight: number;
    outputWidth: number;
    outputHeight: number;
    avgLuminance: number;
    upscaled: boolean;
    brightened: boolean;
    faceAnchored: boolean;
    warnings: string[]; // 'dark' | 'small'
}

export interface CropResult {
    file: File;
    diagnostics: CropDiagnostics;
}

/**
 * Prepares a selfie for YouCam AI Skin Analysis (SD mode: min short side
 * 480px, portrait strongly recommended, bright even lighting, face >= 60% of
 * image width).
 *
 * Detects the face when possible and crops a portrait window anchored on it so
 * the face dominates the frame; falls back to a centered 3:4 crop when
 * detection is unavailable. Then upscales so the short side clears the SD
 * minimum (and is HD-ready), auto-brightens dim photos, and folds PNG alpha
 * onto white so transparency can never read as a dark image.
 */
export async function cropFaceForYouCam(file: File): Promise<CropResult> {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    console.log(
        `[crop-face] original: ${width}x${height}, ${(file.size / 1024).toFixed(0)}KB`,
    );

    const isLandscape = width > height;
    const fallbackCropBox = isLandscape
        ? landscapeCropBox(width, height)
        : portraitCropBox(width, height);

    const detectedFace = await detectFaceOnBitmap(bitmap);
    const cropBox = detectedFace
        ? (faceZoomCrop(detectedFace, width, height) ?? fallbackCropBox)
        : fallbackCropBox;

    // Output size: prefer a short side of TARGET_SHORT_SIDE, but never let the
    // long side exceed CAP_LONG_SIDE (YouCam auto-resizes there anyway, and it
    // keeps the JPEG well under the 10MB file cap).
    const baseShort = Math.min(cropBox.w, cropBox.h);
    const baseLong = Math.max(cropBox.w, cropBox.h);
    let scale = Math.max(TARGET_SHORT_SIDE / baseShort, 1);
    if (baseLong * scale > CAP_LONG_SIDE) {
        scale = CAP_LONG_SIDE / baseLong;
    }
    const outW = Math.round(cropBox.w * scale);
    const outH = Math.round(cropBox.h * scale);

    // Pass 1 — render unmodified so we can read the real luminance.
    const probe = document.createElement('canvas');
    probe.width = outW;
    probe.height = outH;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true })!;
    probeCtx.imageSmoothingQuality = 'high';
    probeCtx.drawImage(
        bitmap,
        cropBox.x, cropBox.y, cropBox.w, cropBox.h,
        0, 0, outW, outH,
    );

    const avgLuminance = averageLuminance(probeCtx, outW, outH);

    const brightnessFactor =
        avgLuminance < LUMINANCE_THRESHOLD
            ? Math.min(MAX_BRIGHTEN, Math.max(1, 115 / Math.max(avgLuminance, 1)))
            : 1;

    // Pass 2 — white backdrop (alpha fold) + optional adaptive brightness boost.
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    if (brightnessFactor > 1) {
        ctx.filter = `brightness(${brightnessFactor.toFixed(2)})`;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        bitmap,
        cropBox.x, cropBox.y, cropBox.w, cropBox.h,
        0, 0, outW, outH,
    );

    bitmap.close();

    const output = await canvasToJpeg(canvas, file.name);
    console.log(
        `[crop-face] output: ${outW}x${outH}, ${(output.size / 1024).toFixed(0)}KB, luma=${avgLuminance.toFixed(0)}, brightness=${brightnessFactor.toFixed(2)}, face=${detectedFace ? 'anchored' : 'center'}`,
    );

    const warnings: string[] = [];
    if (avgLuminance < LUMINANCE_THRESHOLD) warnings.push('dark');
    if (Math.min(width, height) < MIN_SOURCE_SHORT_SIDE) warnings.push('small');

    return {
        file: output,
        diagnostics: {
            sourceWidth: width,
            sourceHeight: height,
            outputWidth: outW,
            outputHeight: outH,
            avgLuminance: Math.round(avgLuminance),
            upscaled: scale > 1.01,
            brightened: brightnessFactor > 1.01,
            faceAnchored: detectedFace !== null,
            warnings,
        },
    };
}

// Runs detection on a downscaled full-image canvas (cheaper + more reliable at
// moderate size), then maps the box back to source pixels.
async function detectFaceOnBitmap(
    bitmap: ImageBitmap,
): Promise<DetectedFace | null> {
    const iw = bitmap.width;
    const ih = bitmap.height;
    const scale = Math.min(1, FACE_DETECT_MAX_SIDE / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const face = await detectFace(canvas);
    if (!face) return null;

    return {
        x: face.x / scale,
        y: face.y / scale,
        w: face.w / scale,
        h: face.h / scale,
    };
}

// Builds a portrait crop (3:4 preferred) anchored on the face so it fills a
// large share of the frame, clamped to the source bounds. Returns null if the
// box would be unusably small.
function faceZoomCrop(
    face: DetectedFace,
    iw: number,
    ih: number,
): CropBox | null {
    if (!(face.w > 20 && face.h > 20)) return null;

    const cx = face.x + face.w / 2;
    const cy = face.y + face.h / 2;

    // Width that puts the face at ~72% of the crop width.
    let w = face.w / FACE_TARGET_FRACTION;
    let h = w * (4 / 3);

    if (h > ih) {
        h = ih; // height-limited source (e.g. landscape) — full height
    }
    if (h < face.h * 1.15) {
        h = Math.min(ih, face.h * 1.15); // face would clip — add headroom
    }
    if (w > iw) w = iw;
    if (h > ih) h = ih;

    if (w < 240 || h < 240) return null;

    const x = Math.round(clamp(cx - w / 2, 0, iw - w));
    const y = Math.round(clamp(cy - h * 0.94, 0, ih - h));
    return { x, y, w: Math.round(w), h: Math.round(h) };
}

function canvasToJpeg(
    canvas: HTMLCanvasElement,
    name: string,
): Promise<File> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas export failed'));
                return;
            }
            resolve(new File([blob], name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
    });
}

// Average luma of a sparse sample (cap ~20k pixels) so measurement is cheap
// even on large canvases.
function averageLuminance(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
): number {
    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
    let sum = 0;
    let count = 0;
    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            const i = (y * w + x) * 4;
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            count++;
        }
    }
    return count === 0 ? 0 : sum / count;
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

interface CropBox { x: number; y: number; w: number; h: number }

// For landscape images: cut a portrait window from the horizontal center.
// A landscape selfie typically has the face in the center third of the frame.
// We take the middle portion with a 3:4 ratio.
function landscapeCropBox(iw: number, ih: number): CropBox {
    // Use full height, derive width from 3:4 ratio
    const h = ih;
    const w = Math.round(h * (3 / 4));

    if (w > iw) {
        // Image is already narrower than 3:4 — use full width
        return { x: 0, y: 0, w: iw, h: ih };
    }

    // Center horizontally
    const x = Math.round((iw - w) / 2);
    return { x, y: 0, w, h };
}

// For portrait images: crop to 3:4 centered slightly upward.
function portraitCropBox(iw: number, ih: number): CropBox {
    const targetAspect = 3 / 4;

    if (iw / ih <= targetAspect) {
        // Already portrait enough — use full image
        return { x: 0, y: 0, w: iw, h: ih };
    }

    // Constrain by height, center horizontally
    const h = ih;
    const w = Math.round(h * targetAspect);
    const x = Math.round((iw - w) / 2);
    return { x, y: 0, w, h };
}