// Vision layer: MediaPipe wrappers.
// Produces normalized landmarks in [0, 1] for the engine; never passes raw
// pixel coordinates downstream so the engine stays DOM-free and testable.
//
// Exports will be added here as HandLandmarker and FaceLandmarker wrappers
// are implemented.
export {};
