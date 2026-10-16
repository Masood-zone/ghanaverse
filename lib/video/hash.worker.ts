import { md5 } from "hash-wasm"
self.onmessage = async (
  event: MessageEvent<{ id: string; bytes: ArrayBuffer }>
) => {
  try {
    self.postMessage({
      id: event.data.id,
      md5: await md5(new Uint8Array(event.data.bytes)),
    })
  } catch {
    self.postMessage({
      id: event.data.id,
      error: "File integrity check failed.",
    })
  }
}
