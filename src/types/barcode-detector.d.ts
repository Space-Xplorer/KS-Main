/**
 * Minimal ambient type for the native Shape Detection API's BarcodeDetector.
 * Not yet in TypeScript's DOM lib. Supported in Chromium-based browsers;
 * every call site in this codebase feature-detects before using it.
 */
interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: readonly string[] }): BarcodeDetector;
  getSupportedFormats(): Promise<readonly string[]>;
}

interface Window {
  readonly BarcodeDetector?: BarcodeDetectorConstructor;
}
