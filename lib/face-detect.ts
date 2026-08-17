// Lazily-loaded MediaPipe face detection. Everything is wrapped in try/catch
// and returns null on any failure so the app keeps working (center-crop
// fallback) even when the wasm/model CDN is unreachable.

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
// Vendored in public/mediapipe so it works without Google Storage access / CORS.
const MODEL_URL = '/mediapipe/blaze_face_short_range.tflite';

export interface DetectedFace {
    x: number;
    y: number;
    w: number;
    h: number;
}

type FaceDetectorInstance = import('@mediapipe/tasks-vision').FaceDetector;

let detectorPromise: Promise<FaceDetectorInstance | null> | null = null;

function getDetector(): Promise<FaceDetectorInstance | null> {
    if (typeof window === 'undefined') return Promise.resolve(null);

    if (!detectorPromise) {
        detectorPromise = (async () => {
            try {
                const { FaceDetector, FilesetResolver } = await import(
                    '@mediapipe/tasks-vision'
                );
                const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
                return await FaceDetector.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: MODEL_URL },
                    runningMode: 'IMAGE',
                    minDetectionConfidence: 0.5,
                });
            } catch (err) {
                console.warn('[face-detect] face detector unavailable:', err);
                return null;
            }
        })();
    }
    return detectorPromise;
}

/**
 * Returns the largest detected face bounding box (source-pixel coords of the
 * passed canvas), or null when detection is unavailable or finds no face.
 */
export async function detectFace(
    image: HTMLCanvasElement,
): Promise<DetectedFace | null> {
    const detector = await getDetector();
    if (!detector) return null;

    try {
        const result = detector.detect(image);
        const detection = result.detections?.[0];
        const bb = detection?.boundingBox;
        if (!bb || !(bb.width > 8 && bb.height > 8)) return null;
        return {
            x: bb.originX,
            y: bb.originY,
            w: bb.width,
            h: bb.height,
        };
    } catch (err) {
        console.warn('[face-detect] detection failed:', err);
        return null;
    }
}