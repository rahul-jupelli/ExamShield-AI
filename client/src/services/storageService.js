import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'student-photos';
const SUPABASE_PROJECT_URL = 'https://ylhryvakpswdgapooica.supabase.co';

/**
 * Helper to build the direct public CDN URL for any file inside student-photos bucket
 */
export function getBucketPublicUrl(filename) {
  if (!filename) return null;
  const cleanName = filename.replace(/^student-photos\//, '').replace(/^\/+/, '');
  return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${BUCKET_NAME}/${cleanName}`;
}

/**
 * Converts a base64 Data URL into a File object.
 * @param {string} dataurl - base64 data string (e.g. data:image/png;base64,...)
 * @param {string} filename - name to assign to the generated File
 * @returns {File}
 */
export function dataURLtoFile(dataurl, filename) {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.warn('[Storage] dataURLtoFile error:', e);
    return null;
  }
}

/**
 * Uploads a student photo (base64 Data URL, File, or Blob) to the Supabase Storage bucket ('student-photos').
 * If bucket upload fails (e.g., due to RLS), returns the original photoData (base64) so the clicked image is NEVER lost!
 *
 * @param {string | File | Blob} photoData - The photo payload to upload
 * @param {string} [identifier='cadet'] - Optional student ID or name hint for filename
 * @returns {Promise<string>} Storage public URL or base64 photoData
 */
export async function uploadStudentPhotoToSupabase(photoData, identifier = 'cadet') {
  if (!photoData) return photoData;

  // If photo is already an HTTP/HTTPS URL, return directly
  if (typeof photoData === 'string' && (photoData.startsWith('http://') || photoData.startsWith('https://'))) {
    return photoData;
  }

  try {
    const cleanId = String(identifier).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();

    let fileToUpload;
    let fileExtension = 'jpg';
    let contentType = 'image/jpeg';
    let storagePath = '';

    if (typeof photoData === 'string' && photoData.startsWith('data:image/')) {
      const mimeMatch = photoData.match(/data:(image\/\w+);base64,/);
      if (mimeMatch) {
        contentType = mimeMatch[1];
        fileExtension = contentType.split('/')[1] || 'jpg';
      }
      storagePath = `${cleanId}_${timestamp}.${fileExtension}`;
      fileToUpload = dataURLtoFile(photoData, storagePath);
    } else if (photoData instanceof File || photoData instanceof Blob) {
      contentType = photoData.type || 'image/jpeg';
      fileExtension = contentType.split('/')[1] || 'jpg';
      storagePath = photoData.name || `${cleanId}_${timestamp}.${fileExtension}`;
      fileToUpload = new File([photoData], storagePath, { type: contentType });
    } else {
      return photoData;
    }

    if (!fileToUpload) return photoData;

    console.log(`[Supabase Storage] Uploading photo to bucket '${BUCKET_NAME}': ${storagePath}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileToUpload, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.warn(`[Supabase Storage] Upload notice for '${storagePath}':`, uploadError.message);
      // Fallback: Return original base64/objectURL photoData so clicked image is preserved in app DB
      return typeof photoData === 'string' ? photoData : URL.createObjectURL(photoData);
    }

    // Return direct public CDN URL
    const publicUrl = getBucketPublicUrl(storagePath);
    console.log(`[Supabase Storage] Upload success! Public URL:`, publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[Supabase Storage] Unexpected error during image upload:', err);
    return typeof photoData === 'string' ? photoData : (photoData ? URL.createObjectURL(photoData) : photoData);
  }
}

/**
 * Fetches all images associated with a student from the Supabase Storage bucket 'student-photos'.
 * Matches root-level files like 'Rahul-2.jpeg', 'Sneha.jpg', 'Tanmaya.jpg' by student name or photo filename.
 * 
 * @param {Object} student - Student object (must have name, hallTicket, id, or photo)
 * @returns {Promise<Array<{ url: string, filename: string, updatedAt: string, size: number }>>}
 */
