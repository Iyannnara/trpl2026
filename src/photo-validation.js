export async function validatePhoto(file) {
  if (!file) return 'Pilih foto terlebih dahulu.';
  if (file.size > 5 * 1024 * 1024) return 'Ukuran foto maksimal 5 MB.';

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const validType = (file.type === 'image/jpeg' && isJpeg)
    || (file.type === 'image/png' && isPng)
    || (file.type === 'image/webp' && isWebp);

  return validType ? '' : 'Isi file tidak cocok. Pilih foto JPG, PNG, atau WebP yang valid.';
}