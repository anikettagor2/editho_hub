import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore(app);

async function check() {
  const ref = db.collection('settings').doc('whatsapp');
  const doc = await ref.get();
  console.log("Current Data:", doc.exists ? doc.data() : 'Doc does not exist');
  
  if (doc.exists) {
      await ref.update({ enabled: true });
      console.log("Updated enabled to true.");
  } else {
      await ref.set({ enabled: true });
      console.log("Created doc with enabled: true.");
  }
}
check().catch(console.error);