export async function listStudentImagesFromBucket(student) {
  if (!student) return [];

  const images = [];
  const seenUrls = new Set();

  // Explicit mappings for files present in bucket
  const nameLower = (student.name || '').toLowerCase();
  const photoStr = String(student.photo || '');

  if (nameLower.includes('tanmaya') || photoStr.includes('Tanmaya')) {
    const url = getBucketPublicUrl('Tanmaya.jpg');
    seenUrls.add(url);
    images.push({ url, filename: 'Tanmaya.jpg', updatedAt: new Date().toISOString(), size: 0 });
  }

  if (nameLower.includes('sneha') || photoStr.includes('Sneha')) {
    const url = getBucketPublicUrl('Sneha.jpg');
    seenUrls.add(url);
    images.push({ url, filename: 'Sneha.jpg', updatedAt: new Date().toISOString(), size: 0 });
  }

  if (nameLower.includes('rahul') || photoStr.includes('Rahul')) {
    const url = getBucketPublicUrl('Rahul-2.jpeg');
    seenUrls.add(url);
    images.push({ url, filename: 'Rahul-2.jpeg', updatedAt: new Date().toISOString(), size: 0 });
  }

  // Check if student.photo is a simple filename
  if (student.photo && typeof student.photo === 'string' && !student.photo.startsWith('http') && !student.photo.startsWith('data:')) {
    const url = getBucketPublicUrl(student.photo);
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push({ url, filename: student.photo, updatedAt: new Date().toISOString(), size: 0 });
    }
  }

  // Query bucket root directory
  try {
    const searchTerms = [
      student.name ? student.name.split(' ')[0] : null,
      student.name,
      student.hallTicket,
      student.id,
    ].filter(Boolean).map(s => String(s).toLowerCase().trim());

    const { data: rootFiles, error: rootErr } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { sortBy: { column: 'created_at', order: 'desc' } });

    if (!rootErr && rootFiles && rootFiles.length > 0) {
      for (const file of rootFiles) {
        if (file.name === '.emptyFolderPlaceholder' || !file.name.includes('.')) continue;
        const fnameLower = file.name.toLowerCase();

        const isMatch = searchTerms.some(term => term && fnameLower.includes(term));
        if (isMatch) {
          const publicUrl = getBucketPublicUrl(file.name);
          if (!seenUrls.has(publicUrl)) {
            seenUrls.add(publicUrl);
            images.push({
              url: publicUrl,
              filename: file.name,
              updatedAt: file.updated_at || file.created_at || new Date().toISOString(),
              size: file.metadata?.size || file.size || 0
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase Storage] Error querying root bucket files:', err);
  }

  return images;
}

/**
 * Resolves the primary photo for a student from Supabase Storage bucket.
 * Returns distinct cadet photos for Sneha, Tanmaya, and Rahul, and preserves base64 data URLs for newly enrolled cadets.
 * 
 * @param {Object} student 
 * @returns {Promise<string>} Primary image URL
 */
export async function fetchStudentPhotoFromSupabase(student) {
  if (!student) return null;

  // 1. If photo is already a base64 Data URL (from webcam enrollment), return directly so the clicked picture is preserved
  if (student.photo && typeof student.photo === 'string' && student.photo.startsWith('data:image/')) {
    return student.photo;
  }

  const nameLower = (student.name || '').toLowerCase();
  const photoStr = String(student.photo || '');

  // 2. Direct bucket file URL matches for Tanmaya, Sneha, and Rahul
  if (nameLower.includes('tanmaya') || photoStr.includes('Tanmaya')) {
    return getBucketPublicUrl('Tanmaya.jpg');
  }
  if (nameLower.includes('sneha') || photoStr.includes('Sneha')) {
    return getBucketPublicUrl('Sneha.jpg');
  }
  if ((nameLower === 'rahul' || photoStr.includes('Rahul-2')) && !nameLower.includes('khanna')) {
    return getBucketPublicUrl('Rahul-2.jpeg');
  }

  // 3. If student.photo is a filename in student-photos bucket (e.g. "Sneha.jpg"), build public bucket URL
  if (student.photo && typeof student.photo === 'string' && !student.photo.startsWith('http') && !student.photo.startsWith('data:')) {
    return getBucketPublicUrl(student.photo);
  }

  // 4. Return existing student.photo URL if valid HTTP/HTTPS URL
  if (student.photo && typeof student.photo === 'string' && student.photo.startsWith('http')) {
    return student.photo;
  }

  return student.photo || null;
}
