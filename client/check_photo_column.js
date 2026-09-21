import { supabase } from './src/lib/supabase.js';

async function checkPhotoColumn() {
  const { data, error } = await supabase.from('students').select('id, name, photo, faceEmbedding').limit(20);
  if (error) {
    console.error('Error fetching students:', error);
    return;
  }
  console.log('Students photo column inspection:');
  for (const s of data) {
    console.log(`ID: ${s.id} | Name: ${s.name} | Photo: "${s.photo}" | Has Embedding? ${!!s.faceEmbedding}`);
  }
}

checkPhotoColumn();
