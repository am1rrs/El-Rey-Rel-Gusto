const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

const serviceAccountPath = 'C:\\scripts\\elrey-menu\\serviceAccountKey.json'
const databaseURL = 'https://elrey-gusto.firebaseio.com'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  databaseURL: databaseURL
})

const db = admin.firestore()

async function exportFirestoreData() {
  try {
    const collections = await db.collections()
    const exportDir = path.join(__dirname, 'firestore-export')

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir)
    }

    for (const collection of collections) {
      const collectionName = collection.id
      const snapshot = await collection.get()
      const data = snapshot.docs.map(doc => doc.data())

      const outputPath = path.join(exportDir, `${collectionName}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
      console.log(`Exported ${collectionName} to ${outputPath}`)
    }
  } catch (error) {
    console.error('Error exporting data:', error)
  }
}

exportFirestoreData()