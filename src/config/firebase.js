import admin from 'firebase-admin';
import 'dotenv/config';

function initializeFirebase() {
    try {
        const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error.message);
        throw error;
    }
    
}

//algunos cambios
initializeFirebase();

export default admin;