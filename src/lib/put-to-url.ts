"use client"

/**
 * PUTs bytes to a pre-signed URL.
 *
 * When the server signed a pinned ContentLength, the browser's own Content-Length has to
 * match it exactly — so the Blob is sent untouched, and the Content-Type header must be
 * the same one that was signed.
 *
 * XHR rather than fetch: upload progress is required for the big video files.
 */
export async function putToUrl(url: string, file: Blob, onProgress?: (pct: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`)))
    xhr.onerror = () =>
      reject(new Error("The upload never reached storage. The R2 bucket needs a CORS policy allowing PUT from this site."))
    xhr.send(file)
  })
}
