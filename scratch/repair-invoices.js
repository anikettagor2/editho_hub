const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Parse .env.local manually to load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
                val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
        }
    });
}

const serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

console.log(`Initializing Firebase for project: ${projectId}`);

if (serviceAccountEmail && privateKey) {
    const sanitizedKey = privateKey.trim().replace(/\\n/g, '\n');
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: serviceAccountEmail,
            privateKey: sanitizedKey,
        })
    });
} else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
    });
}

const db = admin.firestore();

async function repair() {
    try {
        const targets = [
            {
                id: 'e12JJ23rRMZq0SkbFnjM', // INV-404678-42
                projectName: 'Champain 1',
                subtotal: 300,
                total: 354
            },
            {
                id: 'p5VHwxTIME7A0TQYCjNo', // INV-588686-52
                projectName: 'Cockroach',
                subtotal: 300,
                total: 354
            }
        ];

        for (const target of targets) {
            console.log(`Checking invoice ID: ${target.id} (${target.projectName})...`);
            const docRef = db.collection('invoices').doc(target.id);
            const snap = await docRef.get();
            
            if (snap.exists) {
                const data = snap.data();
                console.log(`Current stats -> Subtotal: ${data.subtotal}, Total: ${data.total}`);
                
                await docRef.update({
                    subtotal: target.subtotal,
                    total: target.total,
                    items: [{
                        description: `Total Cost for Project: ${target.projectName}`,
                        quantity: 1,
                        rate: target.subtotal,
                        amount: target.subtotal
                    }],
                    notes: data.notes + " (Updated to Total Cost format)"
                });
                
                console.log(`Successfully updated invoice ID: ${target.id} to Subtotal: ${target.subtotal}, Total: ${target.total}!`);
            } else {
                console.log(`Invoice ID ${target.id} does not exist in Firestore.`);
            }
        }
    } catch (err) {
        console.error("Error repairing:", err);
    }
}

repair();
