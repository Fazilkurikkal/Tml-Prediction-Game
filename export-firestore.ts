import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error(`Config file not found at ${configPath}`);
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('Initializing Firebase App with config for project:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const collectionsToExport = ['users', 'leaderboard', 'matches', 'predictions', 'credentials', 'test'];
const exportDirName = 'firebase_data_export';
const exportDir = path.join(process.cwd(), exportDirName);

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
  console.log(`Created new directory: ${exportDirName}`);
}

async function exportAll() {
  console.log('Starting data collection from Firestore...');
  
  for (const collName of collectionsToExport) {
    try {
      console.log(`Fetching collection: "${collName}"...`);
      const querySnapshot = await getDocs(collection(db, collName));
      const documents: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (collName === 'credentials') {
          if (data.password) {
            data.password = '[REDACTED_FOR_SECURITY]';
          }
        }
        documents.push({
          _id: doc.id,
          ...data
        });
      });
      
      const filePath = path.join(exportDir, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2), 'utf8');
      console.log(`✅ Successfully exported ${documents.length} documents from "${collName}" -> ${exportDirName}/${collName}.json`);
    } catch (error: any) {
      console.error(`⚠️ Failed to export collection "${collName}":`, error.message || error);
    }
  }
  
  console.log('\n🎉 Export complete! All collections have been fetched and placed inside:', exportDirName);
  process.exit(0);
}

exportAll().catch((err) => {
  console.error('Fatal error during export:', err);
  process.exit(1);
});
