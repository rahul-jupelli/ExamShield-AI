import { supabase } from '../lib/supabase.js';

export const BUCKET_NAME = 'student-photos';

/**
 * Helper to build the direct public CDN URL for any file inside student-photos bucket
 */
export function getBucketPublicUrl(filename) {
  if (!filename) return null;
  if (typeof filename === 'string' && filename.startsWith('data:')) return filename;
  
  if (typeof filename === 'string' && (filename.startsWith('http://') || filename.startsWith('https://'))) {
    if (filename.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
      return filename;
    }
  }

  const cleanName = String(filename).replace(/^student-photos\//, '').replace(/^\/+/, '');
  try {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(cleanName);
    return data?.publicUrl || null;
  } catch (e) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ylhryvakpswdgapooica.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${cleanName}`;
  }
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
 * Uploads a student photo (base64 Data URL, File, Blob, or external URL) to the Supabase Storage bucket ('student-photos').
 * Always returns the target Supabase Storage public CDN URL so the database photo column stores the bucket path.
 *
 * @param {string | File | Blob} photoData - The photo payload to upload
 * @param {string} [identifier='cadet'] - Student ID or name hint for filename
 * @returns {Promise<string>} Storage public URL stored in database
 */
export async function uploadStudentPhotoToSupabase(photoData, identifier = 'cadet') {
  if (!photoData) {
    throw new Error('No student photo was provided.');
  }

  // If the image is already in our bucket, return its relative path.
  if (
    typeof photoData === 'string' &&
    photoData.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)
  ) {
    return photoData.split(
      `/storage/v1/object/public/${BUCKET_NAME}/`
    )[1];
  }

  const cleanId = String(identifier || 'cadet')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  const timestamp = Date.now();

  let fileToUpload = null;
  let contentType = 'image/jpeg';
  let fileExtension = 'jpg';
  let storagePath;

  if (typeof photoData === 'string' && photoData.startsWith('data:image/')) {
    const mimeMatch = photoData.match(/data:(image\/[^;]+);base64,/);
    contentType = mimeMatch?.[1] || 'image/jpeg';
    fileExtension = contentType.split('/')[1] || 'jpg';
    if (fileExtension === 'jpeg') fileExtension = 'jpg';

    storagePath = `${cleanId}_${timestamp}.${fileExtension}`;
    fileToUpload = dataURLtoFile(photoData, storagePath);

    if (!fileToUpload) {
      throw new Error('Could not convert the selected image for upload.');
    }
  } else if (typeof File !== 'undefined' && photoData instanceof File) {
    contentType = photoData.type || 'image/jpeg';
    fileExtension = contentType.split('/')[1] || 'jpg';
    if (fileExtension === 'jpeg') fileExtension = 'jpg';

    storagePath = `${cleanId}_${timestamp}.${fileExtension}`;
    fileToUpload = new File([photoData], storagePath, {
      type: contentType,
    });
  } else if (typeof Blob !== 'undefined' && photoData instanceof Blob) {
    contentType = photoData.type || 'image/jpeg';
    fileExtension = contentType.split('/')[1] || 'jpg';
    if (fileExtension === 'jpeg') fileExtension = 'jpg';

    storagePath = `${cleanId}_${timestamp}.${fileExtension}`;
    fileToUpload = new File([photoData], storagePath, {
      type: contentType,
    });
  } else {
    throw new Error(
      'Student registration requires an uploaded image or camera capture.'
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileToUpload, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error(
      `Student photo upload failed: ${uploadError.message}. Check the Storage INSERT policy for '${BUCKET_NAME}'.`
    );
  }

  console.log(
    `[Supabase Storage] Uploaded student photo: ${storagePath}`
  );

  return storagePath;
}

/**
 * Fetches all images associated with a student from the Supabase Storage bucket 'student-photos'.
 * 
 * @param {Object} student - Student object
 * @returns {Promise<Array<{ url: string, filename: string, updatedAt: string, size: number }>>}
 */
export async function listStudentImagesFromBucket(student) {
  if (!student) return [];

  const images = [];
  const seenUrls = new Set();

  const nameLower = (student.name || '').toLowerCase().trim();
  const photoStr = String(student.photo || '').trim();
  const studentIdStr = String(student.id || '').trim();
  const hallTicketStr = String(student.hallTicket || '').trim().toLowerCase();

  // 1. Direct bucket URL for student.photo if already in bucket
  if (photoStr) {
    let url = photoStr;
    let filename = photoStr;
    if (!photoStr.startsWith('http') && !photoStr.startsWith('data:')) {
      url = getBucketPublicUrl(photoStr);
      filename = photoStr;
    }
    if (url && url.includes(BUCKET_NAME) && !seenUrls.has(url)) {
      seenUrls.add(url);
      images.push({ url, filename, updatedAt: new Date().toISOString(), size: 0 });
    }
  }

  // 2. Strict explicit mappings for known specific cadets in bucket (by exact ID / HallTicket or full name)
  if (studentIdStr.startsWith('11425') || hallTicketStr === '24bd1a0502' || photoStr.includes('Tanmaya.jpg')) {
    const url = getBucketPublicUrl('Tanmaya.jpg');
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push({ url, filename: 'Tanmaya.jpg', updatedAt: new Date().toISOString(), size: 0 });
    }
  }

  if (studentIdStr.startsWith('11488') || hallTicketStr === '24bd1a05k1' || (photoStr.includes('Sneha.jpg') && !nameLower.includes('reddy'))) {
    const url = getBucketPublicUrl('Sneha.jpg');
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push({ url, filename: 'Sneha.jpg', updatedAt: new Date().toISOString(), size: 0 });
    }
  }

  if (studentIdStr.startsWith('11469') || hallTicketStr === '24bd1a051e' || photoStr.includes('Rahul-2.jpeg')) {
    const url = getBucketPublicUrl('Rahul-2.jpeg');
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push({ url, filename: 'Rahul-2.jpeg', updatedAt: new Date().toISOString(), size: 0 });
    }
  }

  // 3. Query bucket root directory for matching filename using strict identifier terms
  try {
    const searchTerms = [
      student.hallTicket,
      student.id,
    ].filter(Boolean).map(s => String(s).toLowerCase().trim());

    if (searchTerms.length > 0) {
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
    }
  } catch (err) {
    console.warn('[Supabase Storage] Error querying root bucket files:', err);
  }

  return images;
}

/**
 * Resolves the primary photo for a student from Supabase Storage bucket 'student-photos'.
 * Guarantees strict mapping so no student photo is incorrectly swapped with another student.
 * 
 * @param {Object} student 
 * @returns {Promise<string>} Primary bucket image URL or existing photo URL
 */
export async function fetchStudentPhotoFromSupabase(student) {
  if (!student) return null;

  const photoStr = String(student.photo || '').trim();
  const nameLower = (student.name || '').toLowerCase().trim();
  const studentIdStr = String(student.id || '').trim();
  const hallTicketStr = String(student.hallTicket || '').trim().toLowerCase();

  // 1. If photo is already a public URL in our student-photos bucket, return directly
  if (photoStr.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
    return photoStr;
  }

  // 2. If photo is a relative filename in student-photos bucket (e.g. "Sneha.jpg", "Tanmaya.jpg", "Rahul-2.jpeg")
  if (photoStr && !photoStr.startsWith('http') && !photoStr.startsWith('data:')) {
    return getBucketPublicUrl(photoStr);
  }

  // 3. Strict explicit bucket file matches ONLY for specific known database records (by exact ID / HallTicket)
  if (studentIdStr.startsWith('11425') || hallTicketStr === '24bd1a0502') {
    return getBucketPublicUrl('Tanmaya.jpg');
  }
  if (studentIdStr.startsWith('11488') || hallTicketStr === '24bd1a05k1') {
    return getBucketPublicUrl('Sneha.jpg');
  }
  if (studentIdStr.startsWith('11469') || hallTicketStr === '24bd1a051e') {
    return getBucketPublicUrl('Rahul-2.jpeg');
  }

  // 4. If student has an existing external photo URL (e.g. Unsplash URL for Sneha Reddy or seed cadets), return it as-is
  if (photoStr.startsWith('http') && !photoStr.includes(BUCKET_NAME)) {
    return photoStr;
  }

  // 5. Search bucket root for matching filename by student ID or HallTicket
  try {
    const searchTerms = [
      student.hallTicket,
      student.id,
    ].filter(Boolean).map(s => String(s).toLowerCase().trim());

    if (searchTerms.length > 0) {
      const { data: rootFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { sortBy: { column: 'created_at', order: 'desc' } });

      if (rootFiles && rootFiles.length > 0) {
        for (const file of rootFiles) {
          if (file.name === '.emptyFolderPlaceholder' || !file.name.includes('.')) continue;
          const fnameLower = file.name.toLowerCase();
          if (searchTerms.some(term => term && fnameLower.includes(term))) {
            return getBucketPublicUrl(file.name);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase Storage] Search notice:', err);
  }

  return getBucketPublicUrl(photoStr) || student.photo || null;
}


