const CRC_T = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_T[i] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const tb = new TextEncoder().encode(type);
  const payload = new Uint8Array(tb.length + data.length);
  payload.set(tb); payload.set(data, tb.length);
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(tb, 4);
  out.set(data, 8);
  new DataView(out.buffer).setUint32(8 + data.length, crc32(payload));
  return out;
}

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export interface APNGFrame { img: HTMLImageElement; delay: number; }

export async function decodeAPNG(url: string): Promise<APNGFrame[]> {
  const resp = await fetch(url);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let off = 8;
  let ihdr: Uint8Array | null = null;
  const fcTLs: { delayNum: number; delayDen: number }[] = [];
  const datas: Uint8Array[] = [];

  while (off < buf.length) {
    const len = dv.getUint32(off);
    const t = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    const d = buf.slice(off + 8, off + 8 + len);

    if (t === "IHDR") ihdr = d;
    else if (t === "fcTL") fcTLs.push({ delayNum: dv.getUint16(off + 28), delayDen: dv.getUint16(off + 30) });
    else if (t === "IDAT") datas.push(d);
    else if (t === "fdAT") datas.push(d.slice(4));
    else if (t === "IEND") break;

    off += 12 + len;
  }

  const frames: APNGFrame[] = [];
  for (let i = 0; i < fcTLs.length; i++) {
    const fc = fcTLs[i];
    const delay = (fc.delayNum / (fc.delayDen || 100)) * 1000;
    const idat = datas[i];
    if (!idat || !ihdr) continue;

    const parts = [PNG_SIG, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
    const total = parts.reduce((s, p) => s + p.length, 0);
    const png = new Uint8Array(total);
    let p = 0;
    for (const part of parts) { png.set(part, p); p += part.length; }

    const blob = new Blob([png], { type: "image/png" });
    const burl = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = burl; });
    URL.revokeObjectURL(burl);
    frames.push({ img, delay });
  }
  return frames;
}

export function playAPNG(
  canvas: HTMLCanvasElement,
  frames: APNGFrame[],
): () => void {
  let idx = 0;
  let last = 0;
  let raf = 0;
  const ctx = canvas.getContext("2d")!;

  canvas.width = frames[0].img.naturalWidth;
  canvas.height = frames[0].img.naturalHeight;
  ctx.drawImage(frames[0].img, 0, 0);

  const tick = (t: number) => {
    if (t - last >= frames[idx].delay) {
      idx = (idx + 1) % frames.length;
      last = t;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[idx].img, 0, 0);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
