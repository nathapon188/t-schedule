import { createWorker } from 'tesseract.js'

let workerPromise = null

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress?.({ stage: 'Reading text', progress: m.progress })
        else onProgress?.({ stage: m.status.replace(/^\w/, (c) => c.toUpperCase()), progress: m.progress })
      },
    })
  }
  return workerPromise
}

/**
 * Upscale small images before OCR: tesseract wants roughly 300dpi text, and
 * screenshots of forms are usually well under that.
 */
async function prepare(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, Math.max(1, 1600 / bitmap.width))
  if (scale === 1) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function readImage(file, onProgress) {
  const worker = await getWorker(onProgress)
  const input = await prepare(file)
  const { data } = await worker.recognize(input)
  return data.text
}

export async function disposeOcr() {
  if (!workerPromise) return
  const worker = await workerPromise
  workerPromise = null
  await worker.terminate()
}
