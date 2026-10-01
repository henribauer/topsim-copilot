// Browser only: pdf.js parses in a web worker. Vite serves the worker file from node_modules
// (local, no CDN). Node (the tests) runs pdf.js without a worker, so this is imported from main.tsx.
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;
