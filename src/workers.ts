// comlink
import Comlink, { Remote } from 'comlink';

// local
import getKeys from './utils/getKeys';

// ///// //
// Types //
// ///// //

/**
 * Worker location options. All options support relative URLs.
 */
export type WorkerLocationOptions = {
  /** The directory where the workers scripts are available */
  base?: string;
  /** The location of the decryption Worker script */
  decrypt?: string;
  /** The location of the zip Worker script */
  zip?: string;
  /** The location of the StreamSaver ServiceWorker script */
  StreamSaver?: string;
};

/**
 * Worker location URLs. All fields are absolute URLs.
 */
export type WorkerLocation = {
  /** The directory where the workers scripts are available */
  base: URL;
  /** The location of the decryption Worker script */
  decrypt: URL;
  /** The location of the zip Worker script */
  zip: URL;
  /** The location of the StreamSaver ServiceWorker script */
  StreamSaver: URL;
};

/**
 * An individual Penumbra Worker's interfaces
 */
export type PenumbraWorker = {
  /** The worker's DOM interface */
  worker: Worker;
  /** The worker's Comlink interface */
  comlink: Remote<Worker>;
};

/**
 * An individual Penumbra ServiceWorker's interfaces
 */
export type PenumbraServiceWorker = {
  /** The worker's DOM interface */
  worker: ServiceWorker;
  /** The worker's comlink interface */
  comlink: Remote<Worker>;
};

/** The penumbra workers themselves */
export type PenumbraWorkers = {
  /** The decryption Worker */
  decrypt: PenumbraWorker;
  /** The zip Worker */
  zip: PenumbraWorker;
  /** The StreamSaver ServiceWorker */
  StreamSaver?: PenumbraServiceWorker;
};

// //// //
// Init //
// //// //

if (!document.currentScript) {
  throw new Error('Penumbra must be included in a document');
}

const penumbra = document.currentScript.dataset;

const resolver = document.createElementNS(
  'http://www.w3.org/1999/xhtml',
  'a',
) as HTMLAnchorElement;

const DEFAULT_WORKERS = {
  decrypt: 'penumbra-decrypt.worker.js',
  zip: 'penumbra-zip.worker.js',
  StreamSaver: 'streamsaver.js',
};

const DEFAULT_WORKERS_JSON = JSON.stringify(DEFAULT_WORKERS);

/**
 * Resolve a potentially relative URL into an absolute URL
 */
function resolve(url: string): URL {
  resolver.href = url;
  // eslint-disable-next-line no-restricted-globals
  return new URL(resolver.href, location.href);
}

// /////// //
// Methods //
// /////// //

/**
 * Gets worker location configuration
 *
 * @param options - A stream of bytes to be saved to disk
 */
export function getWorkerLocation(): WorkerLocation {
  const { base, decrypt, zip, StreamSaver } = JSON.parse(
    penumbra.workers || DEFAULT_WORKERS_JSON,
  );

  const missing: string[] = [];

  if (!decrypt) {
    missing.push('decrypt');
  }
  if (!zip) {
    missing.push('zip');
  }
  if (!StreamSaver) {
    missing.push('StreamSaver');
  }

  if (missing.length) {
    throw new Error(`Missing workers: "${missing.join('", "')}"`);
  }

  // eslint-disable-next-line no-restricted-globals
  const context = resolve(base || location.href);

  return {
    base: context,
    decrypt: new URL(decrypt, context),
    zip: new URL(zip, context),
    StreamSaver: new URL(StreamSaver, context),
  };
}

/** Instantiate a Penumbra Worker */
export function createPenumbraWorker(url: URL | string): PenumbraWorker {
  // Use string literals to provide default worker URL hints to webpack
  // switch (String(url)) {
  //   case DEFAULT_WORKERS.decrypt: {
  //     const worker = new Worker(
  //       '/Users/elijahgrey/transcend/penumbra/src/workers/penumbra-decrypt.worker.js',
  //       {
  //         type: 'module',
  //       },
  //     );
  //     return { worker, comlink: Comlink.wrap(worker) };
  //   }
  //   case DEFAULT_WORKERS.zip: {
  //     const worker = new Worker(
  //       '/Users/elijahgrey/transcend/penumbra/src/workers/penumbra-zip.worker.js',
  //       {
  //         type: 'module',
  //       },
  //     );
  //     return { worker, comlink: Comlink.wrap(worker) };
  //   }
  //   // case DEFAULT_WORKERS.StreamSaver: {
  //   //   const worker = new Worker('./streamsaver.js', { type: 'module' });
  //   //   return { worker, comlink: Comlink.wrap(worker) };
  //   // }
  //   default: {
  const worker = new Worker(url, { type: 'module' });
  return { worker, comlink: Comlink.wrap(worker) };
  //   }
  // }
}

const workers: Partial<PenumbraWorkers> = {};

/** Initializes web worker threads */
export function initWorkers(): void {
  if (!penumbra.initialized) {
    const { decrypt, zip } = getWorkerLocation();
    workers.decrypt = createPenumbraWorker(decrypt);
    workers.zip = createPenumbraWorker(zip);
    penumbra.initialized = 'true';
  }
}

/**
 * Get the initialize the workers (only does this once).s
 *
 * @returns The list of active worker threads
 */
export function getWorkers(): PenumbraWorkers {
  if (!penumbra.initialized) {
    initWorkers();
  }
  return workers as PenumbraWorkers;
}

/**
 * De-allocate temporary Worker object URLs
 */
function cleanup(): void {
  const initializedWorked = getWorkers();
  const threads = getKeys(initializedWorked);
  threads.forEach((thread) => {
    const workerInstance = initializedWorked[thread];
    if (
      workerInstance &&
      workerInstance.worker &&
      workerInstance.worker instanceof Worker
    ) {
      workerInstance.worker.terminate();
    }
  });
}

window.addEventListener('beforeunload', cleanup);

/**
 * Sets worker location configuration
 *
 * @param options - Worker location options
 */
export default function setWorkerLocation(
  options: WorkerLocationOptions,
): void {
  if (penumbra.initialized) {
    console.warn('Penumbra Workers are already active. Reinitializing...');
    cleanup();
  }
  penumbra.workers = JSON.stringify({ ...getWorkerLocation(), ...options });
  initWorkers();
}
