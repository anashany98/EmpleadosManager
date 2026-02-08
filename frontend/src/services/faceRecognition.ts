import * as faceapi from 'face-api.js';

// Configuration
// In production, these should be hosted on CDN or public folder
const MODEL_URL = '/models';

export const FaceRecognitionService = {
    isLoaded: false,

    async loadModels() {
        if (this.isLoaded) return;

        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            ]);
            this.isLoaded = true;
            console.log('FaceAPI Models Loaded');
        } catch (error) {
            console.error('Failed to load FaceAPI models:', error);
            throw error;
        }
    },

    async getFaceDescriptor(imageElement: HTMLVideoElement | HTMLImageElement): Promise<Float32Array | undefined> {
        if (!this.isLoaded) await this.loadModels();

        // Safety check for dimensions to prevent "Box.constructor" errors
        if (imageElement instanceof HTMLVideoElement) {
            if (imageElement.videoWidth === 0 || imageElement.videoHeight === 0) return undefined;
        } else if (imageElement instanceof HTMLImageElement) {
            if (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0) return undefined;
        }

        try {
            // Use TinyFaceDetector for performance on tablets
            const detection = await faceapi
                .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) return undefined;
            return detection.descriptor;
        } catch (error) {
            console.warn('FaceAPI detection suppressed:', error);
            return undefined;
        }
    },

    async getFullDetection(imageElement: HTMLVideoElement | HTMLImageElement) {
        if (!this.isLoaded) await this.loadModels();
        try {
            return await faceapi
                .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withFaceDescriptor();
        } catch (error) {
            return undefined;
        }
    },

    detectBlink(landmarks: faceapi.FaceLandmarks68): boolean {
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const getEAR = (eye: faceapi.Point[]) => {
            const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
            const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
            const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
            return (v1 + v2) / (2.0 * h);
        };

        const earLeft = getEAR(leftEye);
        const earRight = getEAR(rightEye);
        const avgEAR = (earLeft + earRight) / 2;

        // Threshold for blink is usually around 0.2 - 0.25
        return avgEAR < 0.22;
    },

    detectOrientation(landmarks: faceapi.FaceLandmarks68): 'CENTER' | 'LEFT' | 'RIGHT' | 'UNKNOWN' {
        const nose = landmarks.getNose();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Simple heuristic based on horizontal distances
        const leftDist = nose[0].x - leftEye[0].x;
        const rightDist = rightEye[3].x - nose[0].x;
        const ratio = leftDist / rightDist;

        if (ratio > 1.5) return 'RIGHT'; // Looking right makes the left side look bigger? Wait.
        // Actually: Looking left -> nose moves right -> rightDist decreases -> ratio increases.
        if (ratio > 1.6) return 'LEFT';
        if (ratio < 0.6) return 'RIGHT';
        return 'CENTER';
    },

    getAverageDescriptor(descriptors: Float32Array[]): number[] {
        if (descriptors.length === 0) return [];
        const len = descriptors[0].length;
        const average = new Array(len).fill(0);

        for (const descriptor of descriptors) {
            for (let i = 0; i < len; i++) {
                average[i] += descriptor[i];
            }
        }

        return average.map(val => val / descriptors.length);
    },

    getDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
        return faceapi.euclideanDistance(descriptor1, descriptor2);
    }
};
