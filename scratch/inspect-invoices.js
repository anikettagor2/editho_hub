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
            // Remove wrapping quotes if they exist
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

async function inspect() {
    try {
        console.log("Fetching last 5 invoices...");
        const invoicesSnap = await db.collection('invoices')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (invoicesSnap.empty) {
            console.log("No invoices found!");
            return;
        }

        for (const doc of invoicesSnap.docs) {
            const data = doc.data();
            console.log(`\n======================================`);
            console.log(`Invoice ID: ${doc.id}`);
            console.log(`Invoice Number: ${data.invoiceNumber}`);
            console.log(`Client: ${data.clientName} (${data.clientEmail})`);
            console.log(`Project ID: ${data.projectId}`);
            console.log(`Subtotal: ${data.subtotal}`);
            console.log(`Tax: ${data.tax}%`);
            console.log(`Total: ${data.total}`);
            console.log(`Created At: ${new Date(data.createdAt).toLocaleString()}`);
            console.log(`Notes: ${data.notes}`);
            
            if (data.projectId) {
                const projSnap = await db.collection('projects').doc(data.projectId).get();
                if (projSnap.exists) {
                    const pData = projSnap.data();
                    console.log(`Project Details -> Name: ${pData.name}, Status: ${pData.status}, Total Cost: ${pData.totalCost}, Amount Paid: ${pData.amountPaid}, Payment Status: ${pData.paymentStatus}`);
                } else {
                    console.log("Associated project not found!");
                }
            }
        }
    } catch (err) {
        console.error("Error inspecting:", err);
    }
}

inspect();
