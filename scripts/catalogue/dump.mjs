import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable, Transform } from "node:stream";
import { createGunzip } from "node:zlib";

/**
 * Reads the Open Food Facts JSONL export line by line, and fails loudly if it does not
 * read all of it.
 *
 * This exists because of a silent failure: `source.pipe(gunzip)` does not forward errors,
 * so a dropped connection midway through the 12 GB download reached the line reader as a
 * clean end-of-file. The build "succeeded" with 934k of the roughly 1.2M products that
 * have usable nutrition, and the only symptom was that well-known barcodes were missing
 * from a mirror that otherwise looked healthy.
 *
 * Two guards prevent a repeat: every stream error is latched and rethrown after the loop,
 * and a network read is checked against the Content-Length it promised.
 */
export const DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";

/** Counts bytes and rejects a body that ends short of its declared length. */
function byteCounter(expected) {
  let received = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      if (expected && received < expected) {
        callback(new Error(`Download truncated: read ${received.toLocaleString()} of ${expected.toLocaleString()} bytes. Re-run, or download the export to disk first and pass --source=<path>.`));
        return;
      }
      callback();
    },
  });
}

/**
 * Yields one JSON-decoded product per line. Throws rather than ending early when the
 * underlying download or decompression fails.
 */
export async function* readDump(source) {
  const failures = [];
  const latch = (stream) => stream.on("error", (error) => failures.push(error));

  let input;
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { headers: { "User-Agent": "Calorie Flow/1.0 (catalogue)" } });
    if (!response.ok || !response.body) throw new Error(`Could not download the Open Food Facts export: ${response.status}`);
    const counter = byteCounter(Number(response.headers.get("content-length")) || 0);
    const body = Readable.fromWeb(response.body);
    latch(body); latch(counter);
    // Destroying downstream on error is what turns a broken pipe into a thrown error
    // instead of a short, silently truncated read.
    body.on("error", (error) => counter.destroy(error));
    input = body.pipe(counter);
  } else {
    const file = createReadStream(source);
    latch(file);
    input = file;
  }

  const gunzip = createGunzip();
  latch(gunzip);
  input.on("error", (error) => gunzip.destroy(error));

  const lines = createInterface({ input: input.pipe(gunzip), crlfDelay: Infinity });
  for await (const line of lines) {
    if (failures.length) break;
    if (!line) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // A single malformed line is survivable; a broken stream is not.
    }
  }
  if (failures.length) throw failures[0];
}
