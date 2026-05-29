/**
 * Client-side mirror of the Python slugify_pool_name() function.
 * Reference: custom_components/iopool/entity.py
 *
 * Algorithm:
 * 1. NFKD normalize → decompose accented characters
 * 2. Remove non-ASCII characters (equivalent to Python's encode("ascii", "ignore"))
 * 3. Lowercase
 * 4. Replace any sequence of non-[a-z0-9] characters with a single underscore
 * 5. Strip leading/trailing underscores
 */
export function slugifyPoolName(name: string): string {
  // 1. NFKD normalize: à → a + combining grave, é → e + combining acute, etc.
  const nfkd = name.normalize('NFKD');

  // 2. Remove non-ASCII characters (0x00–0x7F range)
  const ascii = nfkd.replace(/[^\x00-\x7F]/g, '');

  // 3. Lowercase
  const lowered = ascii.toLowerCase();

  // 4. Replace non-alphanumeric sequences with underscore
  const slugged = lowered.replace(/[^a-z0-9]+/g, '_');

  // 5. Strip leading/trailing underscores
  return slugged.replace(/^_+|_+$/g, '');
}
